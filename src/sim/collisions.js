import { BUMP_DAMAGE } from '../config.js';
import { damage } from './damage.js';
import { emit } from './events.js';

const CIRCLE_OFFSETS = [-8, 8]; // cada carro colide como dois círculos: traseira e frente
const CIRCLE_RADIUS = 10;
const RESTITUTION = 0.5;

export function collideCars(race) {
  const { cars } = race;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (!a.alive || a.invuln > 0) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (!b.alive || b.invuln > 0) continue;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > 50 * 50) continue;
      for (const oa of CIRCLE_OFFSETS) for (const ob of CIRCLE_OFFSETS) resolvePair(race, a, oa, b, ob);
    }
  }
}

function resolvePair(race, a, oa, b, ob) {
  const min = CIRCLE_RADIUS * 2;
  const dx = b.x + Math.cos(b.a) * ob - (a.x + Math.cos(a.a) * oa);
  const dy = b.y + Math.sin(b.a) * ob - (a.y + Math.sin(a.a) * oa);
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;

  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;

  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach <= 0) return;
  const impulse = (approach * (1 + RESTITUTION)) / 2;
  a.vx -= nx * impulse; a.vy -= ny * impulse;
  b.vx += nx * impulse; b.vy += ny * impulse;

  if (approach > BUMP_DAMAGE.threshold) {
    const amount = (approach - BUMP_DAMAGE.threshold) * BUMP_DAMAGE.factor;
    damage(race, a, amount, b);
    damage(race, b, amount, a);
    emit(race, 'bump', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, force: approach });
  }
}
