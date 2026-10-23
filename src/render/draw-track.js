import { GRID_SIZE, TRACK_HALF } from '../config.js';
import { seededRandom } from '../core/math.js';
import { gridSlot, nearestOnOtherStretch, trackPoint } from '../sim/track.js';
import { circle } from './shapes.js';

// Textura do chão de cada tema (o `ground` dos dados da pista).
const GROUNDS = {
  sand: { size: 256, seed: 7, base: '#c9a86b', dots: ['rgba(120,85,40,0.18)', 'rgba(255,240,200,0.18)'], count: 900 },
  grass: { size: 256, seed: 11, base: '#5f8f3c', dots: ['rgba(30,70,20,0.22)', 'rgba(200,235,140,0.16)'], count: 1100 },
};
const EDGE_LINE = TRACK_HALF - 5; // distância das faixas amarelas até o meio da pista

/** Tudo da pista que só precisa ser montado uma vez: o traçado e as texturas. */
export function createTrackArt(ctx, track) {
  return {
    path: polyline(track, () => true),
    marks: polyline(track, (i) => !underOtherStretch(track, i)),
    ground: noisePattern(ctx, GROUNDS[track.ground] || GROUNDS.sand),
    asphalt: noisePattern(ctx, { size: 128, seed: 3, base: '#55575c', dots: ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.07)'], count: 500 }),
  };
}

// A linha central só com os pontos em que `keep(i)` é verdade. Sem buracos, é uma volta fechada.
function polyline(track, keep) {
  const { pts, N } = track, path = new Path2D();
  const gap = pts.findIndex((_, i) => !keep(i));
  if (gap < 0) {
    pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    path.closePath();
    return path;
  }
  // Começa logo depois de um buraco, para cada pedaço visível virar um traço só.
  let drawing = false;
  for (let k = 1; k <= N; k++) {
    const i = (gap + k) % N, p = pts[i];
    if (!keep(i)) drawing = false;
    else if (drawing) path.lineTo(p.x, p.y);
    else { path.moveTo(p.x, p.y); drawing = true; }
  }
  return path;
}

// No cruzamento, as faixas de um braço não podem passar por cima do asfalto do outro.
function underOtherStretch(track, i) {
  if (!track.crossing[i]) return false;
  return [0, -EDGE_LINE, EDGE_LINE].some((off) => {
    const q = trackPoint(track, i, off);
    return nearestOnOtherStretch(track, q.x, q.y, i).dist < TRACK_HALF;
  });
}

// Textura repetível de pontinhos (areia, grama, asfalto), sempre igual por causa da semente.
function noisePattern(ctx, { size, seed, base, dots, count }) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const g = tile.getContext('2d'), rng = seededRandom(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    g.fillStyle = dots[i % dots.length];
    const s = 1 + rng() * 2.5;
    g.fillRect(rng() * size, rng() * size, s, s);
  }
  return ctx.createPattern(tile, 'repeat');
}

export function drawGround(ctx, art, rect) {
  ctx.fillStyle = art.ground;
  ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
}

// A pista é o mesmo traçado pintado várias vezes, da faixa mais larga para a mais estreita.
// Num cruzamento, o asfalto de cada braço cobre o guard-rail e a zebra do outro. As faixas pintadas
// vêm por último, num traçado com buracos no X, e terminam retas (sem ponta redonda).
export function drawTrack(ctx, track, art) {
  const w = TRACK_HALF * 2;
  const stroke = (width, style, path = art.path) => { ctx.lineWidth = width; ctx.strokeStyle = style; ctx.stroke(path); };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  stroke(w + 46, 'rgba(110,80,45,0.22)');  // terra batida
  stroke(w + 22, '#4d555b');               // guard-rail
  stroke(w + 18, '#c8cfd4');
  stroke(w + 10, '#f2f2f2');               // zebra
  ctx.setLineDash([16, 16]);
  stroke(w + 10, '#d23c2c');
  ctx.setLineDash([]);
  stroke(w, art.asphalt);
  ctx.lineCap = 'butt';
  stroke(w - 8, '#e2c34a', art.marks);     // faixas amarelas das bordas
  stroke(w - 12, art.asphalt, art.marks);
  ctx.setLineDash([22, 26]);
  stroke(3, 'rgba(255,255,255,0.5)', art.marks); // faixa central
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  drawFinishLine(ctx, track);
  drawGridMarks(ctx, track);
}

function drawFinishLine(ctx, track) {
  const p = track.pts[0], w = TRACK_HALF * 2, sq = 7;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(track.ang[0]);
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k * sq < w; k++) {
      ctx.fillStyle = (row + k) % 2 ? '#111' : '#fafafa';
      ctx.fillRect(-sq + row * sq, -TRACK_HALF + k * sq, sq, Math.min(sq, w - k * sq));
    }
  }
  ctx.restore();
}

function drawGridMarks(ctx, track) {
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  for (let k = 0; k < GRID_SIZE; k++) {
    const slot = gridSlot(track, k), q = trackPoint(track, slot.idx, slot.off);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(track.ang[slot.idx]);
    ctx.beginPath();
    ctx.moveTo(10, -13); ctx.lineTo(22, -13); ctx.lineTo(22, 13); ctx.lineTo(10, 13);
    ctx.stroke();
    ctx.restore();
  }
}

/** Pórtico da largada com o semáforo. É desenhado por cima dos carros. */
export function drawGantry(ctx, track, lights) {
  const p = track.pts[0], len = TRACK_HALF * 2 + 56;
  const beam = (ox, oy, color) => {
    ctx.save();
    ctx.translate(p.x + ox, p.y + oy);
    ctx.rotate(track.ang[0]);
    ctx.fillStyle = color;
    ctx.fillRect(-6, -len / 2, 12, len);
    ctx.restore();
  };
  beam(14, 18, 'rgba(0,0,0,0.25)'); // sombra
  beam(0, 0, '#2d2f33');
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(track.ang[0]);
  ctx.fillStyle = '#1c1d20';
  ctx.fillRect(-10, -len / 2 - 4, 20, 12);
  ctx.fillRect(-10, len / 2 - 8, 20, 12);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = lights.green ? '#30d158' : i < lights.lit ? '#ff3b30' : '#3a1515';
    circle(ctx, 0, (i - 1) * 14, 4.5);
  }
  ctx.restore();
}
