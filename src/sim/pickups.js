import { MONEY, PICKUPS } from '../config.js';
import { randRange } from '../core/math.js';
import { emit } from './events.js';
import { pastCrossing, trackPoint } from './track.js';

/** Sacos de dinheiro espalhados pela volta e caixas de conserto em pontos fixos, sempre fora do cruzamento. */
export function placePickups(race) {
  const { track, rng } = race, N = track.N;
  race.pickups = [];
  for (let i = 0; i < PICKUPS.bags; i++) {
    const idx = pastCrossing(track, Math.floor(N * (0.06 + (0.88 * (i + rng() * 0.6)) / PICKUPS.bags)));
    const pos = trackPoint(track, idx, randRange(rng, -0.6, 0.6) * track.half);
    race.pickups.push({ kind: 'money', ...pos, active: true, t: 0 });
  }
  for (const f of PICKUPS.repairAt) {
    const pos = trackPoint(track, pastCrossing(track, Math.floor(N * f)), randRange(rng, -0.3, 0.3) * track.half);
    race.pickups.push({ kind: 'repair', ...pos, active: true, t: 0 });
  }
}

export function updatePickups(race, dt) {
  for (const pk of race.pickups) {
    if (!pk.active) {
      if (pk.kind === 'repair' && (pk.t -= dt) <= 0) pk.active = true;
      continue;
    }
    const car = race.cars.find((c) => c.alive && (c.x - pk.x) ** 2 + (c.y - pk.y) ** 2 <= PICKUPS.radius ** 2 &&
      (pk.kind === 'money' || c.armor < c.stats.armor));
    if (!car) continue;
    if (pk.kind === 'money') {
      car.extras += MONEY.bag;
    } else {
      car.armor = car.stats.armor;
      pk.t = PICKUPS.repairRespawn;
    }
    pk.active = false;
    emit(race, 'pickup', { car, kind: pk.kind, x: pk.x, y: pk.y });
  }
}
