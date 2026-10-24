import assert from 'node:assert/strict';
import test from 'node:test';
import { PICKUPS, RESPAWN, STEP, WALL_MARGIN } from '../src/config.js';
import { seededRandom } from '../src/core/math.js';
import { createCar, stepCar } from '../src/sim/car.js';
import { destroyCar } from '../src/sim/damage.js';
import { drainEvents } from '../src/sim/events.js';
import { createRace, updateRace } from '../src/sim/race.js';
import { nearestOnTrack, trackPoint } from '../src/sim/track.js';
import { getTrack } from '../src/sim/tracks/index.js';

const oito = getTrack('oito'), desert = getTrack('deserto');

// O índice do meio de cada trecho de cruzamento (um em cada braço do X).
function crossingCenters(track) {
  const { crossing, N } = track, centers = [];
  const start = crossing.indexOf(false);
  let run = [];
  for (let k = 1; k <= N; k++) {
    const i = (start + k) % N;
    if (crossing[i]) run.push(i);
    else if (run.length) { centers.push(run[run.length >> 1]); run = []; }
  }
  return centers;
}

// Quantos pontos o índice andou, de -N/2 a N/2 (passar pela largada não conta como pulo).
const step = (track, from, to) => ((to - from + track.N + track.N / 2) % track.N) - track.N / 2;

// Corrida só com o jogador no piloto automático: os outros carros ficam fora.
function soloRace(seed = 1) {
  const race = createRace({ track: oito, rng: seededRandom(seed) });
  for (const c of race.cars) if (c !== race.player) { c.alive = false; c.respawnT = Infinity; }
  race.player.autopilot = true;
  return race;
}

test('o Oito tem o X: um trecho de cruzamento em cada braço. O Deserto não tem cruzamento', () => {
  assert.equal(crossingCenters(oito).length, 2);
  assert.ok(!desert.crossing.includes(true));
});

test('o Oito tem o dobro da largura do Deserto', () => {
  assert.equal(oito.half, 2 * desert.half);
});

test('no Oito, um carro que anda a volta inteira atravessa o X duas vezes sem o índice pular de braço', () => {
  const race = soloRace(), p = race.player;
  let prev = p.idx, biggest = 0, entries = 0;
  for (let t = 0; t < 120 && p.lap < 1; t += STEP) {
    updateRace(race, STEP);
    drainEvents(race);
    biggest = Math.max(biggest, Math.abs(step(oito, prev, p.idx)));
    if (oito.crossing[p.idx] && !oito.crossing[prev]) entries++;
    prev = p.idx;
  }
  assert.equal(p.lap, 1, 'completou a volta');
  assert.ok(biggest <= 3, `o índice pulou ${biggest} pontos de uma vez`);
  assert.equal(entries, 2, 'passou pelos dois braços do X');
});

test('no Oito, sacos de dinheiro e kits de conserto ficam fora do X', () => {
  const center = oito.pts[crossingCenters(oito)[0]];
  const clear = oito.half * Math.SQRT2 + PICKUPS.radius; // o item não encosta no quadrado de asfalto do X
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const pk of createRace({ track: oito, rng: seededRandom(seed) }).pickups) {
      const d = Math.hypot(pk.x - center.x, pk.y - center.y);
      assert.ok(d >= clear, `${pk.kind} a ${d.toFixed(0)} px do meio do X (semente ${seed})`);
    }
  }
});

// Carro parado no meio da pista, virado para a direita, acelerando contra a borda.
function pushSideways(track, idx) {
  const car = createCar({ id: 0, name: 'teste', color: '#ffffff' });
  const p = trackPoint(track, idx), n = track.nrm[idx];
  Object.assign(car, { x: p.x, y: p.y, idx, a: track.ang[idx] + Math.PI / 2, vx: n.x * 300, vy: n.y * 300 });
  car.input.up = true;
  let hits = 0;
  for (let t = 0; t < 1; t += STEP) if (stepCar(car, STEP, track)) hits++;
  return { car, hits };
}

test('no X, a borda do braço fica sobre o asfalto do outro: o carro desliza sem bater e não troca de braço', () => {
  const c = crossingCenters(oito)[0], limit = oito.half - WALL_MARGIN;
  const { car, hits } = pushSideways(oito, c);
  assert.equal(hits, 0, 'nenhuma batida');
  assert.ok(Math.abs(step(oito, c, car.idx)) <= 3, `índice foi de ${c} para ${car.idx}`);
  const dist = nearestOnTrack(oito, car.x, car.y, car.idx).dist;
  assert.ok(dist > limit - 1 && dist <= limit + 0.01, `encostou na borda do próprio braço (${dist.toFixed(1)} px do meio)`);
  // Fora do X, a mesma manobra bate na mureta.
  assert.ok(pushSideways(oito, 0).hits > 0);
});

test('quem explode no X renasce logo depois dele', () => {
  const race = soloRace(), p = race.player, c = crossingCenters(oito)[0];
  race.state = 'race';
  const pos = trackPoint(oito, c);
  Object.assign(p, { x: pos.x, y: pos.y, a: oito.ang[c], idx: c, lap: 0 });
  destroyCar(race, p);
  for (let t = 0; t < RESPAWN.delay + 0.1; t += STEP) updateRace(race, STEP);
  assert.ok(p.alive);
  assert.ok(!oito.crossing[p.idx], 'fora do X');
  assert.ok(oito.crossing[(p.idx - 1 + oito.N) % oito.N], 'no primeiro ponto depois do X');
  assert.ok(step(oito, c, p.idx) > 0, `renasceu em ${p.idx}, antes do meio do X (${c})`);
});
