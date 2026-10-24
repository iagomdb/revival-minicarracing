import { AI_COLORS, AI_NAMES, AI_STYLES, CAR_MODELS, COUNTDOWN, DEFAULT_CAR, DEFAULT_LOADOUT, DEMO_EXTRA, DIFFICULTIES, GRID_SIZE, PLAYER, RESPAWN, TOTAL_LAPS, WALL_DAMAGE } from '../config.js';
import { pick, randRange, shuffle } from '../core/math.js';
import { driveAI } from './ai.js';
import { createCar, stepCar } from './car.js';
import { collideCars } from './collisions.js';
import { damage, destroyCar } from './damage.js';
import { emit } from './events.js';
import { equipped, randomLoadout, refillAmmo } from './loadout.js';
import { placePickups, updatePickups } from './pickups.js';
import { gridSlot, pastCrossing, trackPoint } from './track.js';
import { updateMines, updatePuddles, updateShots, useWeapon } from './weapons.js';

const FINISH_DELAY = 3.5; // segundos entre a chegada do jogador e o fim da corrida

/**
 * Estado completo de uma corrida. `mode`: 'play' (com jogador) ou 'demo' (só CPU, fundo do menu).
 * `rng` permite repetir uma corrida igualzinha nos testes. A CPU sorteia o próprio carro e equipamento,
 * e os perfis de comportamento (`AI_STYLES`) se revezam entre os carros dela.
 * Campeonato: `playerUpgrades` e `playerUnits` são as compras do jogador (veja `createCar`); `rivals`
 * ({ name, color, model }) fixa os adversários e os carros deles, que largam numa ordem sorteada; e cada
 * arma da CPU tem `cpuUnits` unidades.
 */
export function createRace({
  track, mode = 'play', difficulty = 'medio', laps = TOTAL_LAPS, rng = Math.random,
  playerCar = DEFAULT_CAR, playerLoadout = DEFAULT_LOADOUT, playerUpgrades = {}, playerUnits = null,
  rivals = null, cpuUnits = 1,
}) {
  const race = {
    track, mode, rng,
    laps: mode === 'demo' ? Infinity : laps,
    state: 'countdown',           // countdown → race → finishing → done
    countdown: mode === 'demo' ? 1 : COUNTDOWN, lastLit: 0,
    time: 0, finishT: 0, finishCount: 0,
    cars: [], shots: [], mines: [], puddles: [], pickups: [], ranking: [], events: [], player: null,
  };
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.medio;
  const names = shuffle(AI_NAMES.slice(), rng), colors = shuffle(AI_COLORS.slice(), rng);
  const styles = shuffle(Object.keys(AI_STYLES), rng);
  const grid = rivals && shuffle(rivals.slice(), rng);
  const cpuUnitsOf = (loadout) => (cpuUnits === 1 ? null : Object.fromEntries(equipped(loadout).map((id) => [id, cpuUnits])));
  for (let k = 0; k < GRID_SIZE; k++) {
    const isPlayer = mode === 'play' && k === GRID_SIZE - 1;
    const who = isPlayer ? PLAYER : grid?.[k] ?? (k < names.length ? { name: names[k], color: colors[k] } : DEMO_EXTRA);
    const model = isPlayer ? playerCar : grid?.[k]?.model ?? pick(rng, Object.keys(CAR_MODELS));
    const loadout = isPlayer ? playerLoadout : randomLoadout(rng, model);
    const car = createCar({
      id: k, name: who.name, color: who.color, isPlayer, model, loadout,
      upgrades: isPlayer ? playerUpgrades : {},
      units: isPlayer ? playerUnits : cpuUnitsOf(loadout),
    });
    const slot = gridSlot(track, k), pos = trackPoint(track, slot.idx, slot.off);
    Object.assign(car, { x: pos.x, y: pos.y, a: track.ang[slot.idx], idx: slot.idx });
    car.ai.skill = diff.speed * randRange(rng, 0.95, 1.02);
    const style = isPlayer ? null : styles[k % styles.length];
    car.ai.style = style;
    car.ai.aggro = diff.aggro * (AI_STYLES[style]?.aggro ?? 1);
    car.ai.dodge = Math.min(1, diff.dodge * (AI_STYLES[style]?.dodge ?? 1));
    race.cars.push(car);
  }
  race.player = race.cars.find((c) => c.isPlayer) || null;
  placePickups(race);
  computeRanking(race);
  return race;
}

export function updateRace(race, dt) {
  updateClock(race, dt);
  const racing = race.state !== 'countdown';
  for (const car of race.cars) {
    if (!car.isPlayer || car.autopilot) driveAI(race, car, dt, racing, !car.finished && !car.autopilot);
    tickTimers(car, dt);
    if (!car.alive) {
      if ((car.respawnT -= dt) <= 0 && racing) respawnCar(race, car);
      continue;
    }
    moveCar(race, car, dt);
    // As armas só funcionam depois de cruzar a linha de largada (original).
    if (racing && car.alive && car.lap >= 0 && !car.finished) {
      const { front, rear, extra } = car.loadout, inp = car.input;
      if (inp.fire1) useWeapon(race, car, front[0]);
      if (inp.fire2 && front[1]) useWeapon(race, car, front[1]); // carro de 1 arma: a tecla não faz nada
      if (inp.rear) useWeapon(race, car, rear);
      if (inp.extra) useWeapon(race, car, extra);
    }
  }
  collideCars(race);
  updateShots(race, dt);
  updateMines(race, dt);
  updatePuddles(race, dt);
  updatePickups(race, dt);
  computeRanking(race);
  if (race.state === 'finishing' && (race.finishT -= dt) <= 0) {
    race.state = 'done';
    emit(race, 'race-over');
  }
}

/** Semáforo: quantas luzes vermelhas acesas, ou verde logo depois da largada. */
export function lightState(race) {
  if (race.state === 'countdown') return { lit: Math.min(3, Math.floor(COUNTDOWN - race.countdown) + 1), green: false };
  return { lit: 0, green: race.time < 1.5 };
}

function tickTimers(car, dt) {
  for (const id in car.cooldown) car.cooldown[id] = Math.max(0, car.cooldown[id] - dt);
  for (const effect in car.status) car.status[effect] = Math.max(0, car.status[effect] - dt);
  car.invuln = Math.max(0, car.invuln - dt);
}

function updateClock(race, dt) {
  if (race.state === 'countdown') {
    race.countdown -= dt;
    const { lit } = lightState(race);
    if (lit !== race.lastLit && race.countdown > 0) {
      race.lastLit = lit;
      emit(race, 'countdown', { lit });
    }
    if (race.countdown <= 0) {
      race.state = 'race';
      emit(race, 'go');
    }
  } else if (race.state !== 'done') {
    race.time += dt;
  }
}

function moveCar(race, car, dt) {
  const N = race.track.N, prev = car.idx;
  const hit = stepCar(car, dt, race.track);
  if (hit && hit.force > WALL_DAMAGE.threshold) {
    damage(race, car, (hit.force - WALL_DAMAGE.threshold) * WALL_DAMAGE.factor, null);
    if (hit.force > WALL_DAMAGE.accident) car.accidents++;
    emit(race, 'wall', { car, x: hit.x, y: hit.y, force: hit.force });
  }
  // A linha de chegada é o índice 0 da pista.
  if (prev > N * 0.8 && car.idx < N * 0.2) crossLine(race, car, 1);
  else if (prev < N * 0.2 && car.idx > N * 0.8) crossLine(race, car, -1);
  if (car.idx > N * 0.45 && car.idx < N * 0.55) car.passedHalf = true;
}

function crossLine(race, car, dir) {
  if (car.finished) return;
  if (dir < 0) { car.lap--; car.passedHalf = true; return; }
  if (car.lap >= 0 && !car.passedHalf) return;
  car.lap++;
  car.passedHalf = false;
  if (race.state === 'countdown') return falseStart(race, car);
  if (car.lap <= car.topLap) return; // voltou para trás da linha e cruzou de novo
  car.topLap = car.lap;

  refillAmmo(car); // recarrega até o limite, sem acumular (original)
  if (car.lap >= 1) {
    const lapTime = race.time - car.lapStart;
    if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime;
  }
  car.lapStart = race.time;
  if (car.lap >= race.laps) finishCar(race, car);
  else if (car.lap > 0) emit(race, 'lap', { car, lap: car.lap, final: car.lap === race.laps - 1 });
}

function finishCar(race, car) {
  car.finished = true;
  car.finishTime = race.time;
  car.finishRank = ++race.finishCount;
  emit(race, 'finish', { car, rank: car.finishRank });
  if (car === race.player) {
    car.autopilot = true;
    race.state = 'finishing';
    race.finishT = FINISH_DELAY;
  }
}

// Saiu antes do verde: o carro explode e volta atrás do pelotão (original).
function falseStart(race, car) {
  destroyCar(race, car, 'false-start');
  car.lap = -1;
  car.topLap = -1;
  car.passedHalf = false;
  car.respawnIdx = gridSlot(race.track, GRID_SIZE - 1).idx - 12;
  car.respawnT = race.countdown + 0.6;
  emit(race, 'false-start', { car });
}

// Quem explodiu no X renasce logo depois dele, para não ficar parado no caminho de quem vem do outro braço.
function respawnCar(race, car) {
  const idx = pastCrossing(race.track, car.respawnIdx ?? car.idx);
  const pos = trackPoint(race.track, idx, randRange(race.rng, -0.35, 0.35) * race.track.half);
  Object.assign(car, {
    x: pos.x, y: pos.y, a: race.track.ang[idx], idx, vx: 0, vy: 0, spin: 0,
    alive: true, armor: car.stats.armor, invuln: RESPAWN.invulnerable, respawnIdx: null,
    status: { emp: 0, oil: 0, glue: 0 },
  });
}

export function computeRanking(race) {
  const N = race.track.N;
  const progress = (c) => c.lap * N + c.idx + c.seg;
  race.ranking = race.cars.slice().sort((a, b) => {
    if (a.finished || b.finished) return a.finished && b.finished ? a.finishRank - b.finishRank : a.finished ? -1 : 1;
    return progress(b) - progress(a);
  });
  race.ranking.forEach((c, i) => { c.place = i + 1; });
}
