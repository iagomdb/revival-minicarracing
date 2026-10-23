import { TRACK_HALF, TRACK_SPACING } from '../config.js';
import { angDiff, clamp, randRange } from '../core/math.js';
import { cornerSpeed } from './stats.js';
import { trackPoint } from './track.js';

const CORNER_MARGIN = 0.95; // a CPU entra nas curvas um pouco abaixo do limite do pneu
const BRAKE_USE = 0.6;      // e planeja as freadas com folga
const LANE_LIMIT = 0.75 * TRACK_HALF;
const DODGE = { lookahead: 0.7, missDistance: 40, time: 0.8, step: 0.6 * TRACK_HALF };
// Quando a CPU usa cada arma: alcance do tiro (frente) ou distância do carro que vem atrás (traseira).
const FRONT_RANGE = { laser: 420, mg: 340, rocket: 650 };
const REAR_RANGE = { mine: 180, emp: 180, oil: 260, glue: 260 };
const TRIGGER_RATE = { mg: 40 }; // a metralhadora é segurada em rajadas; as outras armas, uma por vez

/**
 * Decide as "teclas" de um carro da CPU (ou do jogador no piloto automático).
 * A IA só escreve em `car.input`; quem move o carro é a mesma física do jogador.
 */
export function driveAI(race, car, dt, racing, useWeapons) {
  const inp = car.input;
  inp.up = inp.down = inp.fire1 = inp.fire2 = inp.rear = inp.extra = false;
  inp.steer = 0;
  if (!car.alive || !racing) return;

  const speed = Math.hypot(car.vx, car.vy);
  chooseLane(race, car, dt);
  const heading = steerAlongTrack(race.track, car, speed);
  const target = targetSpeed(race.track, car, speed);
  controlSpeed(car, target, heading);
  if (unstick(car, dt, speed)) return;
  if (useWeapons && car.lap >= 0) fireAtWill(race, car, dt, speed, target);
}

// Escolhe a faixa: troca de vez em quando, contorna carros, minas e manchas à frente
// e desvia dos tiros que vêm na sua direção.
function chooseLane(race, car, dt) {
  const ai = car.ai, fx = Math.cos(car.a), fy = Math.sin(car.a);
  ai.dodgeT = Math.max(0, ai.dodgeT - dt);
  if ((ai.offT -= dt) <= 0) {
    ai.offTarget = randRange(race.rng, -0.4, 0.4) * TRACK_HALF;
    ai.offT = randRange(race.rng, 2, 5);
  }
  const avoid = (x, y, halfWidth) => {
    const dx = x - car.x, dy = y - car.y, ahead = dx * fx + dy * fy, side = -dx * fy + dy * fx;
    if (ai.dodgeT <= 0 && ahead > 0 && ahead < 110 && Math.abs(side) < halfWidth) {
      ai.offTarget = (side > 0 ? -1 : 1) * 0.45 * TRACK_HALF;
      ai.offT = 1.2;
    }
  };
  for (const o of race.cars) if (o !== car && o.alive) avoid(o.x, o.y, 28);
  for (const m of race.mines) avoid(m.x, m.y, 30);
  for (const p of race.puddles) avoid(p.x, p.y, 40);
  dodgeShots(race, car);
  ai.off += (ai.offTarget - ai.off) * Math.min(1, dt * (ai.dodgeT > 0 ? 5 : 1.5)); // no desvio, muda de faixa rápido
}

/**
 * Vê os tiros que vão passar perto do carro e, se perceber a tempo (chance `ai.dodge`),
 * troca de faixa para longe da linha do tiro. Cada tiro só é avaliado uma vez por carro.
 */
export function dodgeShots(race, car) {
  const ai = car.ai, n = race.track.nrm[car.idx];
  for (const s of race.shots) {
    if (s.owner === car || s.seen.has(car)) continue;
    const rx = car.x - s.x, ry = car.y - s.y, rvx = s.vx - car.vx, rvy = s.vy - car.vy;
    const v2 = rvx * rvx + rvy * rvy;
    if (v2 < 1) continue;
    const t = (rx * rvx + ry * rvy) / v2;         // quando o tiro passa mais perto
    if (t < 0 || t > DODGE.lookahead) continue;
    const mx = rx - rvx * t, my = ry - rvy * t;   // onde o carro estará em relação ao tiro nessa hora
    if (mx * mx + my * my > DODGE.missDistance ** 2) continue;
    s.seen.add(car);
    if (race.rng() > ai.dodge) continue;          // não percebeu
    const side = mx * n.x + my * n.y;             // de que lado da linha do tiro o carro está
    const dir = Math.abs(side) > 4 ? Math.sign(side) : ai.off > 0 ? -1 : 1;
    ai.offTarget = clamp(ai.off + dir * DODGE.step, -LANE_LIMIT, LANE_LIMIT);
    ai.offT = ai.dodgeT = DODGE.time;
  }
}

// Mira num ponto da pista um pouco à frente. Devolve o erro de direção (rad).
function steerAlongTrack(track, car, speed) {
  const ti = (car.idx + Math.round(7 + speed / 40)) % track.N;
  const lane = car.ai.off * (1 - Math.min(1, track.turn[car.idx] * 0.8)); // nas curvas fechadas, volta pro meio
  const target = trackPoint(track, ti, lane);
  const diff = angDiff(Math.atan2(target.y - car.y, target.x - car.x), car.a);
  car.input.steer = clamp(diff * 3, -1, 1);
  return diff;
}

// Velocidade que dá para levar agora sem passar do limite do pneu em nenhuma curva
// até onde o carro consegue frear. Usa a tração do próprio carro, então upgrades valem para a CPU.
function targetSpeed(track, car, speed) {
  const s = car.stats, skill = car.ai.skill, decel = s.brake * BRAKE_USE;
  const reach = Math.ceil((speed * speed) / (2 * decel) / TRACK_SPACING) + 8;
  let limit = s.maxSpeed * skill;
  for (let k = 0; k <= reach; k += 2) {
    const corner = cornerSpeed(s, track.radius[(car.idx + k) % track.N]) * skill * CORNER_MARGIN;
    limit = Math.min(limit, Math.sqrt(corner * corner + 2 * decel * k * TRACK_SPACING));
  }
  return limit;
}

function controlSpeed(car, target, heading) {
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  const goal = target * (Math.abs(heading) > 1.2 ? 0.4 : 1); // virado para o lado errado: vai devagar
  const vF = car.vx * fx + car.vy * fy;
  if (vF < goal - 10) car.input.up = true;
  else if (vF > goal + 25) car.input.down = true;
}

// Preso na mureta? Dá ré um pouco, virando para o outro lado.
function unstick(car, dt, speed) {
  const ai = car.ai, inp = car.input;
  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    inp.up = false;
    inp.down = true;
    inp.steer = -inp.steer;
    return true;
  }
  if (speed < 25) {
    if ((ai.stuckT += dt) > 1.2) { ai.stuckT = 0; ai.reverseT = 0.9; }
  } else ai.stuckT = 0;
  return false;
}

const ready = (car, id) => car.ammo[id] > 0 && !(car.cooldown[id] > 0);

function fireAtWill(race, car, dt, speed, target) {
  const { rng } = race, inp = car.input, aggro = car.ai.aggro, { front, rear, extra } = car.loadout;
  const pull = (id) => rng() < aggro * dt * (TRIGGER_RATE[id] ?? 8);
  inp.fire1 = hasTargetAhead(race, car, front[0]) && pull(front[0]);
  inp.fire2 = hasTargetAhead(race, car, front[1]) && pull(front[1]);
  inp.rear = hasTargetBehind(race, car, rear) && rng() < aggro * dt * 3;
  const straightAhead = target >= car.stats.maxSpeed * car.ai.skill * 0.99;
  inp.extra = extra === 'nitro' && ready(car, extra) && car.nitroT <= 0 && straightAhead && speed > 250 && rng() < dt * 0.5;
}

function hasTargetAhead(race, car, id) {
  if (!ready(car, id)) return false;
  return race.cars.some((o) => {
    if (o === car || !o.alive || o.invuln > 0) return false;
    const dx = o.x - car.x, dy = o.y - car.y, d = Math.hypot(dx, dy);
    return d > 1 && d < FRONT_RANGE[id] && Math.abs(angDiff(Math.atan2(dy, dx), car.a)) < 0.04 + 14 / d;
  });
}

function hasTargetBehind(race, car, id) {
  if (!ready(car, id)) return false;
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  return race.cars.some((o) => {
    if (o === car || !o.alive) return false;
    const dx = o.x - car.x, dy = o.y - car.y;
    const behind = -(dx * fx + dy * fy), side = Math.abs(-dx * fy + dy * fx);
    return behind > 30 && behind < REAR_RANGE[id] && side < 30;
  });
}
