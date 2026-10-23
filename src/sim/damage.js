import { KILL_CREDIT_WINDOW, MONEY, RESPAWN } from '../config.js';
import { emit } from './events.js';

/** Tira blindagem. `by` é quem causou o dano (para dar o abate e o dinheiro). */
export function damage(race, car, amount, by) {
  if (!car.alive || car.invuln > 0 || amount <= 0) return;
  car.armor -= amount;
  if (by && by !== car) {
    car.lastHitBy = by;
    car.lastHitT = race.time;
  }
  if (car.armor <= 0) destroyCar(race, car);
}

export function destroyCar(race, car, reason = 'damage') {
  if (!car.alive) return;
  car.alive = false;
  car.armor = 0;
  car.respawnT = RESPAWN.delay;
  car.nitroT = 0;
  car.vx = car.vy = 0;
  car.deaths++;
  emit(race, 'explosion', { car, x: car.x, y: car.y, reason });

  const recent = car.lastHitBy && race.time - car.lastHitT < KILL_CREDIT_WINDOW;
  if (reason !== 'false-start' && recent) {
    const killer = car.lastHitBy;
    killer.kills++;
    killer.extras += MONEY.kill;
    emit(race, 'kill', { killer, victim: car, x: car.x, y: car.y });
  }
  car.lastHitBy = null;
}
