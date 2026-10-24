import { CAR_MODELS, CAREER } from '../config.js';
import { formatMoney } from '../core/format.js';
import {
  canBuyCar, carValue, championshipOf, nextTrackId, playerPosition, raceCount, standings,
} from '../career/championship.js';
import { TRACKS } from '../sim/tracks/index.js';
import { carCard } from './car-card.js';
import { el, tableRow } from './dom.js';

const DIFFICULTY_NAMES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

/** As telas do campeonato: garagem (entre as corridas), concessionária e classificação final. */
export function createCareerScreens(doc) {
  const $ = (id) => doc.getElementById(id);
  let onBuy = () => {};

  // Classificação: posição, nome, carro, vitórias, posição na última corrida e pontos. O jogador fica marcado.
  function fillStandings(body, state) {
    body.replaceChildren(...standings(state).map((d, i) => {
      const model = d.player ? state.car?.model : d.model;
      return tableRow(doc, [`${i + 1}º`, d.name, CAR_MODELS[model]?.name ?? '—', d.wins, d.last ? `${d.last}º` : '—', d.points], d.player ? 'me' : '');
    }));
  }

  return {
    showGarage(state) {
      const track = TRACKS.find((t) => t.id === nextTrackId(state));
      $('garTitle').textContent = championshipOf(state).name;
      $('garMoney').textContent = formatMoney(state.money);
      $('garSub').textContent = `Corrida ${state.race + 1} de ${raceCount(state)} · ${track.name} · ${DIFFICULTY_NAMES[state.difficulty]}`;
      fillStandings($('garBody'), state);
      $('garInfo').textContent = `Seu carro: ${CAR_MODELS[state.car.model].name}, que vale ${formatMoney(carValue(state.car))} na troca. `
        + `No fim, os ${CAREER.qualify[state.difficulty]} primeiros passam para o próximo campeonato.`;
    },

    /** Os carros à venda, com preço e o que sobra (ou falta) contando a venda do carro atual. */
    showDealer(state) {
      const sale = carValue(state.car);
      $('dealMoney').textContent = formatMoney(state.money);
      $('dealSub').textContent = state.car
        ? `O seu ${CAR_MODELS[state.car.model].name} vale ${formatMoney(sale)} na troca, com tudo o que está nele.`
        : 'Escolha o seu primeiro carro. Ele vem com 1 laser; o resto você compra na tela Equipar.';
      $('dealCars').replaceChildren(...Object.keys(CAR_MODELS).map((id) => {
        const price = CAR_MODELS[id].price, card = carCard(doc, id);
        const left = state.money + sale - price;
        card.append(
          el(doc, 'span', 'price', formatMoney(price)),
          el(doc, 'span', 'status', state.car?.model === id ? 'Seu carro' : left >= 0 ? `Sobram ${formatMoney(left)}` : `Faltam ${formatMoney(-left)}`),
        );
        card.classList.toggle('on', state.car?.model === id);
        card.disabled = state.car?.model !== id && !canBuyCar(state, id); // o seu fica aceso, mas não compra
        card.addEventListener('click', () => onBuy(id));
        return card;
      }));
      $('dealBackBtn').firstChild.textContent = state.car ? 'Garagem ' : 'Menu ';
    },

    showFinal(state, qualified) {
      const place = playerPosition(state);
      $('finTitle').textContent = qualified ? 'Classificado para o Campeonato 2!' : 'Não foi dessa vez';
      $('finSub').textContent = qualified
        ? `Você terminou em ${place}º. O Campeonato 2 vem em breve.`
        : `Você terminou em ${place}º, e só os ${CAREER.qualify[state.difficulty]} primeiros passam. Tente de novo!`;
      fillStandings($('finBody'), state);
      $('finAgainBtn').firstChild.textContent = qualified ? 'Novo campeonato ' : 'Tentar de novo ';
    },

    /** Liga os botões às ações do jogo. */
    bind({ equip, dealer, menu, buy, back, again }) {
      onBuy = buy;
      $('garRaceBtn').addEventListener('click', equip);
      $('garDealerBtn').addEventListener('click', dealer);
      $('garMenuBtn').addEventListener('click', menu);
      $('dealBackBtn').addEventListener('click', back);
      $('finAgainBtn').addEventListener('click', again);
      $('finMenuBtn').addEventListener('click', menu);
    },
  };
}
