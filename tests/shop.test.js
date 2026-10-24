import assert from 'node:assert/strict';
import test from 'node:test';
import { CAR_MODELS, POINT_VALUES, UNIT_MAX, WEAPONS } from '../src/config.js';
import { seededRandom } from '../src/core/math.js';
import { buyCar, carValue, createChampionship, raceOptions } from '../src/career/championship.js';
import {
  buyUnit, buyUpgrade, canBuyUnit, canBuyUpgrade, equipmentValue, sellUnit, sellUpgrade, unitCost, upgradePrice,
} from '../src/career/shop.js';
import { createCar } from '../src/sim/car.js';
import { maxAmmo, refillAmmo } from '../src/sim/loadout.js';
import { createRace } from '../src/sim/race.js';
import { carPoints, deriveStats } from '../src/sim/stats.js';
import { getTrack } from '../src/sim/tracks/index.js';

// Um campeonato com o carro já comprado e o dinheiro que o teste quiser.
function withCar(model = 'micro', money = 100000) {
  const s = createChampionship({ rng: seededRandom(1) });
  s.money = 100000;
  buyCar(s, model);
  s.money = money;
  return s;
}

test('comprar uma unidade desconta o preço; vender devolve metade', () => {
  const s = withCar('micro', 1500);
  assert.ok(buyUnit(s, 'front0', 'laser'));
  assert.equal(s.car.units.laser, 2);
  assert.equal(s.money, 1100);
  assert.ok(buyUnit(s, 'rear', 'mine'));
  assert.ok(buyUnit(s, 'extra', 'nitro'));
  assert.equal(s.money, 0, 'com o Micro, $ 1.500 dão certinho para +1 Laser, 1 Mina e 1 Nitro');
  assert.deepEqual(s.car.loadout, { front: ['laser'], rear: 'mine', extra: 'nitro' });

  assert.ok(sellUnit(s, 'rear'));
  assert.equal(s.money, 250);
  assert.equal(s.car.loadout.rear, null, 'vendeu a última: o encaixe fica vazio');
  assert.equal(s.car.units.mine, undefined);
  assert.equal(sellUnit(s, 'rear'), false, 'não fica abaixo de zero');
});

test('sem dinheiro não compra, e não passa de 5 unidades', () => {
  const s = withCar('micro', 399);
  assert.ok(!canBuyUnit(s, 'front0', 'laser'));
  assert.equal(buyUnit(s, 'front0', 'laser'), false);
  assert.equal(s.money, 399);

  s.money = 100000;
  while (buyUnit(s, 'front0', 'laser'));
  assert.equal(s.car.units.laser, UNIT_MAX);
  assert.equal(unitCost(s.car, 'front0', 'laser'), null);
});

test('encaixe errado não compra: arma traseira na frente, Arma 2 no carro de 1 arma', () => {
  const s = withCar('micro');
  assert.equal(unitCost(s.car, 'front0', 'mine'), null);
  assert.equal(unitCost(s.car, 'front1', 'rocket'), null);
  const a = withCar('arsenal');
  assert.equal(unitCost(a.car, 'front1', 'laser'), null, 'a mesma arma nos dois encaixes da frente, não');
  assert.ok(buyUnit(a, 'front1', 'rocket'));
  assert.deepEqual(a.car.loadout.front, ['laser', 'rocket']);
});

test('trocar a arma de um encaixe vende as unidades antigas e põe 1 da nova', () => {
  const s = withCar('micro', 100000);
  buyUnit(s, 'front0', 'laser');
  buyUnit(s, 'front0', 'laser');           // 3 lasers: valem 3 × 200 na venda
  assert.equal(unitCost(s.car, 'front0', 'rocket'), 1000 - 600);
  const before = s.money;
  assert.ok(buyUnit(s, 'front0', 'rocket'));
  assert.equal(s.money, before - 400);
  assert.deepEqual(s.car.loadout.front, ['rocket']);
  assert.deepEqual(s.car.units, { rocket: 1 });

  // A venda do laser que veio com o carro (200) ajuda a pagar a metralhadora (700).
  const t = withCar('micro', 499);
  assert.ok(!canBuyUnit(t, 'front0', 'mg'));
  t.money = 500;
  assert.ok(buyUnit(t, 'front0', 'mg'));
  assert.equal(t.money, 0);
});

test('munição na corrida = munição da arma × unidades', () => {
  const car = createCar({ id: 0, model: 'micro', loadout: { front: ['laser'], rear: 'mine', extra: 'nitro' }, units: { laser: 3, mine: 2, nitro: 2 } });
  refillAmmo(car);
  assert.equal(car.ammo.laser, WEAPONS.laser.ammo * 3);
  assert.equal(car.ammo.mine, WEAPONS.mine.ammo * 2);
  assert.equal(car.ammo.nitro, 2);
  assert.equal(maxAmmo(car, 'laser'), WEAPONS.laser.ammo * 3);

  const empty = createCar({ id: 1, model: 'micro', loadout: { front: ['laser'], rear: null, extra: null }, units: { laser: 1 } });
  assert.deepEqual(empty.loadout, { front: ['laser'], rear: null, extra: null }, 'comprado: encaixe vazio fica vazio');
  const quick = createCar({ id: 2, model: 'micro', loadout: { front: ['laser'], rear: null, extra: null } });
  assert.equal(quick.loadout.rear, 'mine', 'corrida rápida: encaixe vazio vem com o padrão');
  refillAmmo(quick);
  assert.equal(quick.ammo.laser, WEAPONS.laser.ammo, 'sem compra, 1 unidade');
});

test('melhorias: o nível N custa base × N, vai até 5 e vende pela metade', () => {
  assert.equal(upgradePrice('engine', 3), 2400);
  assert.equal(upgradePrice('tires', 1), 500);
  assert.equal(upgradePrice('armor', 5), 2000);
  const s = withCar('micro', 2400);
  assert.ok(buyUpgrade(s, 'engine'));
  assert.ok(buyUpgrade(s, 'engine'));
  assert.equal(s.money, 0);
  assert.equal(s.car.upgrades.engine, 2);
  assert.ok(!canBuyUpgrade(s, 'engine'));
  assert.ok(sellUpgrade(s, 'engine'));
  assert.equal(s.money, 800, 'o nível 2 custou 1.600: volta 800');
  assert.equal(s.car.upgrades.engine, 1);

  s.money = 100000;
  while (buyUpgrade(s, 'tires'));
  assert.equal(s.car.upgrades.tires, 5);
  assert.equal(sellUpgrade(withCar(), 'armor'), false, 'nível 0 não vende');
});

test('cada nível soma os pontos certos, e a física sobe até 13 pontos sem número estranho', () => {
  const p = carPoints(CAR_MODELS.micro, { engine: 2, tires: 3, armor: 1 });
  assert.deepEqual(p, { speed: 7, accel: 7, traction: 10, armor: 6 });
  // Cada medidor sobe sozinho, com os outros no meio (a aderência conta a tração em relação à velocidade).
  const statOf = { speed: 'maxSpeed', accel: 'accel', traction: 'grip', armor: 'armor' };
  for (const [key, stat] of Object.entries(statOf)) {
    let prev = -Infinity;
    for (let pts = 0; pts <= 13; pts++) {
      const value = deriveStats({ speed: 5, accel: 5, traction: 5, armor: 5, [key]: pts })[stat];
      assert.ok(Number.isFinite(value) && value > 0, `${stat} com ${pts} pontos`);
      assert.ok(value >= prev, `${stat} não cai com ${pts} pontos`);
      prev = value;
    }
  }
  const maxed = deriveStats(carPoints(CAR_MODELS.flecha, { engine: 5 }));
  assert.equal(maxed.maxSpeed, POINT_VALUES.speed.base + POINT_VALUES.speed.perPoint * 13);
  assert.ok(maxed.grip > 0, 'motor no máximo sem pneu: derrapa, mas não quebra');
});

test('o carro vendido vale metade dele e metade do que está instalado', () => {
  const s = withCar('micro', 100000);
  assert.equal(equipmentValue(s.car), 200, 'o laser que veio com o carro');
  buyUnit(s, 'rear', 'mine');      // vale 250
  buyUpgrade(s, 'engine');         // 800, vale 400
  buyUpgrade(s, 'engine');         // 1.600, vale 800
  assert.equal(equipmentValue(s.car), 200 + 250 + 400 + 800);
  assert.equal(carValue(s.car), 5250 + 250 + 400 + 800, 'o laser de fábrica já está nos 5.250');
  const money = s.money;
  buyCar(s, 'arsenal');
  assert.equal(s.money, money + 5250 + 1450 - 14000);
  assert.deepEqual(s.car.upgrades, { engine: 0, tires: 0, armor: 0 }, 'tudo foi junto com o carro velho');
});

test('a corrida usa as compras: munição, pontos e encaixes vazios', () => {
  const s = withCar('micro', 100000);
  buyUnit(s, 'front0', 'laser');
  buyUnit(s, 'extra', 'nitro');
  buyUpgrade(s, 'armor');
  const race = createRace({ track: getTrack('oito'), rng: seededRandom(5), ...raceOptions(s) });
  const p = race.player;
  refillAmmo(p);
  assert.equal(p.ammo.laser, WEAPONS.laser.ammo * 2);
  assert.equal(p.ammo.nitro, 1);
  assert.equal(p.loadout.rear, null);
  assert.equal(p.points.armor, CAR_MODELS.micro.points.armor + 1);
});
