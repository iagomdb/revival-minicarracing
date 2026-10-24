import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_STYLES, DIFFICULTIES, STEP } from '../src/config.js';
import { seededRandom } from '../src/core/math.js';
import { driveAI, nitroFits, pickTarget, shotWouldHit, targetSpeed } from '../src/sim/ai.js';
import { refreshStats } from '../src/sim/car.js';
import { refillAmmo } from '../src/sim/loadout.js';
import { createRace } from '../src/sim/race.js';
import { laneLimit, lineLimit, racingLine } from '../src/sim/racing-line.js';
import { cornerSpeed } from '../src/sim/stats.js';
import { createTrack, nearestOnTrack, roundCorners, trackPoint } from '../src/sim/track.js';
import { getTrack, TRACKS } from '../src/sim/tracks/index.js';

// Pistas de teste: retângulos de cantos arredondados, rodados no sentido horário (4 curvas para a direita).
// Na reta de cima o carro anda para a direita (+x), e o lado direito (offset positivo) é o de dentro.
const rectangle = (w, h, r) => createTrack({ id: 'teste', name: 'Teste', points: roundCorners([[0, 0, r], [w, 0, r], [w, h, r], [0, h, r]]) });
const oval = rectangle(3000, 900, 200);   // retas compridas
const narrow = rectangle(2000, 400, 150); // as duas retas compridas ficam a 400 px uma da outra
const idxAt = (track, x, y) => nearestOnTrack(track, x, y).idx;

// Corrida só com os `count` primeiros carros da CPU, já depois da largada e com o equipamento pedido.
// Eles ficam sem perfil de comportamento (o jeito padrão da IA), a não ser que o teste escolha um.
function setup(track, count, loadout = { front: ['laser'], rear: 'mine', extra: 'nitro' }) {
  const race = createRace({ track, mode: 'demo', rng: seededRandom(1) });
  race.state = 'race';
  for (const c of race.cars.slice(count)) Object.assign(c, { alive: false, respawnT: Infinity });
  const cars = race.cars.slice(0, count);
  for (const c of cars) {
    Object.assign(c, { lap: 0, loadout: { ...loadout } });
    Object.assign(c.ai, { aggro: 1, style: null });
    refillAmmo(c);
  }
  return { race, cars };
}

// Põe o carro no ponto `idx`, `off` px para o lado, andando a `speed` px/s na direção da pista.
function place(track, car, idx, off = 0, speed = 0) {
  const p = trackPoint(track, idx, off), a = track.ang[idx];
  Object.assign(car, { x: p.x, y: p.y, a, idx, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, invuln: 0 });
}

// Roda a IA com o carro parado no lugar por até `seconds` e diz se ela apertou a tecla `key` alguma vez.
function pressedWithin(race, car, key, seconds) {
  for (let t = 0; t < seconds; t += STEP) {
    driveAI(race, car, STEP, true, true);
    if (car.input[key]) return true;
  }
  return false;
}

// Raio da curva que o traçado faz no ponto `i` (círculo por três pontos dele).
function lineRadius(track, line, i, span = 6) {
  const at = (k) => trackPoint(track, (k + track.N) % track.N, line[(k + track.N) % track.N]);
  const a = at(i - span), b = at(i), c = at(i + span);
  const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ca = Math.hypot(a.x - c.x, a.y - c.y);
  return (ab * bc * ca) / (2 * Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)));
}

test('o traçado de corrida usa só a parte da largura em RACING_LINE, chegando aos dois lados dela', () => {
  for (const track of [...TRACKS.map((t) => getTrack(t.id)), oval]) {
    const line = racingLine(track), limit = lineLimit(track);
    assert.equal(line.length, track.N);
    assert.ok(limit <= laneLimit(track), `${track.name}: o traçado não pode passar da margem da mureta`);
    assert.ok(line.every((off) => Math.abs(off) <= limit + 1e-9), `${track.name}: passou do limite do traçado`);
    assert.ok(Math.max(...line) > 0.75 * limit && Math.min(...line) < -0.75 * limit, `${track.name}: não usa a largura permitida`);
  }
});

test('o traçado abre na reta, tangencia o lado de dentro da curva e faz a curva mais aberta que o centro', () => {
  const line = racingLine(oval), limit = lineLimit(oval);
  // Meio de cada curva de 90° (o raio delas é 200 px, com o centro 200 px para dentro do canto).
  const apexes = [[2941, 59], [2941, 841], [59, 841], [59, 59]].map(([x, y]) => idxAt(oval, x, y));
  for (const i of apexes) {
    assert.ok(line[i] > 0.5 * limit, `no meio da curva fica do lado de dentro: ${line[i].toFixed(0)} px`);
    assert.ok(lineRadius(oval, line, i) > oval.radius[i] * 1.2, 'curva mais aberta que a da linha central');
  }
  for (const [x, y] of [[1500, 0], [1500, 900]]) {
    const off = line[idxAt(oval, x, y)];
    assert.ok(off < -0.5 * limit, `no meio da reta comprida fica do lado de fora: ${off.toFixed(0)} px`);
  }
});

test('a CPU freia para a curva pelo traçado: entra mais rápido que pela linha central, e mais devagar por dentro dele', () => {
  const { cars: [me] } = setup(oval, 1);
  me.model = 'flecha'; // pouca tração: a velocidade de curva fica abaixo da máxima, sem teto no caminho
  refreshStats(me);
  const apex = idxAt(oval, 2941, 59), line = racingLine(oval);
  place(oval, me, apex, line[apex], 300);
  me.ai.dev = 0;
  const onLine = targetSpeed(oval, me, 300);
  const byCenter = cornerSpeed(me.stats, oval.radius[apex]) * me.ai.skill * 0.95; // como era antes
  assert.ok(onLine > byCenter, `pelo traçado ${onLine.toFixed(0)} px/s, pelo centro ${byCenter.toFixed(0)} px/s`);

  me.ai.dev = 60; // indo 60 px para dentro do traçado (a curva é para a direita)
  const inside = targetSpeed(oval, me, 300);
  assert.ok(inside < onLine, `por dentro ${inside.toFixed(0)} px/s, no traçado ${onLine.toFixed(0)} px/s`);
});

test('alcançando um carro mais lento, a CPU passa pelo lado com mais espaço; um carro mais rápido não', () => {
  const { race, cars: [me, other] } = setup(oval, 2);
  const i = idxAt(oval, 800, 0);
  place(oval, me, i, 0, 400);
  place(oval, other, i + 12, 20, 150); // 120 px à frente, um pouco à direita e bem mais devagar
  driveAI(race, me, STEP, true, false);
  assert.ok(me.ai.offT > 0);
  assert.ok(me.ai.offTarget < 20 - 22, `passa pela esquerda: faixa ${me.ai.offTarget.toFixed(0)} px`);

  const { race: race2, cars: [me2, fast] } = setup(oval, 2);
  place(oval, me2, i, 0, 400);
  place(oval, fast, i + 12, 20, 500);
  driveAI(race2, me2, STEP, true, false);
  assert.equal(me2.ai.offT, 0);
});

test('com dois alvos ao alcance, a CPU mira no mais bem colocado e puxa a faixa para a dele', () => {
  const { race, cars: [me, a, b] } = setup(oval, 3);
  const i = idxAt(oval, 800, 0);
  place(oval, me, i, 0, 100);
  place(oval, a, i + 26, -25); // 260 px à frente, à esquerda
  place(oval, b, i + 32, 25);  // 320 px à frente, à direita
  Object.assign(me, { place: 6 });
  a.place = 5;
  b.place = 1;
  assert.equal(pickTarget(race, me), b);
  for (let t = 0; t < 1; t += STEP) driveAI(race, me, STEP, true, true);
  assert.ok(me.ai.off > 0, `faixa: ${me.ai.off.toFixed(0)} px`);

  b.place = 7;
  assert.equal(pickTarget(race, me), a);
});

test('a CPU só atira quando o tiro previsto acerta, inclusive num alvo que está cruzando a linha', () => {
  const { race, cars: [me, target] } = setup(oval, 2);
  const i = idxAt(oval, 800, 0);
  place(oval, me, i, 0, 300);
  place(oval, target, i + 30, 0, 300); // 300 px à frente, na linha do tiro
  assert.ok(shotWouldHit(race, me, 'laser'));
  assert.ok(pressedWithin(race, me, 'fire1', 1));

  place(oval, target, i + 30, 45, 300); // fora da linha do tiro, andando reto
  assert.ok(!shotWouldHit(race, me, 'laser'));
  assert.ok(!pressedWithin(race, me, 'fire1', 1));

  // O laser (1050 + 300 px/s) chega em ~0,27 s; nesse tempo o alvo, vindo para o meio a 170 px/s, entra na linha.
  const n = oval.nrm[i + 30];
  target.vx -= n.x * 170;
  target.vy -= n.y * 170;
  assert.ok(shotWouldHit(race, me, 'laser'));
});

test('a CPU não atira se o tiro vai bater na mureta antes de chegar no alvo', () => {
  const { race, cars: [me, target] } = setup(narrow, 2);
  place(narrow, me, idxAt(narrow, 1000, 0));
  place(narrow, target, idxAt(narrow, 1000, 400));
  me.a = Math.PI / 2; // virado para a reta de baixo, através do canteiro
  assert.ok(!shotWouldHit(race, me, 'laser'));
});

test('a CPU solta a mina quando quem vem atrás vai passar por cima', () => {
  const { race, cars: [me, chaser] } = setup(oval, 2);
  const i = idxAt(oval, 1500, 0);
  place(oval, me, i, 0, 300);
  place(oval, chaser, i - 12, 0, 320); // 120 px atrás, na mesma faixa
  assert.ok(pressedWithin(race, me, 'rear', 1));
  place(oval, chaser, i - 12, 45, 320); // atrás, mas em outra faixa
  assert.ok(!pressedWithin(race, me, 'rear', 1));
});

test('o óleo só cai com uma curva logo à frente', () => {
  const { race, cars: [me, chaser] } = setup(oval, 2, { front: ['laser'], rear: 'oil', extra: 'nitro' });
  for (const [x, wanted] of [[1500, false], [2700, true]]) {
    const i = idxAt(oval, x, 0);
    place(oval, me, i, 0, 300);
    place(oval, chaser, i - 12, 0, 320);
    assert.equal(pressedWithin(race, me, 'rear', 1), wanted, `x = ${x}`);
  }
});

test('a CPU usa o nitro no começo de uma reta comprida, e não perto de uma curva', () => {
  const { race, cars: [me] } = setup(oval, 1);
  place(oval, me, idxAt(oval, 300, 0), 0, 350);
  assert.ok(pressedWithin(race, me, 'extra', 3));
  place(oval, me, idxAt(oval, 2500, 0), 0, 350);
  assert.ok(!pressedWithin(race, me, 'extra', 3));
});

test('saindo parado, o nitro precisa de menos reta do que com o carro já embalado', () => {
  const { cars: [me] } = setup(oval, 1);
  me.model = 'micro';
  refreshStats(me);
  me.ai.skill = 1;
  place(oval, me, idxAt(oval, 1700, 0)); // 1100 px antes da curva
  assert.ok(nitroFits(oval, me, 0), 'parado: dá tempo de embalar e ainda frear');
  assert.ok(!nitroFits(oval, me, 400), 'a 400 px/s: chega rápido demais na curva');
});

test('a CPU usa o nitro para recuperar quando travou, mas não na largada nem virada para a mureta', () => {
  const { race, cars: [me] } = setup(oval, 1);
  const i = idxAt(oval, 1000, 0);
  race.time = 10;
  place(oval, me, i, 0, 40); // quase parada no meio da reta (bateu, rodou ou acabou de voltar)
  assert.ok(pressedWithin(race, me, 'extra', 1));

  race.time = 1; // logo depois da largada todo mundo está devagar: isso não é travar
  place(oval, me, i, 0, 40);
  assert.ok(!pressedWithin(race, me, 'extra', 1));

  race.time = 10;
  place(oval, me, i, 0, 40);
  me.a += Math.PI / 2; // virada para a mureta
  assert.ok(!pressedWithin(race, me, 'extra', 1));
});

test('presa na cola, a CPU usa o nitro mesmo devagar e logo no começo da corrida', () => {
  const { race, cars: [me] } = setup(oval, 1);
  race.time = 1;
  place(oval, me, idxAt(oval, 1000, 0), 0, 120);
  me.status.glue = 1;
  assert.ok(pressedWithin(race, me, 'extra', 1));
});

test('cada carro da CPU recebe um perfil: os três aparecem, o jogador fica sem, e a mesma semente repete', () => {
  const stylesOf = (seed) => createRace({ track: oval, rng: seededRandom(seed) }).cars.map((c) => c.ai.style);
  const styles = stylesOf(5), cpu = styles.slice(0, -1);
  assert.equal(styles.at(-1), null, 'o jogador não tem perfil');
  assert.ok(cpu.every((s) => Object.hasOwn(AI_STYLES, s)));
  assert.deepEqual([...new Set(cpu)].sort(), Object.keys(AI_STYLES).sort());
  assert.deepEqual(stylesOf(5), styles);
});

test('o perfil vale por cima da dificuldade', () => {
  const race = createRace({ track: oval, rng: seededRandom(5), difficulty: 'dificil' }), d = DIFFICULTIES.dificil;
  for (const c of race.cars.filter((c) => !c.isPlayer)) {
    const s = AI_STYLES[c.ai.style];
    assert.equal(c.ai.aggro, d.aggro * s.aggro);
    assert.equal(c.ai.dodge, Math.min(1, d.dodge * s.dodge));
  }
});

// Faixa (px) que um carro com o perfil `style` escolhe depois de 1 s parado no lugar, com outro carro
// posto por `setOther` (que recebe esse outro carro e o índice da pista do carro do teste).
function laneAfter(style, speed, setOther) {
  const { race, cars: [me, other] } = setup(oval, 2);
  const i = idxAt(oval, 800, 0);
  place(oval, me, i, 0, speed);
  setOther(other, i);
  me.ai.style = style;
  for (let t = 0; t < 1; t += STEP) driveAI(race, me, STEP, true, true);
  return { off: me.ai.off, line: racingLine(oval)[i + Math.round(7 + speed / 40)] };
}

test('o agressivo muda de faixa para caçar o alvo; o piloto fica no traçado', () => {
  const preyAhead = (o, i) => place(oval, o, i + 30, 25); // 300 px à frente, à direita
  const aggressive = laneAfter('agressivo', 100, preyAhead), pilot = laneAfter('piloto', 100, preyAhead);
  assert.ok(aggressive.off > 0, `agressivo: faixa ${aggressive.off.toFixed(0)} px`);
  assert.ok(Math.abs(pilot.off - pilot.line) < 15, `piloto: ${pilot.off.toFixed(0)} px, traçado ${pilot.line.toFixed(0)} px`);
});

test('o defensivo fecha a faixa de quem vem colado atrás', () => {
  const chaserBehind = (o, i) => place(oval, o, i - 12, 30, 320); // 120 px atrás, à direita
  const defensive = laneAfter('defensivo', 300, chaserBehind), pilot = laneAfter('piloto', 300, chaserBehind);
  assert.ok(defensive.off > pilot.off + 20, `defensivo ${defensive.off.toFixed(0)} px, piloto ${pilot.off.toFixed(0)} px`);
});

test('o piloto faz as curvas mais perto do limite do pneu', () => {
  const { cars: [me] } = setup(oval, 1);
  me.model = 'flecha';
  refreshStats(me);
  const apex = idxAt(oval, 2941, 59);
  place(oval, me, apex, racingLine(oval)[apex], 300);
  me.ai.dev = 0;
  const plain = targetSpeed(oval, me, 300);
  me.ai.style = 'piloto';
  assert.ok(targetSpeed(oval, me, 300) > plain);
});
