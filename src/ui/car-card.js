import { CAR_MODELS, PLAYER } from '../config.js';
import { drawCar, drawCarShadow } from '../render/draw-car.js';
import { el } from './dom.js';

// Medidores do carro, como na loja do jogo original. Uma barrinha cheia vale METER_MAX pontos: os do modelo
// (amarelo) e os das melhorias (verde), até 5 a mais.
const METERS = [['speed', 'Velocidade'], ['accel', 'Aceleração'], ['traction', 'Tração'], ['armor', 'Blindagem']];
const METER_MAX = 13;
const UPGRADE_OF = { speed: 'engine', accel: 'engine', traction: 'tires', armor: 'armor' };

/**
 * Cartão de um carro: desenho na cor do jogador, nome, descrição, medidores e número de armas.
 * `tag` 'div' faz um cartão que não se clica (o carro do campeonato na tela Equipar).
 */
export function carCard(doc, id, { upgrades = {}, tag = 'button' } = {}) {
  const model = CAR_MODELS[id], card = el(doc, tag, 'choice car');
  card.dataset.id = id;
  const add = (t, cls, text) => card.appendChild(el(doc, t, cls, text));
  drawCarPicture(add('canvas', 'car-pic'), id);
  add('b', '', model.name);
  add('span', 'info', model.info);
  for (const [key, label] of METERS) {
    const base = model.points[key], extra = upgrades[UPGRADE_OF[key]] ?? 0;
    const meter = add('span', 'meter');
    meter.append(label, ...Array.from({ length: METER_MAX }, (_, i) => el(doc, 'i', i < base ? 'on' : i < base + extra ? 'up' : '')));
  }
  const front = model.slots.front;
  add('span', 'stat', `${front} ${front > 1 ? 'armas' : 'arma'} de frente`);
  return card;
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
