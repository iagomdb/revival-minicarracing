import { CAR_MODELS, PLAYER, PRIZES, WEAPONS } from '../config.js';
import { formatTime } from '../core/format.js';
import { drawCar, drawCarShadow } from '../render/draw-car.js';
import { weaponsFor } from '../sim/loadout.js';
import { TRACKS } from '../sim/tracks/index.js';

// Encaixe da tela de equipar → tipo de arma que cabe nele.
const SLOT_KIND = { front0: 'front', front1: 'front', rear: 'rear', extra: 'extra' };
// Medidores do carro, como na loja do jogo original. Uma barrinha cheia vale METER_MAX pontos.
const METERS = [['speed', 'Velocidade'], ['accel', 'Aceleração'], ['traction', 'Tração'], ['armor', 'Blindagem']];
const METER_MAX = 10;

// Botão de um carro: desenho na cor do jogador, nome, descrição, medidores e número de armas.
function carButton(doc, id) {
  const model = CAR_MODELS[id], button = doc.createElement('button');
  button.className = 'choice car';
  button.dataset.id = id;
  const add = (tag, cls, text) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return button.appendChild(el);
  };
  drawCarPicture(add('canvas', 'car-pic'), id);
  add('b', '', model.name);
  add('span', 'info', model.info);
  for (const [key, label] of METERS) {
    const meter = add('span', 'meter');
    meter.append(label, ...Array.from({ length: METER_MAX }, (_, i) => {
      const bit = doc.createElement('i');
      if (i < model.points[key]) bit.className = 'on';
      return bit;
    }));
  }
  const front = model.slots.front;
  add('span', 'stat', `${front} ${front > 1 ? 'armas' : 'arma'} de frente`);
  return button;
}

function drawCarPicture(canvas, model) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = 160;  // o dobro do tamanho na tela, para ficar nítido
  canvas.height = 96;
  ctx.setTransform(2.6, 0, 0, 2.6, 76, 44); // 2 × 1,3 (um pouco maior que na pista), com o carro no meio
  const car = { model, color: PLAYER.color, x: 0, y: 0, a: 0, invuln: 0, nitroT: 0 };
  drawCarShadow(ctx, car);
  drawCar(ctx, car);
}

/** "60 de dano · 2 por volta" */
function weaponStats(w) {
  const dmg = w.shot?.damage ?? w.mine?.damage;
  return `${dmg ? `${dmg} de dano` : 'sem dano'} · ${w.ammo} por volta`;
}

const selectedIn = (loadout, slot) =>
  slot === 'front0' ? loadout.front[0] : slot === 'front1' ? loadout.front[1] : loadout[slot];

/** As telas em HTML por cima do jogo: menu, equipar, pausa e resultado. */
export function createScreens(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const overlays = { menu: $('menu'), loadout: $('loadout'), pause: $('pause'), results: $('results') };
  const diffButtons = [...doc.querySelectorAll('#diff button')];
  // Um botão por pista do registro, na mesma ordem.
  const trackButtons = TRACKS.map((t) => {
    const button = doc.createElement('button');
    button.dataset.t = t.id;
    button.textContent = t.name;
    return button;
  });
  $('tracks').replaceChildren(...trackButtons);
  const carButtons = Object.keys(CAR_MODELS).map((id) => carButton(doc, id));
  $('cars').replaceChildren(...carButtons);
  const slotBoxes = [...doc.querySelectorAll('#loadout [data-slot]')];
  let onPick = () => {}, onCar = () => {};
  for (const b of carButtons) b.addEventListener('click', () => onCar(b.dataset.id));

  // Um botão por arma em cada encaixe; o clique avisa o jogo, que devolve o equipamento atualizado.
  for (const box of slotBoxes) {
    const slot = box.dataset.slot;
    box.replaceChildren(...weaponsFor(SLOT_KIND[slot]).map((id) => {
      const w = WEAPONS[id], button = doc.createElement('button');
      button.className = 'choice';
      button.dataset.id = id;
      for (const [tag, cls, text] of [['b', '', w.name], ['span', 'stat', weaponStats(w)], ['span', 'info', w.info]]) {
        const el = doc.createElement(tag);
        if (cls) el.className = cls;
        el.textContent = text;
        button.append(el);
      }
      button.addEventListener('click', () => onPick(slot, id));
      return button;
    }));
  }

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

    /** Marca o carro e as armas escolhidas. Encaixe que o carro não tem (a Arma 2 num carro de 1 arma) some. */
    showLoadout(loadout, car) {
      for (const b of carButtons) b.classList.toggle('on', b.dataset.id === car);
      for (const box of slotBoxes) {
        const chosen = selectedIn(loadout, box.dataset.slot);
        box.parentElement.hidden = !chosen;
        for (const b of box.children) b.classList.toggle('on', b.dataset.id === chosen);
      }
    },

    showResults(race) {
      const p = race.player;
      const rows = race.ranking.map((car, i) => {
        const prize = PRIZES[i] ?? 0;
        const tr = doc.createElement('tr');
        if (car === p) tr.className = 'me';
        for (const value of [`${i + 1}º`, car.name, car.kills, car.accidents, car.extras, prize, prize + car.extras]) {
          const td = doc.createElement('td');
          td.textContent = value;
          tr.append(td);
        }
        return tr;
      });
      $('resBody').replaceChildren(...rows);
      $('resTitle').textContent = p.place === 1 ? 'Vitória!' : `Você chegou em ${p.place}º`;
      const best = p.bestLap ? formatTime(p.bestLap) : '—';
      $('resInfo').textContent = `Tempo total ${formatTime(p.finishTime)} · melhor volta ${best} · você ganhou $ ${(PRIZES[p.place - 1] ?? 0) + p.extras}`;
      this.show('results');
    },

    /** Liga os botões às ações do jogo. */
    bind({ equip, race, resume, restart, quit, difficulty, track, car, pick }) {
      onPick = pick;
      onCar = car;
      for (const b of diffButtons) b.addEventListener('click', () => difficulty(b.dataset.d));
      for (const b of trackButtons) b.addEventListener('click', () => track(b.dataset.t));
      $('startBtn').addEventListener('click', equip);
      $('againBtn').addEventListener('click', equip);
      $('goBtn').addEventListener('click', race);
      $('backBtn').addEventListener('click', quit);
      $('resumeBtn').addEventListener('click', resume);
      $('restartBtn').addEventListener('click', restart);
      $('quitBtn').addEventListener('click', quit);
      $('menuBtn').addEventListener('click', quit);
    },
  };
}
