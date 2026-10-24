import { PRIZES } from '../config.js';
import { formatMoney, formatTime, groupThousands } from '../core/format.js';
import { TRACKS } from '../sim/tracks/index.js';
import { createCareerScreens } from './career-screens.js';
import { tableRow } from './dom.js';
import { createLoadoutScreen } from './loadout-screen.js';

const OVERLAYS = ['menu', 'loadout', 'pause', 'results', 'garage', 'dealer', 'final'];

/**
 * As telas em HTML por cima do jogo: menu, equipar, pausa e resultado, mais as do campeonato
 * (`career-screens.js`). A tela Equipar fica em `loadout-screen.js`.
 */
export function createScreens(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const overlays = Object.fromEntries(OVERLAYS.map((id) => [id, $(id)]));
  const diffButtons = [...doc.querySelectorAll('#diff button')];
  // Um botão por pista do registro, na mesma ordem.
  const trackButtons = TRACKS.map((t) => {
    const button = doc.createElement('button');
    button.dataset.t = t.id;
    button.textContent = t.name;
    return button;
  });
  $('tracks').replaceChildren(...trackButtons);
  const loadout = createLoadoutScreen(doc);
  const career = createCareerScreens(doc);
  // Muda o texto de um botão sem apagar a tecla dele (o <small>).
  const label = (id, text) => { $(id).firstChild.textContent = `${text} `; };

  return {
    /** Mostra uma tela (ou nenhuma, com `null`). */
    show(name) {
      for (const [key, el] of Object.entries(overlays)) el.classList.toggle('hidden', key !== name);
      // Um botão com foco "clicaria" de novo ao apertar Espaço (o nitro).
      doc.activeElement?.blur?.();
    },

    setDifficulty(key) {
      for (const b of diffButtons) b.classList.toggle('on', b.dataset.d === key);
    },

    setTrack(id) {
      for (const b of trackButtons) b.classList.toggle('on', b.dataset.t === id);
    },

    /** Com um campeonato salvo, o botão vira "Continuar campeonato" e aparece o de começar outro. */
    setChampionship(saved) {
      label('champBtn', saved ? 'Continuar campeonato' : 'Campeonato');
      $('newChampBtn').hidden = !saved;
    },

    /** No campeonato, a pausa e o resultado levam de volta à garagem em vez do menu. */
    setChampionshipRace(champ) {
      label('quitBtn', champ ? 'Voltar à garagem' : 'Voltar ao menu');
      label('againBtn', champ ? 'Continuar' : 'Correr de novo');
      $('menuBtn').hidden = champ;
    },

    showLoadout: loadout.showLoadout,
    showShop: loadout.showShop,
    showGarage: career.showGarage,
    showDealer: career.showDealer,
    showFinal: career.showFinal,

    /** `champ` ({ result, state }): o que a corrida rendeu no campeonato. */
    showResults(race, champ = null) {
      const p = race.player;
      $('resBody').replaceChildren(...race.ranking.map((car, i) => {
        const prize = PRIZES[i] ?? 0;
        const values = [`${i + 1}º`, car.name, car.kills, car.accidents, groupThousands(car.extras), groupThousands(prize), groupThousands(prize + car.extras)];
        return tableRow(doc, values, car === p ? 'me' : '');
      }));
      $('resTitle').textContent = p.place === 1 ? 'Vitória!' : `Você chegou em ${p.place}º`;
      const best = p.bestLap ? formatTime(p.bestLap) : '—';
      const won = (PRIZES[p.place - 1] ?? 0) + p.extras;
      $('resInfo').textContent = `Tempo total ${formatTime(p.finishTime)} · melhor volta ${best} · você ganhou ${formatMoney(won)}`
        + (champ ? ` e ${champ.result.points} pontos · agora você tem ${formatMoney(champ.state.money)}` : '');
      this.show('results');
    },

    /** Liga os botões às ações do jogo. */
    bind(on) {
      loadout.bind({ car: on.car, pick: on.pick, units: on.units, upgrade: on.upgrade });
      career.bind({ equip: on.equip, dealer: on.dealer, menu: on.menu, buy: on.buy, back: on.back, again: on.newChampionship });
      for (const b of diffButtons) b.addEventListener('click', () => on.difficulty(b.dataset.d));
      for (const b of trackButtons) b.addEventListener('click', () => on.track(b.dataset.t));
      $('startBtn').addEventListener('click', on.quickRace);
      $('champBtn').addEventListener('click', on.championship);
      $('newChampBtn').addEventListener('click', on.newChampionship);
      $('againBtn').addEventListener('click', on.again);
      $('goBtn').addEventListener('click', on.race);
      $('backBtn').addEventListener('click', on.back);
      $('resumeBtn').addEventListener('click', on.resume);
      $('restartBtn').addEventListener('click', on.restart);
      $('quitBtn').addEventListener('click', on.quit);
      $('menuBtn').addEventListener('click', on.menu);
    },
  };
}
