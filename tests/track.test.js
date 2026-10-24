import assert from 'node:assert/strict';
import test from 'node:test';
import { GRID_SIZE, TRACK_SPACING } from '../src/config.js';
import { gridSlot, nearestOnOtherStretch, nearestOnTrack, roundCorners } from '../src/sim/track.js';
import { getTrack, TRACKS } from '../src/sim/tracks/index.js';

const STRAIGHT = 1000;  // raio (px) a partir do qual o trecho conta como reta
const MIN_RADIUS = 140; // curva mais fechada que dá para fazer de carro (px)
const GAP = 60;         // chão mínimo entre dois trechos da pista: os dois guard-rails e um pouco de terra (px)
const WITH_CROSSING = new Set(['oito']); // pistas que se cruzam de propósito
const TIGHT_OK = new Set(['deserto']);   // o grampo do Deserto (raio ~50 px) fica como está, a pedido do usuário
const desert = getTrack('deserto');

for (const { id, name } of TRACKS) {
  const track = getTrack(id);

  test(`${name}: a volta tem comprimento parecido com a do Deserto`, () => {
    const km = (t) => `${t.N * TRACK_SPACING} px`;
    assert.ok(Math.abs(track.N - desert.N) / desert.N < 0.15, `${km(track)} contra ${km(desert)}`);
  });

  if (!TIGHT_OK.has(id)) {
    test(`${name}: as curvas dão para fazer de carro (raio de pelo menos ${MIN_RADIUS} px)`, () => {
      const tightest = Math.min(...track.radius);
      assert.ok(tightest >= MIN_RADIUS, `curva mais fechada: ${tightest.toFixed(0)} px`);
    });
  }

  if (!WITH_CROSSING.has(id)) {
    test(`${name}: a pista não encosta nela mesma, e entre dois trechos sobra chão para o guard-rail`, () => {
      for (let i = 0; i < track.N; i++) {
        const p = track.pts[i], d = nearestOnOtherStretch(track, p.x, p.y, i).dist;
        assert.ok(d >= 2 * track.half + GAP, `ponto ${i}: outro trecho a ${d.toFixed(0)} px`);
      }
    });
  }

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

test('roundCorners avisa quando dois cantos estão perto demais para os raios pedidos', () => {
  assert.throws(() => roundCorners([[0, 0, 200], [300, 0, 200], [300, 300, 200], [0, 300, 200]]), /cantos 0 e 1/);
});

test('um id de pista desconhecido dá a pista inicial', () => {
  assert.equal(getTrack('nao-existe'), getTrack(TRACKS[0].id));
  assert.equal(getTrack(null), getTrack(TRACKS[0].id));
});
