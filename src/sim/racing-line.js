import { RACING_LINE, WALL_MARGIN } from '../config.js';
import { clamp } from '../core/math.js';

// O traçado e as faixas da CPU ficam a esta distância da mureta: a margem do centro do carro mais uma folga.
const EDGE = WALL_MARGIN + 12;
// Cada rodada de ajuste compara pontos a `h` pontos de distância: primeiro longe, para acertar a curva
// inteira, depois perto, para acabar os detalhes.
const PASSES = [16, 8, 4, 2, 1];
const ROUNDS = 100;
const CURVE_SPAN = 6; // pontos de cada lado usados para medir a curva do traçado (como o raio em track.js)

/** Quanto a CPU pode se afastar da linha central (px) sem raspar na mureta. */
export const laneLimit = (track) => Math.max(0, track.half - EDGE);

/** Quanto o traçado de corrida se afasta da linha central, no máximo (px): a parte da largura em `RACING_LINE`. */
export const lineLimit = (track) => laneLimit(track) * RACING_LINE.width;

const lines = new WeakMap();

/**
 * Traçado de corrida: para cada ponto da pista, quanto andar para o lado (px, positivo = direita) para
 * fazer as curvas o mais abertas possível. Ele abre antes da curva, tangencia o lado de dentro e abre de
 * novo na saída, como um piloto faz. É calculado uma vez por pista.
 */
export const racingLine = (track) => lineOf(track).off;

/** Curvatura do traçado em cada ponto (1/raio, em 1/px). Positiva: curva para a direita, com o lado de dentro à direita. */
export const lineCurvature = (track) => lineOf(track).curv;

function lineOf(track) {
  if (!lines.has(track)) {
    const off = buildLine(track), { pts, nrm, N } = track;
    const x = (i) => pts[i].x + nrm[i].x * off[i], y = (i) => pts[i].y + nrm[i].y * off[i];
    const curv = off.map((_, i) => {
      const a = (i - CURVE_SPAN + N) % N, c = (i + CURVE_SPAN) % N;
      return curvature(x(a), y(a), x(i), y(i), x(c), y(c));
    });
    lines.set(track, { off, curv });
  }
  return lines.get(track);
}

// Método do K1999 (um piloto automático de corrida): começando na linha central, cada ponto vai para onde
// a curvatura dele fica igual à média das curvaturas dos vizinhos, sem passar de `lineLimit`. Rodada
// após rodada, a curva se espalha pela largura permitida e fica o mais aberta possível.
function buildLine(track) {
  const { pts, nrm, N } = track, limit = lineLimit(track);
  const off = new Float64Array(N), xs = Float64Array.from(pts, (p) => p.x), ys = Float64Array.from(pts, (p) => p.y);
  const bend = (a, b, c) => curvature(xs[a], ys[a], xs[b], ys[b], xs[c], ys[c]);
  for (const h of PASSES) {
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < N; i++) {
        const pp = (i - 2 * h + N) % N, p = (i - h + N) % N, n = (i + h) % N, nn = (i + 2 * h) % N;
        const want = (bend(pp, p, i) + bend(i, n, nn)) / 2;
        // Em cima da reta entre os dois vizinhos a curvatura é zero; de lá, ela cresce quase em linha reta
        // conforme o ponto vai para o lado. `flat` é esse ponto, e `perPx`, quanto ela cresce por px.
        const dx = xs[n] - xs[p], dy = ys[n] - ys[p], cross = nrm[i].x * dy - nrm[i].y * dx;
        if (Math.abs(cross) < 1e-9) continue;
        const flat = ((xs[p] - pts[i].x) * dy - (ys[p] - pts[i].y) * dx) / cross;
        const sx = pts[i].x + nrm[i].x * (flat + 1), sy = pts[i].y + nrm[i].y * (flat + 1);
        const perPx = curvature(xs[p], ys[p], sx, sy, xs[n], ys[n]);
        if (Math.abs(perPx) < 1e-12) continue;
        off[i] = clamp(flat + want / perPx, -limit, limit);
        xs[i] = pts[i].x + nrm[i].x * off[i];
        ys[i] = pts[i].y + nrm[i].y * off[i];
      }
    }
  }
  return Array.from(off);
}

// Curvatura com sinal (1/raio) do círculo que passa pelos pontos a, b e c.
function curvature(ax, ay, bx, by, cx, cy) {
  const x1 = cx - bx, y1 = cy - by, x2 = ax - bx, y2 = ay - by, x3 = cx - ax, y3 = cy - ay;
  const size = Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2) * (x3 * x3 + y3 * y3));
  return size > 1e-9 ? (2 * (x1 * y2 - x2 * y1)) / size : 0;
}
