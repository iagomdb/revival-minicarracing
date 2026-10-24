import { AI_STYLES, MINES, NITRO, PUDDLES, TRACK_SPACING, WEAPONS } from '../config.js';
import { angDiff, clamp, randRange } from '../core/math.js';
import { laneLimit, lineCurvature, racingLine } from './racing-line.js';
import { cornerSpeed } from './stats.js';
import { nearestOnTrack, trackPoint } from './track.js';
import { shotSpeed } from './weapons.js';

const CORNER_MARGIN = 0.95; // a CPU entra nas curvas um pouco abaixo do limite do pneu
const BRAKE_USE = 0.6;      // e planeja as freadas com folga
const STRAIGHT = 5000;      // raio que conta como reta (px)
const MIN_RADIUS = 30;      // raio mínimo considerado, mesmo bem por dentro de uma curva fechada (px)
// Cada carro anda um pouco para o lado do traçado (até LANE_BIAS da meia largura) e troca de lado de vez em quando.
const LANE_BIAS = 0.3;
const DODGE = { lookahead: 0.7, missDistance: 40, time: 0.8, step: 0.6 };
// Ultrapassar e contornar: olha `ahead` px mais `perSpeed` segundos à frente e passa com `clearance` px de folga.
const AVOID = { ahead: 60, perSpeed: 0.35, clearance: 8, time: 0.8 };
const HALF_WIDTH = { car: 22, mine: MINES.radius + 10, puddle: PUDDLES.radius + 10 }; // obstáculo mais meio carro
// Caça: alinha atrás de um alvo a partir de `min` px, dentro do cone à frente (rad), fora de curva fechada.
// Quanto mais agressiva a CPU, mais ela puxa a faixa para a do alvo (`pull` × aggro).
const HUNT = { min: 220, cone: 0.6, maxTurn: 0.6, pull: 1.5 };
// Fechar a porta: com alguém até `range` pontos da pista atrás, puxa a faixa para a dele (`pull` × block do perfil).
const BLOCK = { range: 22, pull: 0.8 };
// Sem perfil (o jogador no piloto automático), a IA usa o jeito padrão.
const PLAIN = { hunt: 1, rear: 1, bias: 1, corner: 1, block: 0 };
const styleOf = (car) => AI_STYLES[car.ai.style] ?? PLAIN;
// Quando a CPU usa cada arma: alcance do tiro (frente) ou distância do carro que vem atrás (traseira).
const FRONT_RANGE = { laser: 420, mg: 340, rocket: 650, plasma: 500 };
const REAR_RANGE = { mine: 180, emp: 180, oil: 260, glue: 260 };
const TRIGGER_RATE = { mg: 40 }; // a metralhadora é segurada em rajadas; as outras armas, uma por vez
const AIM_TOLERANCE = 0.7;       // o tiro previsto precisa passar a 70% do raio de acerto do alvo
const DROP_BACK = 26;            // minas e manchas caem esta distância atrás do carro (px)
const BEFORE_CORNER = new Set(['oil', 'emp']); // derrapar ou virar ao contrário só atrapalha perto de uma curva
const CORNER_AHEAD = 0.5;        // "curva perto": a pista vira pelo menos isto (rad) nos próximos ~250 px
// Nitro: numa reta, a partir de `cruise` px/s; ou para recuperar, abaixo de `recover` da velocidade que daria
// para levar ali (a largada, nos primeiros `calm` s, não conta como travar). Só apontado ao longo da pista (`aim` rad).
// A CPU aceita curvas que peçam até `slack` da velocidade do momento. `rate`: chance por segundo de apertar.
const NITRO_USE = { cruise: 250, recover: 0.5, calm: 3, aim: 0.35, slack: 0.9, step: 0.05, rate: { straight: 3, stuck: 10 } };

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
  const armed = useWeapons && car.lap >= 0;
  const ti = (car.idx + Math.round(7 + speed / 40)) % race.track.N; // ponto da pista para onde a CPU olha
  chooseLane(race, car, dt, speed, ti, armed);
  const heading = steerTo(race.track, car, ti);
  const target = targetSpeed(race.track, car, speed);
  controlSpeed(car, target, heading);
  if (unstick(car, dt, speed)) return;
  if (armed) fireAtWill(race, car, dt, speed, target);
}

/**
 * Escolhe a faixa. Sem nada no caminho, a CPU segue o traçado de corrida com um desvio próprio, que muda
 * de vez em quando. Por cima disso, do mais urgente para o menos: desvia de tiros; passa por carros mais
 * lentos, minas e manchas pelo lado com mais espaço; fecha a porta de quem vem atrás (perfil defensivo);
 * e alinha atrás de um alvo para atirar.
 */
function chooseLane(race, car, dt, speed, ti, armed) {
  const ai = car.ai, track = race.track, limit = laneLimit(track), style = styleOf(car);
  ai.dodgeT = Math.max(0, ai.dodgeT - dt);
  ai.offT = Math.max(0, ai.offT - dt);
  if ((ai.biasT -= dt) <= 0) {
    ai.bias = randRange(race.rng, -LANE_BIAS, LANE_BIAS) * track.half * style.bias;
    ai.biasT = randRange(race.rng, 2, 5);
  }
  dodgeShots(race, car);
  if (ai.dodgeT <= 0) avoidAhead(race, car, speed, limit);

  const line = racingLine(track)[ti];
  const calm = 1 - Math.min(1, track.turn[car.idx] * 0.8); // nas curvas fechadas, fica perto do traçado
  const open = track.turn[car.idx] < HUNT.maxTurn;         // fora de curva fechada: dá para trocar de faixa
  let goal = line + ai.bias * calm;
  if (ai.offT > 0) goal = ai.offTarget;
  else if (car.nitroT > 0) goal = lateral(track, car); // no nitro não dá para frear: segue reto na faixa em que está
  else if (open) {
    const chaser = style.block > 0 ? closestBehind(race, car) : null;
    const prey = !chaser && armed && style.hunt > 0 ? pickTarget(race, car) : null;
    if (chaser) goal += (lateral(track, chaser) - goal) * Math.min(1, style.block * BLOCK.pull);
    else if (prey) goal += (lateral(track, prey) - goal) * Math.min(1, ai.aggro * HUNT.pull * style.hunt);
  }
  // O desvio em relação ao traçado muda aos poucos (rápido quando está fugindo de um tiro).
  ai.dev += (clamp(goal, -limit, limit) - line - ai.dev) * Math.min(1, dt * (ai.dodgeT > 0 ? 5 : 2));
  ai.off = clamp(line + ai.dev, -limit, limit);
}

/**
 * Vê os tiros que vão passar perto do carro e, se perceber a tempo (chance `ai.dodge`),
 * troca de faixa para longe da linha do tiro. Cada tiro só é avaliado uma vez por carro.
 */
export function dodgeShots(race, car) {
  const ai = car.ai, n = race.track.nrm[car.idx], limit = laneLimit(race.track);
  for (const s of race.shots) {
    const own = s.owner === car && !WEAPONS[s.weapon].shot.hitsOwnerAfter; // o próprio tiro, se não acerta o dono
    if (own || s.seen.has(car)) continue;
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
    ai.offTarget = clamp(ai.off + dir * DODGE.step * race.track.half, -limit, limit);
    ai.offT = ai.dodgeT = DODGE.time;
  }
}

// Carro mais lento, mina ou mancha logo à frente, na mesma faixa: passa pelo lado da pista com mais espaço.
function avoidAhead(race, car, speed, limit) {
  const fx = Math.cos(car.a), fy = Math.sin(car.a), reach = AVOID.ahead + speed * AVOID.perSpeed;
  const vF = car.vx * fx + car.vy * fy;
  let near = null;
  const check = (x, y, halfWidth, closing) => {
    const dx = x - car.x, dy = y - car.y, ahead = dx * fx + dy * fy, side = -dx * fy + dy * fx;
    if (ahead > 0 && ahead < reach && Math.abs(side) < halfWidth && closing > 0 && !(near && near.ahead < ahead)) {
      near = { ahead, side, halfWidth };
    }
  };
  for (const o of race.cars) if (o !== car && o.alive) check(o.x, o.y, HALF_WIDTH.car, vF - (o.vx * fx + o.vy * fy));
  for (const m of race.mines) check(m.x, m.y, HALF_WIDTH.mine, 1);
  for (const p of race.puddles) check(p.x, p.y, HALF_WIDTH.puddle, 1);
  if (!near) return;
  const at = lateral(race.track, car) + near.side; // onde o obstáculo está na pista
  const left = at - near.halfWidth - AVOID.clearance, right = at + near.halfWidth + AVOID.clearance;
  car.ai.offTarget = clamp(limit - right > left + limit ? right : left, -limit, limit);
  car.ai.offT = AVOID.time;
}

/**
 * Alvo para a CPU caçar: entre os carros ao alcance de uma arma de frente pronta e dentro do cone à
 * frente, o mais bem colocado na corrida (o líder primeiro); empatando, o mais perto. Ou null.
 */
export function pickTarget(race, car) {
  const ranges = car.loadout.front.filter((id) => ready(car, id)).map((id) => FRONT_RANGE[id] ?? 0);
  const range = Math.max(0, ...ranges);
  let best = null, bestD = 0;
  for (const o of race.cars) {
    if (o === car || !o.alive || o.invuln > 0 || o.finished) continue;
    const dx = o.x - car.x, dy = o.y - car.y, d = Math.hypot(dx, dy);
    if (d < HUNT.min || d > range || Math.abs(angDiff(Math.atan2(dy, dx), car.a)) > HUNT.cone) continue;
    if (!best || o.place < best.place || (o.place === best.place && d < bestD)) { best = o; bestD = d; }
  }
  return best;
}

// O carro mais perto logo atrás na pista (até BLOCK.range pontos), em qualquer faixa, ou null.
// Conta pela pista, e não pela distância: no X do Oito, quem passa pelo outro braço não está atrás.
function closestBehind(race, car) {
  const N = race.track.N;
  let best = null, bestGap = BLOCK.range;
  for (const o of race.cars) {
    if (o === car || !o.alive) continue;
    const gap = (car.idx - o.idx + N) % N;
    if (gap >= 3 && gap < bestGap) { best = o; bestGap = gap; }
  }
  return best;
}

// Quanto o carro está para o lado da linha central (px, positivo = direita).
function lateral(track, car) {
  const p = track.pts[car.idx], n = track.nrm[car.idx];
  return (car.x - p.x) * n.x + (car.y - p.y) * n.y;
}

// Mira no ponto da faixa escolhida um pouco à frente. Devolve o erro de direção (rad).
function steerTo(track, car, ti) {
  const target = trackPoint(track, ti, car.ai.off);
  const diff = angDiff(Math.atan2(target.y - car.y, target.x - car.x), car.a);
  car.input.steer = clamp(diff * 3, -1, 1);
  return diff;
}

/**
 * Velocidade que dá para levar agora sem passar do limite do pneu em nenhuma curva até onde o carro
 * consegue frear. As curvas são medidas pelo traçado de corrida, que é mais aberto que a linha central.
 * Usa a tração do próprio carro, então upgrades valem para a CPU.
 */
export function targetSpeed(track, car, speed) {
  const s = car.stats, skill = car.ai.skill, decel = s.brake * BRAKE_USE, radius = pathRadius(track, car);
  const reach = Math.ceil((speed * speed) / (2 * decel) / TRACK_SPACING) + 8;
  let limit = s.maxSpeed * skill;
  for (let k = 0; k <= reach; k += 2) {
    const corner = cornerSpeed(s, radius(car.idx + k)) * skill * CORNER_MARGIN * styleOf(car).corner;
    limit = Math.min(limit, Math.sqrt(corner * corner + 2 * decel * k * TRACK_SPACING));
  }
  return limit;
}

/**
 * Raio das curvas que o carro vai fazer, ponto a ponto: o do traçado, mais fechado se ele estiver por
 * dentro do traçado e mais aberto se estiver por fora. Entre onde o carro está agora e a faixa para onde
 * ele vai, conta a mais fechada, para não chegar rápido demais saindo de uma ultrapassagem.
 */
function pathRadius(track, car) {
  const curv = lineCurvature(track), now = lateral(track, car) - racingLine(track)[car.idx];
  const low = Math.min(now, car.ai.dev), high = Math.max(now, car.ai.dev);
  return (i) => {
    const c = curv[i % track.N];
    if (Math.abs(c) < 1 / STRAIGHT) return STRAIGHT;
    const inward = c > 0 ? high : -low; // quanto o carro está para o lado de dentro da curva
    return clamp(1 / Math.abs(c) - inward, MIN_RADIUS, STRAIGHT);
  };
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

// Puxa cada gatilho só quando vale a pena; a chance por segundo (agressividade) é o tempo de reação.
function fireAtWill(race, car, dt, speed, target) {
  const { rng } = race, inp = car.input, aggro = car.ai.aggro, { front, rear } = car.loadout;
  const pull = (id) => rng() < aggro * dt * (TRIGGER_RATE[id] ?? 8);
  inp.fire1 = ready(car, front[0]) && shotWouldHit(race, car, front[0]) && pull(front[0]);
  inp.fire2 = ready(car, front[1]) && shotWouldHit(race, car, front[1]) && pull(front[1]);
  const defend = car.place === 1 ? 2 : 1; // quem lidera protege a posição
  inp.rear = followerInLine(race, car, rear) && rng() < aggro * dt * 6 * defend * styleOf(car).rear;
  inp.extra = wantsNitro(race, car, dt, speed, target);
}

/**
 * Nitro em dois casos: numa reta comprida, para ganhar tempo, ou quando o carro travou (cola, batida,
 * explosão) e precisa recuperar velocidade rápido. Nos dois, só apontado ao longo da pista e se a pista à
 * frente aguentar o nitro ligado: com ele não dá para frear.
 */
function wantsNitro(race, car, dt, speed, target) {
  if (car.loadout.extra !== 'nitro' || !ready(car, 'nitro') || car.nitroT > 0) return false;
  // Virado de lado ou de ré (depois de rodar), o nitro jogaria o carro na mureta.
  if (Math.abs(angDiff(car.a, race.track.ang[car.idx])) > NITRO_USE.aim) return false;
  const stuck = car.status.glue > 0 || (race.time > NITRO_USE.calm && speed < target * NITRO_USE.recover);
  if (!stuck && speed < NITRO_USE.cruise) return false;
  return nitroFits(race.track, car, speed) && race.rng() < dt * NITRO_USE.rate[stuck ? 'stuck' : 'straight'];
}

/**
 * Um tiro disparado agora acerta alguém? Leva em conta a velocidade do tiro e a do alvo (o alvo anda
 * enquanto o tiro voa) e, para tiros que não quicam, que o caminho fique dentro da pista: numa curva o
 * tiro reto bate na mureta antes de chegar.
 */
export function shotWouldHit(race, car, id) {
  const w = WEAPONS[id], spec = w.shot, speed = shotSpeed(car, w);
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  const sx = car.x + fx * 20, sy = car.y + fy * 20, svx = fx * speed, svy = fy * speed;
  const maxT = Math.min(spec.life, (FRONT_RANGE[id] ?? Infinity) / speed);
  return race.cars.some((o) => {
    if (o === car || !o.alive || o.invuln > 0) return false;
    const rx = o.x - sx, ry = o.y - sy, ux = o.vx - svx, uy = o.vy - svy;
    const t = clamp(-(rx * ux + ry * uy) / (ux * ux + uy * uy || 1), 0, maxT); // quando passam mais perto
    const mx = rx + ux * t, my = ry + uy * t;
    if (mx * mx + my * my > (spec.radius * AIM_TOLERANCE) ** 2) return false;
    return spec.bounce || pathOnTrack(race.track, car, sx, sy, svx * t, svy * t);
  });
}

// Três pontos do caminho do tiro ficam dentro da pista? (A mesma folga de `updateShots`.)
function pathOnTrack(track, car, x, y, dx, dy) {
  for (let k = 1; k <= 3; k++) {
    const px = x + (dx * k) / 3, py = y + (dy * k) / 3;
    const hint = car.idx + Math.round(Math.hypot(px - car.x, py - car.y) / TRACK_SPACING);
    if (nearestOnTrack(track, px, py, hint, 30).dist > track.half + 6) return false;
  }
  return true;
}

// Alguém vem atrás e vai passar por cima do que cair agora? Prevê de que lado ele estará quando chegar
// ao ponto da queda. Óleo e PEM só valem com uma curva logo à frente.
function followerInLine(race, car, id) {
  if (!ready(car, id)) return false;
  if (BEFORE_CORNER.has(id) && race.track.turn[car.idx] < CORNER_AHEAD) return false;
  const reach = WEAPONS[id].mine ? MINES.radius : PUDDLES.radius;
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  return race.cars.some((o) => {
    if (o === car || !o.alive) return false;
    const dx = o.x - car.x, dy = o.y - car.y;
    const behind = -(dx * fx + dy * fy) - DROP_BACK, coming = o.vx * fx + o.vy * fy;
    if (behind < 0 || behind > REAR_RANGE[id] || coming < 30) return false;
    const t = behind / coming, side = -dx * fy + dy * fx + (-o.vx * fy + o.vy * fx) * t;
    return Math.abs(side) < reach;
  });
}

/**
 * Com o nitro não dá para frear. Simula o efeito a partir da velocidade de agora: o carro acelera até a
 * velocidade do nitro seguindo na faixa em que está (conta a curva da pista, um pouco mais fechada), e
 * nenhuma curva no caminho pode pedir menos que `slack` da velocidade daquele momento. Quando o efeito
 * acaba, ainda precisa dar para frear até cada curva seguinte do traçado.
 */
export function nitroFits(track, car, speed) {
  const s = car.stats, top = s.maxSpeed * NITRO.speed, boost = s.accel * NITRO.accel, decel = s.brake * BRAKE_USE;
  const radius = pathRadius(track, car), side = Math.abs(lateral(track, car));
  const cornerAt = (r) => cornerSpeed(s, r) * car.ai.skill * CORNER_MARGIN * styleOf(car).corner;
  let v = Math.max(0, speed), d = 0;
  for (let t = 0; t < NITRO.duration; t += NITRO_USE.step) {
    v = Math.min(top, v + boost * NITRO_USE.step);
    d += v * NITRO_USE.step;
    const i = car.idx + Math.round(d / TRACK_SPACING);
    if (cornerAt(clamp(track.radius[i % track.N] - side, MIN_RADIUS, STRAIGHT)) < v * NITRO_USE.slack) return false;
  }
  for (let k = 0; k <= (v * v) / (2 * decel); k += 2 * TRACK_SPACING) {
    const corner = cornerAt(radius(car.idx + Math.round((d + k) / TRACK_SPACING)));
    if (Math.sqrt(corner * corner + 2 * decel * k) < v) return false;
  }
  return true;
}
