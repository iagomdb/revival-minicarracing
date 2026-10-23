import assert from 'node:assert/strict';
import test from 'node:test';
import { CAR_MODELS, STEP, WEAPONS } from '../src/config.js';
import { seededRandom } from '../src/core/math.js';
import { createCar, drive } from '../src/sim/car.js';
import { drainEvents } from '../src/sim/events.js';
import { refillAmmo, sanitizeLoadout } from '../src/sim/loadout.js';
import { createRace, updateRace } from '../src/sim/race.js';
import { carPoints, deriveStats } from '../src/sim/stats.js';
import { getTrack } from '../src/sim/tracks/index.js';

const track = getTrack('deserto');
const statsOf = (model) => deriveStats(carPoints(CAR_MODELS[model]));

// Confere se um equipamento usa exatamente os encaixes do modelo, sem arma repetida nem fora do lugar.
function assertFits(loadout, model) {
  const slots = CAR_MODELS[model].slots;
  assert.equal(loadout.front.length, slots.front, `${model}: número de armas de frente`);
  assert.equal(new Set(loadout.front).size, loadout.front.length, `${model}: arma de frente repetida`);
  for (const id of loadout.front) assert.equal(WEAPONS[id]?.slot, 'front', `${model}: ${id} não é de frente`);
  for (const kind of ['rear', 'extra']) {
    if (slots[kind]) assert.equal(WEAPONS[loadout[kind]]?.slot, kind, `${model}: ${kind}`);
    else assert.equal(loadout[kind], null, `${model}: ${kind}`);
  }
}

test('Flecha: mais rápido que o Micro, com menos aceleração e menos tração', () => {
  const micro = statsOf('micro'), flecha = statsOf('flecha');
  assert.ok(flecha.maxSpeed > micro.maxSpeed);
  assert.ok(flecha.accel < micro.accel);
  assert.ok(flecha.grip < micro.grip);
});

test('Arsenal: a velocidade e a aceleração do Micro, com menos tração', () => {
  const micro = statsOf('micro'), arsenal = statsOf('arsenal');
  assert.equal(arsenal.maxSpeed, micro.maxSpeed);
  assert.equal(arsenal.accel, micro.accel);
  assert.ok(arsenal.grip < micro.grip);
});

test('Micro e Flecha têm 1 arma de frente, o Arsenal 2; todos têm 1 traseira e 1 extra', () => {
  assert.equal(CAR_MODELS.micro.slots.front, 1);
  assert.equal(CAR_MODELS.flecha.slots.front, 1);
  assert.equal(CAR_MODELS.arsenal.slots.front, 2);
  for (const [id, { slots }] of Object.entries(CAR_MODELS)) {
    assert.ok(slots.front >= 1 && slots.front <= 2, `${id}: só existem as teclas Arma 1 e Arma 2`);
    assert.equal(slots.rear, 1, id);
    assert.equal(slots.extra, 1, id);
  }
});

// Entra a 350 px/s com o volante todo virado, sem acelerar, e devolve a velocidade depois de 0,6 s.
function speedAfterTightTurn(model) {
  const car = createCar({ id: 0, name: 'teste', color: '#ffffff', model });
  car.vx = 350;
  car.input.steer = 1;
  for (let t = 0; t < 0.6; t += STEP) drive(car, STEP);
  return Math.hypot(car.vx, car.vy);
}

test('com menos tração, o carro derrapa e perde mais velocidade numa curva fechada', () => {
  const micro = speedAfterTightTurn('micro'), flecha = speedAfterTightTurn('flecha'), arsenal = speedAfterTightTurn('arsenal');
  const msg = `Micro ${micro.toFixed(0)} · Flecha ${flecha.toFixed(0)} · Arsenal ${arsenal.toFixed(0)} px/s`;
  assert.ok(flecha < micro, msg);
  assert.ok(arsenal < micro, msg);
});

test('carro de 1 arma de frente não aceita 2: fica só a primeira', () => {
  const loadout = sanitizeLoadout({ front: ['rocket', 'laser'], rear: 'oil', extra: 'nitro' }, 'micro');
  assert.deepEqual(loadout, { front: ['rocket'], rear: 'oil', extra: 'nitro' });
});

test('o Arsenal exige 2 armas de frente diferentes', () => {
  for (const front of [['mg', 'mg'], ['mg'], ['mg', 'canhão']]) {
    const loadout = sanitizeLoadout({ front, rear: 'mine', extra: 'nitro' }, 'arsenal');
    assertFits(loadout, 'arsenal');
    assert.equal(loadout.front[0], 'mg', 'a arma válida que já estava fica');
  }
});

test('equipamento válido passa sem mudança; lixo vira um equipamento válido para o modelo', () => {
  const ok = { front: ['rocket', 'mg'], rear: 'glue', extra: 'nitro' };
  assert.deepEqual(sanitizeLoadout(ok, 'arsenal'), ok);
  for (const model of Object.keys(CAR_MODELS)) {
    assertFits(sanitizeLoadout(null, model), model);
    assertFits(sanitizeLoadout({ front: 'laser', rear: 'canhão', extra: 'mg' }, model), model);
  }
});

test('trocar de carro: fica a primeira arma, e ao voltar para o Arsenal a segunda vem preenchida', () => {
  const micro = sanitizeLoadout({ front: ['rocket', 'laser'], rear: 'glue', extra: 'nitro' }, 'micro');
  assert.deepEqual(micro.front, ['rocket']);
  const arsenal = sanitizeLoadout(micro, 'arsenal');
  assertFits(arsenal, 'arsenal');
  assert.equal(arsenal.front[0], 'rocket');
  assert.equal(arsenal.rear, 'glue');
});

test('a CPU sorteia os três carros, sempre com equipamento válido para o modelo', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const race = createRace({ track, mode: 'demo', rng: seededRandom(seed) });
    for (const car of race.cars) {
      seen.add(car.model);
      assertFits(car.loadout, car.model);
      assert.deepEqual(car.stats, statsOf(car.model));
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(CAR_MODELS).sort());
});

test('o jogador larga com o carro e as armas que escolheu', () => {
  const playerLoadout = { front: ['rocket', 'laser'], rear: 'glue', extra: 'nitro' };
  const race = createRace({ track, rng: seededRandom(2), playerCar: 'arsenal', playerLoadout });
  assert.equal(race.player.model, 'arsenal');
  assert.deepEqual(race.player.loadout, playerLoadout);
  assert.deepEqual(race.player.stats, statsOf('arsenal'));
});

test('num carro de 1 arma, a tecla da Arma 2 não faz nada', () => {
  const race = createRace({ track, rng: seededRandom(4), playerCar: 'micro' });
  const p = race.player;
  race.state = 'race';
  p.lap = 0;
  refillAmmo(p);
  const playerShots = () => drainEvents(race).filter((e) => e.type === 'shot' && e.car === p).length;

  p.input.fire2 = true;
  updateRace(race, STEP);
  assert.equal(playerShots(), 0);

  p.input.fire2 = false;
  p.input.fire1 = true;
  updateRace(race, STEP);
  assert.equal(playerShots(), 1);
});
