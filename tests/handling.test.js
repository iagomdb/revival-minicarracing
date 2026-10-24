import assert from 'node:assert/strict';
import test from 'node:test';
import { CAR_MODELS, POINT_VALUES, STEP } from '../src/config.js';
import { createCar, drive, refreshStats } from '../src/sim/car.js';
import { carPoints, cornerSpeed, deriveStats, gripAt } from '../src/sim/stats.js';

const micro = CAR_MODELS.micro;

function carAt(speed, upgrades = {}) {
  const car = createCar({ id: 0, name: 'teste', color: '#ffffff', upgrades });
  car.vx = speed;
  return car;
}

// Volante todo virado por `seconds` em campo aberto; devolve a maior velocidade lateral (derrapagem).
function fullLock(car, seconds, up) {
  Object.assign(car.input, { up, steer: 1 });
  let maxSlip = 0;
  for (let t = 0; t < seconds; t += STEP) {
    drive(car, STEP);
    maxSlip = Math.max(maxSlip, Math.abs(-car.vx * Math.sin(car.a) + car.vy * Math.cos(car.a)));
  }
  return maxSlip;
}

// A medição é feita logo depois do giro de cada passo, então sempre sobra o giro de um passo (v·ω·dt).
const ONE_STEP_LAG = 6;

test('devagar, o carro faz curva com o volante todo virado sem escorregar', () => {
  assert.ok(fullLock(carAt(150), 1.5, false) < ONE_STEP_LAG);
});

test('rápido, com o volante todo virado, o pneu passa do limite e o carro derrapa', () => {
  const car = carAt(0);
  car.vx = car.stats.maxSpeed;
  assert.ok(fullLock(car, 1, true) > 40);
});

test('quanto mais velocidade, menos tração', () => {
  const stats = deriveStats(carPoints(micro));
  assert.ok(gripAt(stats, 400) < gripAt(stats, 200));
  assert.ok(gripAt(stats, 200) < gripAt(stats, 0));
});

test('pneu melhor dá mais tração: mais velocidade de curva e menos derrapagem', () => {
  const base = deriveStats(carPoints(micro)), tires = deriveStats(carPoints(micro, { tires: 5 }));
  assert.ok(tires.grip > base.grip);
  assert.ok(cornerSpeed(tires, 200) > cornerSpeed(base, 200));
  assert.equal(tires.maxSpeed, base.maxSpeed);

  const slipBase = fullLock(carAt(400), 1, true), slipTires = fullLock(carAt(400, { tires: 5 }), 1, true);
  assert.ok(slipTires < slipBase, `pneu 5: ${slipTires.toFixed(0)} px/s, sem upgrade: ${slipBase.toFixed(0)} px/s`);
});

test('motor sem pneu dá mais velocidade e aceleração, mas menos aderência; com pneu junto ela volta', () => {
  const base = deriveStats(carPoints(micro)), engine = deriveStats(carPoints(micro, { engine: 3 }));
  assert.ok(engine.maxSpeed > base.maxSpeed);
  assert.ok(engine.accel > base.accel);
  assert.ok(engine.grip < base.grip, 'mais velocidade pede mais pneu');
  assert.equal(deriveStats(carPoints(micro, { engine: 3, tires: 3 })).grip, base.grip);
});

test('a tração conta em relação à velocidade: o carro lento e equilibrado faz a curva mais rápido que o veloz sem pneu', () => {
  const stats = (speed, traction) => deriveStats({ speed, accel: 5, traction, armor: 5 });
  assert.equal(stats(1, 1).grip, stats(5, 5).grip, 'equilibrado: mesma aderência em qualquer nível');
  assert.ok(stats(5, 7).grip > stats(5, 5).grip, 'tração acima da velocidade: gruda mais');
  assert.ok(cornerSpeed(stats(1, 1), 160) > cornerSpeed(stats(8, 3), 160), 'velocidade 1 e tração 1 contra 8 e 3');
  assert.equal(stats(10, 0).grip, POINT_VALUES.traction.min, 'nunca fica sem aderência nenhuma');
});

test('comprar upgrade recalcula a física do carro', () => {
  const car = carAt(0), before = car.stats.grip;
  car.upgrades.tires = 2;
  refreshStats(car);
  assert.ok(car.stats.grip > before);
});
