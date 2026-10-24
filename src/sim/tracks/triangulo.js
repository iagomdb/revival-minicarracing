import { roundCorners } from '../track.js';

// Triângulo: a base é uma reta comprida, e os outros dois lados têm uma dobra para dentro no meio.
// Os três cantos do triângulo são curvas fechadas, quase grampos.
// Cada canto é [x, y, raio da curva]; o y cresce para baixo. A largada fica na base.
const HAIRPIN = 220; // raio dos dois cantos da base
const TOP = 240;     // raio do canto de cima
const DENT = 450;    // raio das dobras no meio dos lados

export default {
  id: 'triangulo',
  name: 'Triângulo',
  ground: 'dirt',
  width: 280,
  startAt: 0,
  points: roundCorners([
    [1300, 2300],              // largada, indo para a direita
    [3600, 2300, HAIRPIN],
    [2370, 1410, DENT],        // dobra: 420 px para dentro do meio do lado
    [1800, 0, TOP],
    [1230, 1410, DENT],
    [0, 2300, HAIRPIN],
  ]),
};
