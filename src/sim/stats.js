import { HANDLING, POINT_VALUES } from '../config.js';
import { clamp } from '../core/math.js';

/** Pontos do carro = pontos do modelo + níveis de upgrade. */
export function carPoints(model, upgrades = {}) {
  const p = model.points, u = { engine: 0, tires: 0, armor: 0, ...upgrades };
  return {
    speed: p.speed + u.engine,
    accel: p.accel + u.engine,
    traction: p.traction + u.tires,
    armor: p.armor + u.armor,
  };
}

/** Converte pontos nos números que a física usa. A tração conta em relação à velocidade (veja `POINT_VALUES`). */
export function deriveStats(points) {
  const value = (key) => POINT_VALUES[key].base + POINT_VALUES[key].perPoint * points[key];
  const tr = POINT_VALUES.traction;
  return {
    maxSpeed: value('speed'),
    accel: value('accel'),
    grip: Math.max(tr.min, tr.base + tr.perPoint * (points.traction - points.speed)),
    armor: value('armor'),
    brake: HANDLING.brake,
    reverse: HANDLING.reverse,
  };
}

/** Força lateral que o pneu aguenta (px/s²) numa velocidade: quanto mais rápido, menos tração. */
export function gripAt(stats, speed) {
  return stats.grip * (1 - HANDLING.gripLoss * clamp(speed / HANDLING.gripLossSpeed, 0, 1));
}

/**
 * Maior velocidade para fazer uma curva de raio `radius` sem escorregar.
 * Vem de v² = raio × tração(v), com a tração caindo em linha reta com a velocidade.
 */
export function cornerSpeed(stats, radius) {
  const b = (radius * stats.grip * HANDLING.gripLoss) / HANDLING.gripLossSpeed;
  return (-b + Math.sqrt(b * b + 4 * radius * stats.grip)) / 2;
}
