import { roundCorners } from '../track.js';

// Serpente: um retângulo com uma reta comprida embaixo e, no lado de cima, um zigue-zague de curvas em S.
// Cada canto é [x, y, raio da curva]; o y cresce para baixo. A largada fica na reta de baixo.
const CORNER = 260; // raio dos quatro cantos de 90°
const S_BEND = 200; // raio das curvas do zigue-zague
const EASE = 260;   // raio das dobras suaves na entrada e na saída do zigue-zague

export default {
  id: 'serpente',
  name: 'Serpente',
  ground: 'grass',
  width: 280,
  startAt: 0,
  points: roundCorners([
    [900, 1300],               // largada, indo para a direita
    [2700, 1300, CORNER],
    [2700, 300, CORNER],
    [2200, 300, EASE],         // começa o zigue-zague
    [1800, 900, S_BEND],
    [1400, 300, S_BEND],
    [1000, 900, S_BEND],
    [600, 300, EASE],          // acaba o zigue-zague
    [0, 300, CORNER],
    [0, 1300, CORNER],
  ]),
};
