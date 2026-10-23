import { CAR_MODELS, DEFAULT_CAR, DEFAULT_LOADOUT, EFFECTS, HANDLING, NITRO, TRACK_HALF, WALL_MARGIN } from '../config.js';
import { clamp, TAU } from '../core/math.js';
import { sanitizeLoadout } from './loadout.js';
import { carPoints, deriveStats, gripAt } from './stats.js';
import { nearestOnOtherStretch, nearestOnTrack } from './track.js';

export function createCar({ id, name, color, isPlayer = false, model = DEFAULT_CAR, upgrades = {}, loadout = DEFAULT_LOADOUT }) {
  const car = {
    id, name, color, isPlayer,
    autopilot: false,             // jogador dirigido pela IA (depois da chegada, ou em testes)
    model, upgrades: { engine: 0, tires: 0, armor: 0, ...upgrades },
    loadout: sanitizeLoadout(loadout, model), // só as armas que cabem no modelo
    points: null, stats: null,
    x: 0, y: 0, a: 0, vx: 0, vy: 0, spin: 0,
    idx: 0, seg: 0,               // ponto da pista mais próximo e a fração até o próximo
    lap: -1, topLap: -1, passedHalf: false, lapStart: 0, bestLap: 0,
    finished: false, finishTime: 0, finishRank: 0, place: 8,
    armor: 0, alive: true, respawnT: 0, respawnIdx: null, invuln: 0,
    ammo: {}, cooldown: {}, nitroT: 0,          // por arma; a munição só chega ao cruzar a largada
    status: { emp: 0, oil: 0, glue: 0 },        // segundos restantes de cada efeito
    kills: 0, deaths: 0, accidents: 0, extras: 0, lastHitBy: null, lastHitT: -99,
    input: { up: false, down: false, steer: 0, fire1: false, fire2: false, rear: false, extra: false },
    ai: { off: 0, offTarget: 0, offT: 0, dodgeT: 0, stuckT: 0, reverseT: 0, skill: 1, aggro: 0.5, dodge: 0.5 },
  };
  refreshStats(car);
  car.armor = car.stats.armor;
  return car;
}

/** Recalcula pontos e física depois de trocar de modelo ou comprar upgrade. */
export function refreshStats(car) {
  car.points = carPoints(CAR_MODELS[car.model], car.upgrades);
  car.stats = deriveStats(car.points);
}

/** Um passo de física e a mureta. Devolve a batida na mureta ({ force, x, y }) ou null. */
export function stepCar(car, dt, track) {
  drive(car, dt);
  return keepInsideWalls(car, track);
}

/**
 * Física do carro em campo aberto (sem pista).
 * O pneu segura no máximo `gripAt` de força lateral por segundo: em baixa velocidade
 * ele segue o volante sem escorregar; rápido e com o volante virado, passa do limite e derrapa.
 */
export function drive(car, dt) {
  const s = car.stats, inp = car.input, st = car.status;
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  let vF = car.vx * fx + car.vy * fy;   // para a frente
  let vR = -car.vx * fy + car.vy * fx;  // de lado
  const nitro = car.nitroT > 0;
  if (nitro) car.nitroT -= dt;
  const oil = st.oil > 0;
  // Fração da tração que o pneu tem: 1 normal; no óleo, zero e depois voltando aos poucos.
  const grip = clamp(1 - st.oil / EFFECTS.oil.recover, 0, 1);

  // Óleo: o que falta de tração vira deslize na direção em que o carro vinha, perdendo velocidade.
  // Sem tração nenhuma, volante, acelerador e freio não mudam a trajetória.
  if (grip < 1) {
    const slide = Math.hypot(vF, vR);
    const keep = slide > 0 ? Math.max(0, slide - EFFECTS.oil.slowdown * (1 - grip) * dt) / slide : 0;
    vF *= keep;
    vR *= keep;
  }
  vF += (throttle(car, vF, nitro, dt) - vF) * grip;

  // Pneu: anula a velocidade lateral até o limite de tração; o que passar disso vira derrapagem.
  const hold = gripAt(s, Math.abs(vF)) * grip * dt;
  if (Math.abs(vR) <= hold) vR = 0;
  else {
    vR -= Math.sign(vR) * hold;
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), Math.abs(vR) * HANDLING.scrub * grip * dt);
  }

  // Volante: devagar, o giro é limitado pelo raio mínimo de curva; rápido, fica um pouco mais pesado.
  // No óleo conta a velocidade do deslize, para qualquer lado que o carro esteja virado.
  const speed = oil ? Math.hypot(vF, vR) : Math.abs(vF);
  const maxRate = HANDLING.turnRate * (1 - HANDLING.turnRateLossAtTop * clamp(speed / s.maxSpeed, 0, 1));
  const rate = Math.min(maxRate, speed / HANDLING.minTurnRadius);
  const steer = st.emp > 0 ? -inp.steer : inp.steer; // PEM: direção invertida
  car.a += steer * rate * dt * (oil || vF >= 0 ? 1 : -1) + car.spin * dt;
  if (car.a > Math.PI) car.a -= TAU;
  else if (car.a < -Math.PI) car.a += TAU;
  car.spin *= Math.exp(-2.5 * grip * dt); // sem tração, nada segura o giro

  car.vx = fx * vF - fy * vR;
  car.vy = fy * vF + fx * vR;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

// Acelerador, freio e ré. Na cola, a velocidade máxima cai, e nem o nitro nem a ré passam dela.
function throttle(car, vF, nitro, dt) {
  const s = car.stats, inp = car.input;
  const top = car.status.glue > 0 ? s.maxSpeed * EFFECTS.glue.speed : s.maxSpeed * (nitro ? NITRO.speed : 1);
  if (nitro) vF = Math.min(top, vF + s.accel * NITRO.accel * dt);
  else if (inp.up && !inp.down && vF < top) vF = Math.min(top, vF + s.accel * dt * (vF < 0 ? 2.5 : 1));
  if (inp.down && !nitro) {
    if (vF > 15) vF -= s.brake * dt;
    else vF = Math.max(-Math.min(s.reverse, top), vF - s.reverse * 2 * dt);
  }
  if (!inp.up && !inp.down && !nitro) {
    vF *= Math.exp(-0.8 * dt);
    if (Math.abs(vF) < 4) vF = 0;
  }
  if (vF > top) vF = Math.max(top, vF - 350 * dt);
  return vF;
}

function keepInsideWalls(car, track) {
  const n = nearestOnTrack(track, car.x, car.y, car.idx);
  car.idx = n.idx;
  car.seg = n.t;
  const limit = TRACK_HALF - WALL_MARGIN;
  if (n.dist <= limit) return null;

  const nx = (car.x - n.px) / n.dist, ny = (car.y - n.py) / n.dist;
  car.x = n.px + nx * limit;
  car.y = n.py + ny * limit;
  const force = car.vx * nx + car.vy * ny;
  if (force <= 0) return null;
  // No cruzamento, a borda do braço fica em cima do asfalto do outro braço: ali o carro
  // só desliza, sem bater. Ele continua preso ao próprio braço, então não troca de caminho.
  if (track.crossing[n.idx] && nearestOnOtherStretch(track, car.x, car.y, n.idx).dist < TRACK_HALF) {
    car.vx -= nx * force;
    car.vy -= ny * force;
    return null;
  }
  car.vx -= nx * force * 1.35;                  // quica um pouco
  car.vy -= ny * force * 1.35;
  const keep = 1 - Math.min(0.35, force / 900); // e perde velocidade raspando
  car.vx *= keep;
  car.vy *= keep;
  return { force, x: car.x + nx * 12, y: car.y + ny * 12 };
}
