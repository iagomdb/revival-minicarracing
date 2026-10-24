import { roundCorners } from '../track.js';

// Escada: uma reta comprida embaixo, a subida pela direita e a volta descendo em degraus.
// Os degraus viram curvas de 90° para os dois lados, e a ponta da esquerda é um grampo.
// Cada canto é [x, y, raio da curva]; o y cresce para baixo. A largada fica na reta de baixo.
const CORNER = 240; // raio de todos os cantos

export default {
  id: 'escada',
  name: 'Escada',
  ground: 'snow',
  width: 280,
  startAt: 0,
  points: roundCorners([
    [900, 1600],               // largada, indo para a direita
    [2600, 1600, CORNER],
    [2600, 0, CORNER],
    [1900, 0, CORNER],         // primeiro degrau
    [1900, 600, CORNER],
    [1200, 600, CORNER],       // segundo degrau
    [1200, 1100, CORNER],
    [0, 1100, CORNER],         // grampo
    [0, 1600, CORNER],
  ]),
};
