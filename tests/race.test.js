import assert from 'node:assert/strict';
import test from 'node:test';
import { GRID_SIZE, STEP, WEAPONS } from '../src/config.js';
import { seededRandom } from '../src/core/math.js';
import { drainEvents } from '../src/sim/events.js';
import { equipped } from '../src/sim/loadout.js';
import { createRace, updateRace } from '../src/sim/race.js';
import { gridSlot } from '../src/sim/track.js';
import { getTrack, TRACKS } from '../src/sim/tracks/index.js';

const track = getTrack('deserto');
const newRace = (seed = 1, difficulty = 'medio', t = track) => createRace({ track: t, mode: 'play', difficulty, rng: seededRandom(seed) });

// Avança a corrida até `done()` ser verdade (ou o tempo acabar) e devolve os eventos que aconteceram.
function runUntil(race, done, maxSeconds = 300) {
  const events = [];
  for (let t = 0; t < maxSeconds && !done(); t += STEP) {
    updateRace(race, STEP);
    events.push(...drainEvents(race));
  }
  return events;
}
const runFor = (race, seconds) => { let t = 0; return runUntil(race, () => (t += STEP) > seconds, seconds + 1); };

for (const { id, name } of TRACKS) {
  test(`${name}: uma corrida inteira com a CPU termina, e os carros completam as voltas`, () => {
    const race = newRace(1, 'dificil', getTrack(id));
    race.player.autopilot = true;
    const events = runUntil(race, () => race.state === 'done');

    assert.equal(race.state, 'done');
    assert.ok(events.some((e) => e.type === 'race-over'));
    assert.ok(race.cars.filter((c) => c.finished).length >= GRID_SIZE - 2, 'quase todos chegam antes do fim');
    for (const c of race.cars) assert.ok(Number.isFinite(c.x + c.y + c.vx + c.vy + c.a), `${c.name} tem valor inválido`);
    assert.deepEqual(race.ranking.map((c) => c.place), [1, 2, 3, 4, 5, 6, 7, 8]);
  });
}

test('a mesma semente gera exatamente a mesma corrida', () => {
  const a = newRace(7), b = newRace(7);
  a.player.autopilot = b.player.autopilot = true;
  runFor(a, 30);
  runFor(b, 30);
  assert.deepEqual(a.cars.map((c) => [c.x, c.y, c.armor]), b.cars.map((c) => [c.x, c.y, c.armor]));
});

for (const { id, name } of TRACKS) {
  test(`${name}: sair antes do verde explode o carro e ele volta atrás do grid`, () => {
    const t = getTrack(id), race = newRace(1, 'medio', t);
    const p = race.player;
    p.input.up = true;
    const early = runUntil(race, () => race.state !== 'countdown');

    assert.ok(early.some((e) => e.type === 'false-start' && e.car === p));
    assert.equal(p.alive, false);
    runFor(race, 1);
    assert.equal(p.alive, true);
    assert.equal(p.lap, -1);
    assert.ok(p.idx < gridSlot(t, GRID_SIZE - 1).idx, 'volta atrás do último lugar do grid');
  });
}

test('as armas só valem depois da largada, e a munição recarrega a cada volta sem acumular', () => {
  const race = newRace(3);
  const p = race.player, laser = p.loadout.front[0];
  const fullAmmo = Object.fromEntries(equipped(p.loadout).map((id) => [id, WEAPONS[id].ammo]));
  assert.deepEqual(p.ammo, {}, 'sem munição antes da largada');
  p.autopilot = true;
  runUntil(race, () => p.lap === 0);
  assert.deepEqual(p.ammo, fullAmmo);

  // Segura a arma 1 até acabar a munição da volta.
  p.autopilot = false;
  Object.assign(p.input, { up: true, steer: 0, fire1: true });
  const shots = runFor(race, 1.5).filter((e) => e.type === 'shot' && e.car === p && e.weapon === laser);
  assert.equal(shots.length, WEAPONS[laser].ammo);
  assert.equal(p.ammo[laser], 0);

  // Na volta seguinte recarrega até o limite, não além dele.
  p.input.fire1 = false;
  p.autopilot = true;
  runUntil(race, () => p.lap === 1);
  assert.deepEqual(p.ammo, fullAmmo);
});
