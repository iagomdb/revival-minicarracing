import { buyCar, canBuyCar, carValue, createChampionship, isOver, nextTrackId, qualified, raceOptions, recordRace } from './career/championship.js';
import { buyUnit, buyUpgrade, sellUnit, sellUpgrade, slotWeapon } from './career/shop.js';
import { clearChampionship, loadChampionship, saveChampionship } from './career/storage.js';
import { CAR_MODELS, WEAPONS } from './config.js';
import { formatMoney } from './core/format.js';

/**
 * O campeonato do lado das telas: começar ou continuar, garagem, concessionária, loja e o fim de cada
 * corrida. As regras ficam em src/career/; aqui só se decide que tela mostrar e quando salvar.
 * `go` são as ações do jogo: `screen(nome)` troca de tela, `demo(trackId)` põe a corrida de fundo numa
 * pista e `race(opções)` larga uma corrida. `ask(texto)` pede uma confirmação ao jogador.
 */
export function createCareerMode({ screens, storage, go, ask }) {
  let state = null;
  const save = () => saveChampionship(storage, state);

  // Entre as corridas. Sem carro, vai para a concessionária; depois da última corrida, para o resultado final.
  function garage() {
    if (!state.car) return dealer();
    if (isOver(state)) return final();
    go.demo(nextTrackId(state)); // a corrida de fundo mostra a próxima pista
    screens.showGarage(state);
    go.screen('garage');
  }

  function dealer() {
    screens.showDealer(state);
    go.screen('dealer');
  }

  function final() {
    clearChampionship(storage);
    screens.showFinal(state, qualified(state));
    go.screen('final');
  }

  // Campeonato novo, na dificuldade do menu. Apagar um campeonato salvo pede confirmação.
  function start(difficulty) {
    if (loadChampionship(storage) && !ask('Começar um campeonato novo? O campeonato salvo será apagado.')) return;
    state = createChampionship({ difficulty });
    save();
    dealer();
  }

  return {
    get active() { return state !== null; },
    hasSave: () => loadChampionship(storage) !== null,
    hasCar: () => Boolean(state?.car),
    start,
    garage,
    dealer,

    /** Continua o campeonato salvo; sem save, começa um. */
    open(difficulty) {
      state = loadChampionship(storage);
      if (state) garage();
      else start(difficulty);
    },

    /** Saiu para o menu: o save fica, e o jogo volta à corrida rápida. */
    leave() { state = null; },

    buyCar(model) {
      const old = state.car;
      if (!canBuyCar(state, model)) return;
      if (old && !ask(`Vender o ${CAR_MODELS[old.model].name} por ${formatMoney(carValue(old))}, com tudo o que está nele, e comprar o ${CAR_MODELS[model].name}?`)) return;
      buyCar(state, model);
      save();
      garage();
    },

    equip() {
      screens.showShop(state);
      go.screen('loadout');
    },

    /** Clicou numa arma: entra no encaixe vazio ou troca a que está lá (as unidades dela são vendidas). */
    pick(slot, id) {
      const car = state.car, current = slotWeapon(car.loadout, slot);
      if (current === id) return;
      if (current && !ask(`Vender ${car.units[current]}× ${WEAPONS[current].name} e pôr ${WEAPONS[id].name} no lugar?`)) return;
      if (buyUnit(state, slot, id)) save();
      screens.showShop(state);
    },

    units(slot, delta) {
      const id = slotWeapon(state.car.loadout, slot);
      if (id && (delta > 0 ? buyUnit(state, slot, id) : sellUnit(state, slot))) save();
      screens.showShop(state);
    },

    upgrade(key, delta) {
      if (delta > 0 ? buyUpgrade(state, key) : sellUpgrade(state, key)) save();
      screens.showShop(state);
    },

    race() {
      go.race({ track: nextTrackId(state), ...raceOptions(state) });
    },

    /** Fim da corrida: os pontos e o dinheiro entram na hora, e o jogo salva. Sair antes disso não conta. */
    raceOver(race) {
      const result = recordRace(state, race.ranking);
      save();
      screens.showResults(race, { result, state });
    },
  };
}
