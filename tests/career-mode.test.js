import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_NAMES } from '../src/config.js';
import { createCareerMode } from '../src/career-mode.js';
import { loadChampionship } from '../src/career/storage.js';

// O fluxo de telas do campeonato, com telas e jogo de mentira: cada chamada fica anotada em `log`.
function setup({ answer = true } = {}) {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const log = [], races = [];
  const screens = new Proxy({}, { get: (_, name) => (...args) => log.push(name) });
  const go = { screen: (name) => log.push(`>${name}`), demo: (id) => log.push(`demo:${id}`), race: (opts) => races.push(opts) };
  const career = createCareerMode({ screens, storage, go, ask: () => answer });
  return { career, storage, log, races, screen: () => log.filter((l) => l.startsWith('>')).at(-1) };
}

// Uma chegada de mentira com o jogador na posição `place`.
const ranking = (place) => {
  const order = AI_NAMES.map((name) => ({ name, isPlayer: false, extras: 0 }));
  order.splice(place - 1, 0, { name: 'Você', isPlayer: true, extras: 200 });
  return { ranking: order };
};

test('campeonato inteiro: concessionária, garagem, 5 corridas e o resultado final', () => {
  const { career, storage, races, screen } = setup();
  career.open('medio');
  assert.equal(screen(), '>dealer', 'sem save: começa um campeonato e vai comprar o carro');
  assert.ok(career.active);
  career.buyCar('arsenal');
  assert.equal(screen(), '>dealer', 'não dá para o Arsenal');
  career.buyCar('micro');
  assert.equal(screen(), '>garage');
  assert.equal(loadChampionship(storage).money, 1500, 'salvou depois da compra');

  career.equip();
  assert.equal(screen(), '>loadout');
  career.units('front0', +1);
  assert.equal(loadChampionship(storage).car.units.laser, 2, 'salvou a compra na loja');

  for (let i = 0; i < 5; i++) {
    career.race();
    career.raceOver(ranking(1));
    career.garage();
  }
  assert.deepEqual(races.map((r) => r.track), ['oito', 'deserto', 'serpente', 'escada', 'triangulo']);
  assert.equal(screen(), '>final');
  assert.equal(loadChampionship(storage), null, 'o save some no fim');
});

test('sair para o menu guarda o campeonato; "continuar" volta para a garagem', () => {
  const { career, storage, screen } = setup();
  career.open('dificil');
  career.buyCar('flecha');
  career.race();
  career.raceOver(ranking(4));
  career.leave();
  assert.ok(!career.active);
  assert.ok(career.hasSave());
  career.open('facil');
  assert.equal(screen(), '>garage');
  const saved = loadChampionship(storage);
  assert.equal(saved.difficulty, 'dificil', 'a dificuldade é a do começo do campeonato');
  assert.equal(saved.race, 1);
});

test('abandonar a corrida não conta: a garagem continua na mesma pista', () => {
  const { career, races } = setup();
  career.open('medio');
  career.buyCar('micro');
  career.race();
  career.garage(); // saiu pela pausa
  career.race();
  assert.equal(races[0].track, races[1].track);
});

test('começar outro campeonato com um salvo pede confirmação', () => {
  const no = setup({ answer: false });
  no.career.open('medio');
  no.career.buyCar('micro');
  no.career.leave();
  no.career.start('facil');
  assert.equal(loadChampionship(no.storage).car.model, 'micro', 'disse não: o save fica');

  const yes = setup({ answer: true });
  yes.career.open('medio');
  yes.career.buyCar('micro');
  yes.career.start('facil');
  assert.equal(loadChampionship(yes.storage).car, null, 'disse sim: campeonato novo, sem carro');
});
