import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_NAMES, CAREER, PRIZES } from '../src/config.js';
import { formatMoney } from '../src/core/format.js';
import { seededRandom } from '../src/core/math.js';
import {
  buyCar, canBuyCar, carValue, createChampionship, isOver, nextTrackId, playerPosition, qualified,
  raceCount, raceOptions, recordRace, standings,
} from '../src/career/championship.js';
import { clearChampionship, loadChampionship, saveChampionship } from '../src/career/storage.js';
import { createRace } from '../src/sim/race.js';
import { getTrack } from '../src/sim/tracks/index.js';

const fresh = (difficulty = 'medio', seed = 1) => createChampionship({ difficulty, rng: seededRandom(seed) });

// Uma chegada com os pilotos do campeonato numa ordem: `order` são os nomes, 'Você' é o jogador.
const finish = (order, extras = 0) =>
  order.map((name) => ({ name, isPlayer: name === 'Você', extras: name === 'Você' ? extras : 0 }));
const playerAt = (place) => {
  const order = AI_NAMES.slice();
  order.splice(place - 1, 0, 'Você');
  return finish(order);
};

// Um localStorage de mentira, para testar o save sem navegador.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

test('começa com $ 12.000: dá para o Micro ou o Flecha, não para o Arsenal', () => {
  const s = fresh();
  assert.equal(s.money, 12000);
  assert.equal(s.car, null);
  assert.ok(canBuyCar(s, 'micro'));
  assert.ok(canBuyCar(s, 'flecha'));
  assert.ok(!canBuyCar(s, 'arsenal'));
  assert.equal(buyCar(s, 'arsenal'), false);
  assert.equal(s.money, 12000);

  const micro = fresh();
  assert.ok(buyCar(micro, 'micro'));
  assert.equal(micro.money, 1500);
  const flecha = fresh();
  assert.ok(buyCar(flecha, 'flecha'));
  assert.equal(flecha.money, 1000);
});

test('carro novo vem com 1 Laser na Arma 1 e o resto vazio', () => {
  const s = fresh();
  buyCar(s, 'micro');
  assert.deepEqual(s.car.loadout, { front: ['laser'], rear: null, extra: null });
  assert.deepEqual(s.car.units, { laser: 1 });
  assert.deepEqual(s.car.upgrades, { engine: 0, tires: 0, armor: 0 });
  s.money = 100000;
  buyCar(s, 'arsenal');
  assert.deepEqual(s.car.loadout, { front: ['laser', null], rear: null, extra: null });
});

test('trocar de carro vende o atual pela metade: Micro + $ 8.750 pega o Arsenal', () => {
  const s = fresh();
  buyCar(s, 'micro');
  assert.equal(carValue(s.car), 5250);
  s.money = 8749;
  assert.ok(!canBuyCar(s, 'arsenal'));
  s.money = 8750;
  assert.ok(buyCar(s, 'arsenal'));
  assert.equal(s.money, 0);
  assert.equal(s.car.model, 'arsenal');
  assert.equal(buyCar(s, 'arsenal'), false, 'não troca pelo carro que já tem');
});

test('cada corrida dá os pontos da posição e o dinheiro do prêmio mais os extras', () => {
  const s = fresh();
  buyCar(s, 'micro');
  const order = ['Você', ...AI_NAMES];
  const result = recordRace(s, finish(order, 350));
  assert.deepEqual(result, { place: 1, points: 10, prize: PRIZES[0], extras: 350, earned: PRIZES[0] + 350 });
  assert.equal(s.money, 1500 + 2000 + 350);
  assert.equal(s.race, 1);
  const byName = Object.fromEntries(s.drivers.map((d) => [d.name, d]));
  order.forEach((name, i) => {
    assert.equal(byName[name].points, CAREER.points[i]);
    assert.equal(byName[name].last, i + 1);
  });
  assert.equal(byName['Você'].wins, 1);
});

test('classificação: pontos, depois vitórias, depois a última corrida', () => {
  const s = fresh();
  const [a, b, c] = s.drivers;
  Object.assign(a, { points: 20, wins: 0, last: 2 });
  Object.assign(b, { points: 20, wins: 1, last: 5 });
  Object.assign(c, { points: 26, wins: 0, last: 7 });
  const [d, e] = s.drivers.slice(3);
  Object.assign(d, { points: 12, wins: 0, last: 4 });
  Object.assign(e, { points: 12, wins: 0, last: 3 });
  const order = standings(s).map((x) => x.name);
  assert.deepEqual(order.slice(0, 5), [c.name, b.name, a.name, e.name, d.name]);
});

test('o campeonato acaba depois da 5ª corrida, nas pistas do menu', () => {
  const s = fresh();
  buyCar(s, 'micro');
  assert.equal(raceCount(s), 5);
  const tracks = [];
  while (!isOver(s)) {
    tracks.push(nextTrackId(s));
    getTrack(nextTrackId(s)); // a pista existe
    recordRace(s, playerAt(1));
  }
  assert.deepEqual(tracks, ['oito', 'deserto', 'serpente', 'escada', 'triangulo']);
  assert.equal(playerPosition(s), 1);
});

test('passa para o próximo campeonato: até 3º no médio, até 4º no fácil', () => {
  const run = (difficulty, place) => {
    const s = fresh(difficulty);
    buyCar(s, 'micro');
    for (let i = 0; i < 5; i++) recordRace(s, playerAt(place));
    assert.equal(playerPosition(s), place);
    return qualified(s);
  };
  assert.equal(run('medio', 3), true);
  assert.equal(run('medio', 4), false);
  assert.equal(run('facil', 4), true);
  assert.equal(run('dificil', 4), false);
});

test('os adversários e os carros deles são os mesmos do começo ao fim', () => {
  assert.deepEqual(fresh('medio', 7).drivers, fresh('medio', 7).drivers, 'mesma semente, mesmos carros');
  const s = fresh('medio', 7);
  buyCar(s, 'micro');
  const rivals = Object.fromEntries(s.drivers.filter((d) => !d.player).map((d) => [d.name, d.model]));
  assert.deepEqual(Object.keys(rivals).sort(), AI_NAMES.slice().sort());
  for (let i = 0; i < 3; i++) {
    const race = createRace({ track: getTrack(nextTrackId(s)), rng: seededRandom(100 + i), ...raceOptions(s) });
    for (const car of race.cars) {
      if (car.isPlayer) continue;
      assert.equal(car.model, rivals[car.name], `${car.name} trocou de carro`);
      assert.equal(car.color, s.drivers.find((d) => d.name === car.name).color);
    }
    recordRace(s, race.ranking);
  }
});

test('o jogador larga com o carro comprado; a CPU tem as unidades da dificuldade', () => {
  const s = fresh('dificil');
  buyCar(s, 'micro');
  s.car.upgrades.engine = 2;
  const race = createRace({ track: getTrack('oito'), rng: seededRandom(3), ...raceOptions(s) });
  assert.deepEqual(race.player.loadout, { front: ['laser'], rear: null, extra: null });
  assert.equal(race.player.points.speed, 5 + 2);
  for (const car of race.cars.filter((c) => !c.isPlayer)) {
    for (const n of Object.values(car.units)) assert.equal(n, CAREER.cpuUnits.dificil);
  }
  race.player.loadout.front[0] = 'rocket';
  assert.equal(s.car.loadout.front[0], 'laser', 'a corrida não mexe no carro do campeonato');
});

test('save: guarda e devolve o mesmo campeonato; sem save ou save estragado dá null', () => {
  const storage = fakeStorage();
  assert.equal(loadChampionship(storage), null);
  const s = fresh();
  buyCar(s, 'micro');
  recordRace(s, playerAt(2));
  saveChampionship(storage, s);
  assert.deepEqual(loadChampionship(storage), s);

  storage.setItem('minicar.campeonato', '{ estragado');
  assert.equal(loadChampionship(storage), null);
  storage.setItem('minicar.campeonato', JSON.stringify({ ...s, version: 999 }));
  assert.equal(loadChampionship(storage), null);
  saveChampionship(storage, s);
  clearChampionship(storage);
  assert.equal(loadChampionship(storage), null);

  assert.equal(loadChampionship(null), null, 'sem localStorage não quebra');
  assert.doesNotThrow(() => saveChampionship(null, s));
});

test('dinheiro na tela: ponto separando os milhares', () => {
  assert.equal(formatMoney(12000), '$ 12.000');
  assert.equal(formatMoney(1500), '$ 1.500');
  assert.equal(formatMoney(400), '$ 400');
  assert.equal(formatMoney(0), '$ 0');
  assert.equal(formatMoney(1234567), '$ 1.234.567');
  assert.equal(formatMoney(-1150), '-$ 1.150');
});
