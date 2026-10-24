import { roundCorners } from '../track.js';

// Pista em oito: dois quadrados lado a lado, ligados por um X no meio, sem ponte.
// O carro contorna o quadrado da esquerda, desce pelo X, contorna o da direita e volta pelo X.
// Cada canto é [x, y, raio da curva]; o y cresce para baixo. A largada fica no meio do lado esquerdo.
const S = 880;      // lado de cada quadrado (px)
const CORNER = 160; // raio dos cantos de 90°
const BEND = 250;   // raio das dobras de 45° na entrada e na saída do X

export default {
  id: 'oito',
  name: 'Oito',
  ground: 'grass',
  width: 280,         // largura do asfalto (px): o dobro da pista normal
  startAt: 0,
  points: roundCorners([
    [0, 360],                  // largada, subindo
    [0, 0, CORNER],
    [S, 0, BEND],              // desce pelo X
    [2 * S, S, BEND],
    [3 * S, S, CORNER],
    [3 * S, 0, CORNER],
    [2 * S, 0, BEND],          // desce pelo X de novo, pelo outro braço
    [S, S, BEND],
    [0, S, CORNER],
  ]),
};
