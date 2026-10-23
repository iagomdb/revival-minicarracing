import assert from 'node:assert/strict';
import test from 'node:test';
import { GRID_SIZE, TRACK_SPACING } from '../src/config.js';
import { gridSlot, nearestOnTrack } from '../src/sim/track.js';
import { getTrack, TRACKS } from '../src/sim/tracks/index.js';

const STRAIGHT = 1000; // raio (px) a partir do qual o trecho conta como reta

for (const { id, name } of TRACKS) {
  const track = getTrack(id);

  test(`${name}: os pontos da linha central ficam igualmente espaçados, inclusive no fechamento da volta`, () => {
    for (let i = 0; i < track.N; i++) {
      const a = track.pts[i], b = track.pts[(i + 1) % track.N];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      assert.ok(Math.abs(d - TRACK_SPACING) < 1.5, `ponto ${i}: espaçamento ${d.toFixed(2)}`);
    }
  });

  test(`${name}: o ponto mais próximo de um ponto da pista é ele mesmo`, () => {
    for (const i of [0, 100, 333, track.N - 1]) {
      const p = track.pts[i];
      const n = nearestOnTrack(track, p.x, p.y);
      assert.ok(n.dist < 0.001);
      assert.ok([i, (i - 1 + track.N) % track.N].includes(n.idx));
    }
  });

  test(`${name}: todos os lugares do grid ficam numa reta, atrás da linha de chegada e fora do cruzamento`, () => {
    for (let k = 0; k < GRID_SIZE; k++) {
      const { idx } = gridSlot(track, k);
      assert.ok(idx > track.N * 0.9, `lugar ${k}`);
      assert.ok(track.radius[idx] >= STRAIGHT, `lugar ${k} numa curva de raio ${track.radius[idx].toFixed(0)} px`);
      assert.ok(!track.crossing[idx], `lugar ${k} no cruzamento`);
    }
  });
}

test('um id de pista desconhecido dá a pista inicial', () => {
  assert.equal(getTrack('nao-existe'), getTrack(TRACKS[0].id));
  assert.equal(getTrack(null), getTrack(TRACKS[0].id));
});
