import { seededRandom, TAU } from '../core/math.js';
import { nearestOnTrack } from '../sim/track.js';
import { circle } from './shapes.js';

const MAX_ITEMS = 190;
// O que aparece em cada tema de chão e a chance de cada coisa (a soma dá 1).
const MIX = {
  sand: [['cactus', 0.4], ['rock', 0.35], ['bush', 0.25]],
  grass: [['tree', 0.45], ['shrub', 0.35], ['rock', 0.2]],
  snow: [['pine', 0.6], ['rock', 0.4]],
  dirt: [['rock', 0.5], ['bush', 0.35], ['cactus', 0.15]],
};

/** Cactos, pedras, árvores, pinheiros e arbustos fora da pista. A semente fixa deixa o cenário sempre igual. */
export function buildScenery(track) {
  const rng = seededRandom(42), items = [], mix = MIX[track.ground] || MIX.sand;
  const { minX, maxX, minY, maxY } = track.ext;
  for (let i = 0; i < 600 && items.length < MAX_ITEMS; i++) {
    const x = minX - 400 + rng() * (maxX - minX + 800);
    const y = minY - 400 + rng() * (maxY - minY + 800);
    if (nearestOnTrack(track, x, y).dist < track.half + 45) continue;
    items.push({
      type: pickType(mix, rng()),
      x, y, size: 0.7 + rng() * 0.8,
      arms: [rng() * TAU, rng() * TAU],
      shape: Array.from({ length: 7 }, () => 0.7 + rng() * 0.5),
    });
  }
  return items;
}

function pickType(mix, k) {
  for (const [type, chance] of mix) {
    if (k < chance) return type;
    k -= chance;
  }
  return mix[mix.length - 1][0];
}

const DRAW = { cactus: drawCactus, rock: drawRock, bush: drawBush, tree: drawTree, shrub: drawShrub, pine: drawPine };

export function drawScenery(ctx, items, rect) {
  for (const item of items) {
    if (item.x < rect.x0 || item.x > rect.x1 || item.y < rect.y0 || item.y > rect.y1) continue;
    DRAW[item.type](ctx, item);
  }
}

function drawCactus(ctx, c) {
  const r = 10 * c.size;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(c.x + r * 0.9, c.y + r * 1.1, r * 1.7, r * 0.9, 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2f7a35';
  circle(ctx, c.x, c.y, r);
  for (const a of c.arms) circle(ctx, c.x + Math.cos(a) * r * 1.15, c.y + Math.sin(a) * r * 1.15, r * 0.55);
  ctx.fillStyle = '#4fa552';
  circle(ctx, c.x - r * 0.25, c.y - r * 0.25, r * 0.5);
}

function drawRock(ctx, rock) {
  const r = 10 * rock.size;
  const poly = (dx, dy, k) => {
    ctx.beginPath();
    rock.shape.forEach((m, i) => {
      const a = (i / rock.shape.length) * TAU;
      const px = rock.x + dx + Math.cos(a) * r * m * k, py = rock.y + dy + Math.sin(a) * r * m * k;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  poly(r * 0.4, r * 0.5, 1);
  ctx.fillStyle = '#968b7a';
  poly(0, 0, 1);
  ctx.fillStyle = '#b7ac99';
  poly(-r * 0.2, -r * 0.2, 0.55);
}

function drawBush(ctx, b) {
  const r = 10 * b.size;
  ctx.strokeStyle = '#7a5c33';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + b.arms[0], len = r * b.shape[i % b.shape.length];
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + Math.cos(a) * len, b.y + Math.sin(a) * len);
  }
  ctx.stroke();
}

function drawTree(ctx, t) {
  const r = 13 * t.size;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  circle(ctx, t.x + r * 0.5, t.y + r * 0.6, r * 1.05);
  ctx.fillStyle = '#2e6b2a';
  circle(ctx, t.x, t.y, r);
  for (const a of t.arms) circle(ctx, t.x + Math.cos(a) * r * 0.55, t.y + Math.sin(a) * r * 0.55, r * 0.65);
  ctx.fillStyle = '#4b9443';
  circle(ctx, t.x - r * 0.3, t.y - r * 0.3, r * 0.45);
}

// Arbusto verde: três bolinhas de folhas.
function drawShrub(ctx, b) {
  const r = 7 * b.size;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  circle(ctx, b.x + r * 0.4, b.y + r * 0.5, r * 1.2);
  ctx.fillStyle = '#3f7d33';
  for (let i = 0; i < 3; i++) {
    const a = b.arms[0] + (i / 3) * TAU;
    circle(ctx, b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5, r * 0.6 * b.shape[i]);
  }
  ctx.fillStyle = '#5aa04a';
  circle(ctx, b.x - r * 0.2, b.y - r * 0.25, r * 0.35);
}

// Pinheiro visto de cima: duas estrelas de galhos, a de cima mais clara, e neve no topo.
function drawPine(ctx, t) {
  const r = 14 * t.size;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  circle(ctx, t.x + r * 0.5, t.y + r * 0.6, r);
  ctx.fillStyle = '#24513a';
  star(ctx, t.x, t.y, r, t.arms[0]);
  ctx.fillStyle = '#336e4c';
  star(ctx, t.x, t.y, r * 0.6, t.arms[1]);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  circle(ctx, t.x - r * 0.12, t.y - r * 0.12, r * 0.2);
}

function star(ctx, x, y, r, turn) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = turn + (i / 16) * TAU, len = i % 2 ? r * 0.6 : r;
    if (i) ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    else ctx.moveTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  ctx.closePath();
  ctx.fill();
}
