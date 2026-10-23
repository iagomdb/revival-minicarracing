import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LOADOUT, EFFECTS, NITRO, PUDDLES, STEP, WEAPONS } from '../src/config.js';
import { angDiff, seededRandom } from '../src/core/math.js';
import { dodgeShots } from '../src/sim/ai.js';
import { drive } from '../src/sim/car.js';
import { drainEvents } from '../src/sim/events.js';
import { refillAmmo, sanitizeLoadout } from '../src/sim/loadout.js';
import { createRace, updateRace } from '../src/sim/race.js';
import { createTrack, trackPoint } from '../src/sim/track.js';
import desert from '../src/sim/tracks/desert.js';
import { updateMines, updatePuddles, updateShots, useWeapon } from '../src/sim/weapons.js';

const track = createTrack(desert);

function place(car, idx, off = 0) {
  const p = trackPoint(track, idx, off);
  Object.assign(car, { x: p.x, y: p.y, a: track.ang[idx], idx, vx: 0, vy: 0, invuln: 0 });
}

// Dois carros parados na reta de largada, um atrás do outro; os outros saem da corrida.
function duel({ gap = 200, targetOffset = 0, loadout = { front: ['rocket', 'mg'], rear: 'emp', extra: 'nitro' } } = {}) {
  const race = createRace({ track, rng: seededRandom(1) });
  race.state = 'race';
  const [shooter, target] = race.cars;
  for (const c of race.cars.slice(2)) Object.assign(c, { alive: false, respawnT: Infinity });
  place(shooter, 5);
  place(target, 5 + gap / 10, targetOffset);
  shooter.loadout = loadout;
  refillAmmo(shooter);
  return { race, shooter, target };
}

const run = (seconds, fn) => { for (let t = 0; t < seconds; t += STEP) fn(); };
const speedOf = (car) => Math.hypot(car.vx, car.vy);

// Uma mancha de óleo ou cola já armada no ponto (x, y).
function pour(race, owner, effect, x, y) {
  race.puddles.push({ weapon: effect, effect, owner, x, y, armT: 0, age: 0, life: 20, inside: new Set() });
}

test('foguete vai reto e tira 60 de vida', () => {
  const { race, shooter, target } = duel();
  useWeapon(race, shooter, 'rocket');
  run(1, () => updateShots(race, STEP));
  assert.equal(target.armor, target.stats.armor - WEAPONS.rocket.shot.damage);
  assert.equal(shooter.ammo.rocket, WEAPONS.rocket.ammo - 1);
});

test('metralhadora: rajada de 20 tiros de 4 de dano', () => {
  const { race, shooter, target } = duel({ gap: 150 });
  run(3, () => {
    useWeapon(race, shooter, 'mg');
    shooter.cooldown.mg = Math.max(0, shooter.cooldown.mg - STEP);
    updateShots(race, STEP);
  });
  const shots = drainEvents(race).filter((e) => e.type === 'shot' && e.weapon === 'mg');
  const taken = target.stats.armor - target.armor;
  assert.equal(shots.length, 20);
  assert.equal(shooter.ammo.mg, 0);
  assert.ok(taken > 0 && taken <= 80 && taken % 4 === 0, `dano recebido: ${taken}`);
});

test('mina PEM tira 10 e inverte a direção por 2 segundos', () => {
  const { race, shooter, target } = duel();
  race.mines.push({ weapon: 'emp', owner: shooter, x: target.x, y: target.y, armT: 0, age: 0 });
  updateMines(race, STEP);
  assert.equal(target.armor, target.stats.armor - WEAPONS.emp.mine.damage);
  assert.equal(target.status.emp, EFFECTS.emp.duration);

  // Virando para a direita, o carro vai para a esquerda.
  const a0 = target.a;
  target.vx = Math.cos(a0) * 150;
  target.vy = Math.sin(a0) * 150;
  target.input.steer = 1;
  run(0.2, () => drive(target, STEP));
  assert.ok(angDiff(target.a, a0) < 0);
});

test('óleo: sem tração, o carro segue deslizando na direção em que vinha e vai perdendo velocidade', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  pour(race, shooter, 'oil', target.x, target.y);
  updatePuddles(race, STEP);
  assert.equal(target.status.oil, EFFECTS.oil.duration);

  // Andando meio de lado, com acelerador e volante: nada disso muda a trajetória.
  const way = target.a + 0.5, a0 = target.a;
  target.vx = Math.cos(way) * 300;
  target.vy = Math.sin(way) * 300;
  target.spin = 0;
  Object.assign(target.input, { up: true, steer: 1 });
  run(0.5, () => drive(target, STEP));
  assert.ok(Math.abs(angDiff(Math.atan2(target.vy, target.vx), way)) < 1e-9, 'a direção do deslize não muda');
  assert.ok(Math.abs(speedOf(target) - (300 - EFFECTS.oil.slowdown * 0.5)) < 2, `velocidade: ${speedOf(target).toFixed(0)}`);
  assert.ok(angDiff(target.a, a0) > 0.5, 'o volante ainda gira a carroceria');
});

test('óleo: o carro gira para um lado sorteado, e o giro só some depois que a tração volta', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  pour(race, shooter, 'oil', target.x, target.y);
  updatePuddles(race, STEP);
  const spin = target.spin, [min, max] = EFFECTS.oil.spin;
  assert.ok(Math.abs(spin) >= min && Math.abs(spin) <= max, `giro: ${spin.toFixed(2)}`);

  target.vx = Math.cos(target.a) * 300;
  target.vy = Math.sin(target.a) * 300;
  run(1, () => drive(target, STEP));
  assert.equal(target.spin, spin);
  target.status.oil = 0;
  run(1, () => drive(target, STEP));
  assert.ok(Math.abs(target.spin) < Math.abs(spin) / 2);
});

test('óleo: no último segundo a tração volta aos poucos', () => {
  // Quanto sobra de uma velocidade de lado de 150 px/s depois de 0,1 s, com o tempo do óleo parado.
  const sideAfter = (oilLeft) => {
    const { target } = duel({ loadout: DEFAULT_LOADOUT });
    const fx = Math.cos(target.a), fy = Math.sin(target.a);
    target.status.oil = oilLeft;
    target.vx = fx * 200 - fy * 150;
    target.vy = fy * 200 + fx * 150;
    run(0.1, () => drive(target, STEP));
    return -target.vx * fy + target.vy * fx;
  };
  const { duration, recover } = EFFECTS.oil;
  const side = [duration, recover * 0.75, recover * 0.5, recover * 0.25, 0].map(sideAfter);
  for (let k = 1; k < side.length; k++) {
    assert.ok(side[k] < side[k - 1], `de lado: ${side.map((v) => v.toFixed(0)).join(' > ')}`);
  }
});

test('óleo: 1 s sem tração, 1 s recuperando, e quem parou em cima da mancha consegue sair', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  Object.assign(shooter, { alive: false, respawnT: Infinity });
  pour(race, shooter, 'oil', target.x, target.y);
  const { duration, recover } = EFFECTS.oil;
  const step = () => updateRace(race, STEP);
  const away = () => Math.hypot(target.x - race.puddles[0].x, target.y - race.puddles[0].y);
  step();
  assert.equal(target.status.oil, duration);

  run(duration - recover - 0.05, step); // a CPU acelera, mas sem tração o carro não sai do lugar
  assert.equal(speedOf(target), 0);
  run(recover, step);
  assert.ok(target.status.oil > 0);
  run(0.1, step);
  assert.equal(target.status.oil, 0);

  for (let t = 0; t < 2 && away() <= PUDDLES.radius; t += STEP) step();
  assert.ok(away() > PUDDLES.radius, 'com a tração de volta, ela sai da mancha');
});

test('cola: o carro para ao entrar, atravessa a mancha a 30% da máxima e volta ao normal ao sair', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  const fx = Math.cos(target.a), fy = Math.sin(target.a);
  pour(race, shooter, 'glue', target.x + fx * 60, target.y + fy * 60);
  const away = () => Math.hypot(target.x - race.puddles[0].x, target.y - race.puddles[0].y);
  const top = target.stats.maxSpeed * EFFECTS.glue.speed;
  target.vx = fx * 300;
  target.vy = fy * 300;
  target.input.up = true;

  let entrySpeed = null, fastest = 0, glueOutside = false;
  run(3, () => {
    drive(target, STEP);
    updatePuddles(race, STEP);
    if (target.status.glue > 0) {
      entrySpeed ??= speedOf(target);
      fastest = Math.max(fastest, speedOf(target));
    }
    if (away() > PUDDLES.radius && target.status.glue > 0) glueOutside = true;
  });
  assert.equal(entrySpeed, 0, 'para na hora');
  assert.ok(fastest <= top + 1e-6, `mais rápido na cola: ${fastest.toFixed(0)}`);
  assert.ok(away() > PUDDLES.radius, 'atravessou a mancha');
  assert.equal(glueOutside, false, 'fora da mancha, não sobra cola');
  assert.ok(speedOf(target) > top, 'fora da cola, volta a acelerar');
  assert.equal(drainEvents(race).filter((e) => e.type === 'status').length, 1, 'um aviso por entrada');
});

test('cola: nem acelerando com nitro o carro passa de 30% da máxima', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  pour(race, shooter, 'glue', target.x, target.y);
  updatePuddles(race, STEP);
  const top = target.stats.maxSpeed * EFFECTS.glue.speed;
  target.input.up = true;
  target.nitroT = NITRO.duration;
  let fastest = 0;
  run(1, () => { // só a física: o carro conta como em cima da cola o tempo todo
    drive(target, STEP);
    fastest = Math.max(fastest, speedOf(target));
  });
  assert.ok(fastest > top - 1 && fastest <= top + 1e-6, `mais rápido: ${fastest.toFixed(0)}`);
});

test('a CPU atravessa a cola sem travar', () => {
  const { race, shooter, target } = duel({ loadout: DEFAULT_LOADOUT });
  Object.assign(shooter, { alive: false, respawnT: Infinity });
  pour(race, shooter, 'glue', target.x, target.y);
  const x0 = target.x, y0 = target.y;
  run(3, () => updateRace(race, STEP));
  assert.equal(target.status.glue, 0);
  assert.ok(Math.hypot(target.x - x0, target.y - y0) > 200);
});

test('a CPU percebe um foguete vindo e muda de faixa para longe dele', () => {
  const { race, shooter, target } = duel({ targetOffset: 10 }); // alvo um pouco à direita da linha do tiro
  target.ai.dodge = 1;
  useWeapon(race, shooter, 'rocket');
  dodgeShots(race, target);
  assert.ok(target.ai.dodgeT > 0);
  assert.ok(target.ai.offTarget > 10, `nova faixa: ${target.ai.offTarget.toFixed(0)}`);
});

test('a CPU que não percebe o tiro não desvia', () => {
  const { race, shooter, target } = duel();
  target.ai.dodge = 0;
  useWeapon(race, shooter, 'rocket');
  dodgeShots(race, target);
  assert.equal(target.ai.dodgeT, 0);
});

test('o carro do jogador sai com o equipamento escolhido', () => {
  const playerLoadout = { front: ['rocket', 'laser'], rear: 'glue', extra: 'nitro' };
  const race = createRace({ track, rng: seededRandom(2), playerCar: 'arsenal', playerLoadout }); // 2 armas de frente
  assert.deepEqual(race.player.loadout, playerLoadout);
  refillAmmo(race.player);
  assert.deepEqual(race.player.ammo, { rocket: 2, laser: 4, glue: 2, nitro: 1 });
});

test('arma repetida ou desconhecida é trocada por uma do padrão; o resto do equipamento fica', () => {
  assert.deepEqual(sanitizeLoadout({ front: ['mg', 'mg'], rear: 'oil', extra: 'nitro' }, 'arsenal'), { front: ['mg', 'laser'], rear: 'oil', extra: 'nitro' });
  assert.deepEqual(sanitizeLoadout({ front: ['laser', 'canhão'], rear: 'oil', extra: 'nitro' }, 'arsenal'), { front: ['laser', 'mg'], rear: 'oil', extra: 'nitro' });
  assert.deepEqual(sanitizeLoadout(null, 'micro'), { front: [DEFAULT_LOADOUT.front[0]], rear: DEFAULT_LOADOUT.rear, extra: DEFAULT_LOADOUT.extra });
});
