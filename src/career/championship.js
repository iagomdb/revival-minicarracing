import { AI_COLORS, AI_NAMES, CAR_MODELS, CAREER, CHAMPIONSHIPS, PLAYER, PRIZES, WEAPONS } from '../config.js';
import { pick } from '../core/math.js';
import { equipmentValue, resale } from './shop.js';

// Muda quando o formato do save muda: um save de outra versão é ignorado.
export const SAVE_VERSION = 1;

/**
 * Um campeonato novo: dinheiro inicial, ainda sem carro, e os 8 pilotos zerados. Os 7 adversários são
 * sempre os mesmos, cada um com um carro sorteado que ele usa até o fim.
 * `race` é o índice da próxima corrida; `last`, a posição de cada piloto na última corrida.
 */
export function createChampionship({ difficulty = 'medio', rng = Math.random, id = CHAMPIONSHIPS[0].id } = {}) {
  const driver = (name, color, model, player = false) => ({ name, color, model, player, points: 0, wins: 0, last: 0 });
  return {
    version: SAVE_VERSION, id, difficulty,
    money: CAREER.startMoney, car: null, race: 0,
    drivers: [
      driver(PLAYER.name, PLAYER.color, null, true),
      ...AI_NAMES.map((name, i) => driver(name, AI_COLORS[i], pick(rng, Object.keys(CAR_MODELS)))),
    ],
  };
}

export const championshipOf = (state) => CHAMPIONSHIPS.find((c) => c.id === state.id);
export const raceCount = (state) => championshipOf(state).tracks.length;
export const nextTrackId = (state) => championshipOf(state).tracks[state.race];
export const isOver = (state) => state.race >= raceCount(state);

/** Carro saído da concessionária: 1 unidade da arma inicial na Arma 1, o resto vazio, sem melhorias. */
export function newCar(model) {
  const front = Array(CAR_MODELS[model].slots.front).fill(null);
  front[0] = CAREER.starterWeapon;
  return {
    model,
    upgrades: { engine: 0, tires: 0, armor: 0 },
    loadout: { front, rear: null, extra: null },
    units: { [CAREER.starterWeapon]: 1 },
  };
}

/**
 * Quanto o carro vale na venda: metade do preço dele e metade do que está instalado nele. A arma inicial
 * vem incluída no preço, então não conta duas vezes: o Micro com o laser de fábrica vale $ 5.250.
 */
export const carValue = (car) =>
  (car ? resale(CAR_MODELS[car.model].price - WEAPONS[CAREER.starterWeapon].price) + equipmentValue(car) : 0);

export const canBuyCar = (state, model) =>
  state.car?.model !== model && state.money + carValue(state.car) >= CAR_MODELS[model].price;

/** Compra um carro. Quem já tem um vende o atual, com tudo o que está nele, na mesma hora. */
export function buyCar(state, model) {
  if (!canBuyCar(state, model)) return false;
  state.money += carValue(state.car) - CAR_MODELS[model].price;
  state.car = newCar(model);
  return true;
}

/** Classificação: mais pontos, depois mais vitórias, depois melhor posição na última corrida. */
export function standings(state) {
  const last = (d) => d.last || 99;
  return state.drivers.slice().sort((a, b) => b.points - a.points || b.wins - a.wins || last(a) - last(b));
}

/** Posição do jogador na classificação (1 = líder). */
export const playerPosition = (state) => standings(state).findIndex((d) => d.player) + 1;

/** Passou para o próximo campeonato: acabou, e o jogador ficou entre os primeiros da dificuldade. */
export const qualified = (state) => isOver(state) && playerPosition(state) <= CAREER.qualify[state.difficulty];

/**
 * Registra uma corrida terminada. `ranking`: os carros na ordem de chegada, como `race.ranking`
 * ({ name, isPlayer, extras }). Todos ganham os pontos da posição; o jogador também ganha o prêmio e os
 * extras (sacos de dinheiro e abates). Devolve o que o jogador ganhou.
 */
export function recordRace(state, ranking) {
  let result = null;
  ranking.forEach((car, i) => {
    const d = state.drivers.find((x) => (car.isPlayer ? x.player : !x.player && x.name === car.name));
    if (!d) return;
    const points = CAREER.points[i] ?? 0;
    d.points += points;
    d.last = i + 1;
    if (i === 0) d.wins++;
    if (d.player) {
      const prize = PRIZES[i] ?? 0;
      state.money += prize + car.extras;
      result = { place: i + 1, points, prize, extras: car.extras, earned: prize + car.extras };
    }
  });
  state.race++;
  return result;
}

/** O que `createRace` precisa para a próxima corrida, menos a pista (o jogo monta pelo `nextTrackId`). */
export function raceOptions(state) {
  const { model, loadout, upgrades, units } = state.car;
  return {
    difficulty: state.difficulty,
    playerCar: model, playerLoadout: loadout, playerUpgrades: upgrades, playerUnits: units,
    rivals: state.drivers.filter((d) => !d.player).map((d) => ({ name: d.name, color: d.color, model: d.model })),
    cpuUnits: CAREER.cpuUnits[state.difficulty] ?? 1,
  };
}
