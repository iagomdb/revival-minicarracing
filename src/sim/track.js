import { TRACK_HALF, TRACK_SPACING } from '../config.js';
import { angDiff, clamp } from '../core/math.js';

const SAMPLES_PER_SEGMENT = 50;
const TURN_WINDOW = 25; // pontos (~250 px) olhados à frente para medir quanto a pista vira
const RADIUS_SPAN = 6;  // pontos de cada lado usados para medir o raio da curva
const MAX_RADIUS = 5000;
const SAME_STRETCH = 60; // pontos (~600 px) de cada lado que ainda contam como o mesmo trecho da pista
const ARC_STEP = Math.PI / 8; // um ponto de controle a cada 22,5° nos cantos arredondados

/**
 * Monta a pista: suaviza os pontos de controle e reamostra a linha central com espaçamento fixo.
 * Assim o índice de um ponto também mede a distância percorrida na volta.
 */
export function createTrack({ id, name, ground = 'sand', points, scale = 1, startAt = 0 }) {
  const ctrl = points.map(([x, y]) => ({ x: x * scale, y: y * scale }));
  const pts = rotateToStart(resample(catmullRom(ctrl), TRACK_SPACING), ctrl[startAt]);
  const N = pts.length;

  const ang = [], nrm = [];
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    ang.push(Math.atan2(dy, dx));
    nrm.push({ x: -dy / len, y: dx / len }); // lado direito de quem anda na pista
  }
  const bend = ang.map((a, i) => Math.abs(angDiff(ang[(i + 1) % N], a)));
  const turn = bend.map((_, i) => {
    let sum = 0;
    for (let j = 0; j < TURN_WINDOW; j++) sum += bend[(i + j) % N];
    return sum;
  });
  const radius = pts.map((_, i) => curveRadius(pts[(i - RADIUS_SPAN + N) % N], pts[i], pts[(i + RADIUS_SPAN) % N]));

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const ext = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const track = { id, name, ground, pts, N, ang, nrm, turn, radius, ext, half: TRACK_HALF };
  // Cruzamento (o X do Oito): pontos que têm outro trecho da pista a menos de uma largura de pista.
  track.crossing = pts.map((p, i) => nearestOnOtherStretch(track, p.x, p.y, i).dist < 2 * TRACK_HALF);
  return track;
}

/**
 * Pontos de controle de um polígono com cantos arredondados. Cada canto é [x, y, raio]: ali entra um
 * arco de círculo com esse raio (sem raio, o ponto fica como está). As retas ganham pontos a cada
 * `step` px, assim o Catmull-Rom deixa os lados retos e as curvas com o raio pedido.
 */
export function roundCorners(corners, step = 100) {
  const n = corners.length, arcs = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = corners[(i - 1 + n) % n], [x, y, r = 0] = corners[i], [bx, by] = corners[(i + 1) % n];
    const u = unit(x - ax, y - ay), v = unit(bx - x, by - y);
    const cross = u.x * v.y - u.y * v.x, turn = Math.atan2(cross, u.x * v.x + u.y * v.y);
    if (!r || Math.abs(turn) < 1e-6) { arcs.push([{ x, y }]); continue; }
    // O arco começa e termina a `t` px do canto e tem o centro do lado de dentro da curva.
    const t = r * Math.tan(Math.abs(turn) / 2), side = Math.sign(cross);
    const cx = x - u.x * t - u.y * side * r, cy = y - u.y * t + u.x * side * r;
    const a0 = Math.atan2(y - u.y * t - cy, x - u.x * t - cx);
    const parts = Math.max(2, Math.ceil(Math.abs(turn) / ARC_STEP)), arc = [];
    for (let k = 0; k <= parts; k++) {
      const a = a0 + (turn * k) / parts;
      arc.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    arcs.push(arc);
  }
  const out = [];
  arcs.forEach((arc, i) => {
    out.push(...arc.map((p) => [p.x, p.y]));
    const a = arc[arc.length - 1], b = arcs[(i + 1) % n][0];
    const parts = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step);
    for (let k = 1; k < parts; k++) out.push([a.x + ((b.x - a.x) * k) / parts, a.y + ((b.y - a.y) * k) / parts]);
  });
  return out;
}

function unit(x, y) {
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

// Raio do círculo que passa por três pontos (reta = MAX_RADIUS).
function curveRadius(a, b, c) {
  const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ca = Math.hypot(a.x - c.x, a.y - c.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return area2 < 1e-6 ? MAX_RADIUS : Math.min(MAX_RADIUS, (ab * bc * ca) / (2 * area2));
}

function catmullRom(ctrl) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

// Divide a volta em pedaços iguais (o mais perto possível de `spacing`), para que ela feche sem emenda.
function resample(raw, spacing) {
  const n = raw.length;
  const segLen = raw.map((a, i) => Math.hypot(raw[(i + 1) % n].x - a.x, raw[(i + 1) % n].y - a.y));
  const total = segLen.reduce((sum, len) => sum + len, 0);
  const count = Math.round(total / spacing), step = total / count;
  const pts = [];
  let seg = 0, segStart = 0;
  for (let k = 0; k < count; k++) {
    const d = k * step;
    while (segStart + segLen[seg] < d) segStart += segLen[seg++];
    const a = raw[seg], b = raw[(seg + 1) % n], t = segLen[seg] ? (d - segStart) / segLen[seg] : 0;
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return pts;
}

function rotateToStart(pts, start) {
  let k0 = 0, best = Infinity;
  pts.forEach((p, i) => {
    const d = (p.x - start.x) ** 2 + (p.y - start.y) ** 2;
    if (d < best) { best = d; k0 = i; }
  });
  return pts.slice(k0).concat(pts.slice(0, k0));
}

/** Ponto da linha central mais perto de (x, y). Com `hint`, procura só perto do último índice conhecido. */
export function nearestOnTrack(track, x, y, hint = null, win = 14) {
  const { pts, N } = track;
  let best = Infinity, bi = 0, bt = 0;
  const from = hint == null ? 0 : hint - win, to = hint == null ? N - 1 : hint + win;
  for (let k = from; k <= to; k++) {
    const i = ((k % N) + N) % N, a = pts[i], b = pts[(i + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const d = (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2;
    if (d < best) { best = d; bi = i; bt = t; }
  }
  const a = pts[bi], b = pts[(bi + 1) % N];
  return { idx: bi, t: bt, px: a.x + (b.x - a.x) * bt, py: a.y + (b.y - a.y) * bt, dist: Math.sqrt(best) };
}

/**
 * Ponto mais perto de (x, y) em outro trecho da pista: pula o trecho em volta do índice `idx`.
 * Num cruzamento, é o ponto do outro braço do X.
 */
export function nearestOnOtherStretch(track, x, y, idx) {
  const half = Math.floor(track.N / 2);
  return nearestOnTrack(track, x, y, idx + half, half - SAME_STRETCH);
}

/** O primeiro índice a partir de `idx` que fica fora do cruzamento. */
export function pastCrossing(track, idx) {
  while (track.crossing[idx]) idx = (idx + 1) % track.N;
  return idx;
}

/** Ponto deslocado `off` px para o lado (positivo = direita) a partir da linha central. */
export function trackPoint(track, idx, off = 0) {
  const p = track.pts[idx], n = track.nrm[idx];
  return { x: p.x + n.x * off, y: p.y + n.y * off };
}

/** Posição de largada `k` (0 = pole). O último lugar é do jogador, como no original. */
export function gridSlot(track, k) {
  const row = Math.floor(k / 2), side = k % 2 ? 1 : -1;
  return { idx: (track.N - 5 - row * 7 - (k % 2) * 3) % track.N, off: side * 30 };
}
