import { EFFECTS, MINES, NITRO, PUDDLES, TRACK_HALF, WEAPONS } from '../config.js';
import { randRange } from '../core/math.js';
import { damage } from './damage.js';
import { emit } from './events.js';
import { nearestOnTrack } from './track.js';

/** Usa uma arma equipada, se tiver munição e já tiver passado o tempo de recarga entre disparos. */
export function useWeapon(race, car, id) {
  const w = WEAPONS[id];
  if (!w || !(car.ammo[id] > 0) || car.cooldown[id] > 0) return;
  if (id === 'nitro' && car.nitroT > 0) return;
  car.ammo[id]--;
  car.cooldown[id] = w.cooldown;
  if (w.shot) fire(race, car, id, w);
  else if (w.mine) drop(race, car, id, race.mines, MINES.max);
  else if (w.puddle) {
    drop(race, car, id, race.puddles, PUDDLES.max, {
      effect: w.puddle.effect, life: PUDDLES.life, armT: PUDDLES.arm,
      inside: new Set(), // carros em cima da mancha agora (o óleo só pega na entrada)
    });
  }
  else if (id === 'nitro') {
    car.nitroT = NITRO.duration;
    emit(race, 'nitro', { car, x: car.x, y: car.y });
  }
}

function fire(race, car, id, w) {
  const a = car.a + (w.spread ? randRange(race.rng, -w.spread, w.spread) : 0);
  const fx = Math.cos(a), fy = Math.sin(a);
  const speed = w.shot.speed + Math.max(0, car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a));
  race.shots.push({
    weapon: id, owner: car, idx: car.idx, life: w.shot.life,
    x: car.x + fx * 20, y: car.y + fy * 20, vx: fx * speed, vy: fy * speed,
    seen: new Set(), // carros da CPU que já viram este tiro chegando (para desviar)
  });
  emit(race, 'shot', { weapon: id, car, x: car.x, y: car.y });
}

// Minas e manchas ficam no chão, logo atrás do carro.
function drop(race, car, id, list, max, extra = {}) {
  const x = car.x - Math.cos(car.a) * 26, y = car.y - Math.sin(car.a) * 26;
  list.push({ weapon: id, owner: car, x, y, armT: MINES.arm, age: 0, ...extra });
  if (list.length > max) list.shift();
  emit(race, 'drop', { weapon: id, car, x, y });
}

/** Óleo ou PEM: liga o efeito no carro (renova o tempo se ele já estiver afetado). */
export function applyEffect(race, car, effect) {
  const fresh = car.status[effect] <= 0;
  car.status[effect] = EFFECTS[effect].duration;
  if (fresh) emit(race, 'status', { car, effect, x: car.x, y: car.y });
  return fresh;
}

export function updateShots(race, dt) {
  const { shots, cars, track } = race;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i], spec = WEAPONS[s.weapon].shot;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let dead = s.life <= 0;
    if (!dead) {
      const n = nearestOnTrack(track, s.x, s.y, s.idx, 10);
      s.idx = n.idx;
      if (n.dist > TRACK_HALF + 6) {
        dead = true;
        emit(race, 'shot-wall', { weapon: s.weapon, x: s.x, y: s.y });
      }
    }
    if (!dead) {
      const target = cars.find((c) => c !== s.owner && c.alive && c.invuln <= 0 &&
        (c.x - s.x) ** 2 + (c.y - s.y) ** 2 < spec.radius ** 2);
      if (target) {
        damage(race, target, spec.damage, s.owner);
        target.vx += s.vx * spec.push;
        target.vy += s.vy * spec.push;
        emit(race, 'hit', { weapon: s.weapon, car: target, x: s.x, y: s.y });
        dead = true;
      }
    }
    if (dead) shots.splice(i, 1);
  }
}

export function updateMines(race, dt) {
  const { mines, cars, rng } = race;
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i], spec = WEAPONS[m.weapon].mine;
    m.armT -= dt;
    m.age += dt;
    const victim = cars.find((c) => c.alive && c.invuln <= 0 && !(c === m.owner && m.armT > 0) &&
      Math.hypot(c.x - m.x, c.y - m.y) <= MINES.radius);
    if (!victim) continue;

    // A explosão empurra o carro para longe da mina.
    const dx = victim.x - m.x, dy = victim.y - m.y, d = Math.hypot(dx, dy);
    const nx = d > 0.01 ? dx / d : Math.cos(victim.a), ny = d > 0.01 ? dy / d : Math.sin(victim.a);
    victim.vx = victim.vx * 0.4 + nx * spec.push;
    victim.vy = victim.vy * 0.4 + ny * spec.push;
    if (spec.spin) victim.spin = (rng() < 0.5 ? -1 : 1) * randRange(rng, 5, 8);
    damage(race, victim, spec.damage, m.owner === victim ? null : m.owner);
    if (spec.effect && victim.alive) applyEffect(race, victim, spec.effect);
    emit(race, 'mine-blast', { weapon: m.weapon, car: victim, x: m.x, y: m.y });
    mines.splice(i, 1);
  }
}

// Manchas de óleo e cola não somem quando alguém passa: afetam todo mundo até secarem.
// O óleo pega quando o carro entra na mancha e dura um tempo fixo, mesmo que ele pare em cima
// (sem tração ele não conseguiria sair). A cola só vale enquanto o carro estiver em cima.
export function updatePuddles(race, dt) {
  const { puddles, cars, rng } = race;
  const glued = new Set();
  for (let i = puddles.length - 1; i >= 0; i--) {
    const p = puddles[i];
    p.armT -= dt;
    p.age += dt;
    if ((p.life -= dt) <= 0) { puddles.splice(i, 1); continue; }
    for (const c of cars) {
      const over = c.alive && c.invuln <= 0 && !(c === p.owner && p.armT > 0) &&
        Math.hypot(c.x - p.x, c.y - p.y) <= PUDDLES.radius;
      if (!over) { p.inside.delete(c); continue; }
      if (p.effect === 'glue') glued.add(c);
      else if (!p.inside.has(c) && applyEffect(race, c, 'oil')) {
        c.spin = (rng() < 0.5 ? -1 : 1) * randRange(rng, ...EFFECTS.oil.spin); // escorregão para um lado sorteado
      }
      p.inside.add(c);
    }
  }
  for (const c of cars) stick(race, c, glued.has(c));
}

// Cola: o carro para na hora ao entrar e fica lento enquanto estiver em cima (o limite fica em `drive`).
// Não tem tempo: `status.glue` é 1 em cima da mancha e 0 fora dela, reescrito a cada passo.
function stick(race, car, onGlue) {
  if (onGlue && !(car.status.glue > 0)) {
    car.vx = car.vy = 0;
    emit(race, 'status', { car, effect: 'glue', x: car.x, y: car.y });
  }
  car.status.glue = onGlue ? 1 : 0;
}
