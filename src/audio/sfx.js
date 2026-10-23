import { WALL_DAMAGE } from '../config.js';
import { clamp } from '../core/math.js';

const HEARING_DISTANCE = 900; // px: mais longe que isso da câmera não se ouve

function boom(synth, v) {
  synth.noise(0.6, 0.6 * v, 700);
  synth.tone(90, 0.4, 'sine', 0.4 * v, 40);
}

/** Traduz eventos da simulação em sons, mais baixos quanto mais longe da câmera. */
export function createSfx(synth) {
  return {
    enabled: false,

    handle(e, race, listener) {
      if (!this.enabled) return;
      let v = 1;
      if (e.x != null) {
        v = clamp(1.15 - Math.hypot(e.x - listener.x, e.y - listener.y) / HEARING_DISTANCE, 0, 1);
        if (v <= 0) return;
      }
      const byPlayer = race.player && e.car === race.player;
      switch (e.type) {
        case 'countdown': synth.tone(440, 0.25, 'square', 0.15); break;
        case 'go': synth.tone(880, 0.6, 'square', 0.15); break;
        case 'shot':
          if (e.weapon === 'mg') synth.noise(0.04, 0.12 * v, 2500);
          else if (e.weapon === 'rocket') { synth.noise(0.45, 0.25 * v, 1200); synth.tone(160, 0.45, 'sawtooth', 0.06 * v, 70); }
          else synth.tone(1400, 0.12, 'square', 0.08 * v, 300);
          break;
        case 'hit':
        case 'shot-wall':
          if (e.weapon === 'rocket') boom(synth, v);
          else if (e.type === 'hit') synth.noise(e.weapon === 'mg' ? 0.03 : 0.08, 0.25 * v, 3000);
          break;
        case 'explosion': boom(synth, v); break;
        case 'mine-blast':
          if (e.weapon === 'emp') synth.tone(1200, 0.35, 'square', 0.12 * v, 150);
          else boom(synth, v);
          break;
        case 'drop':
          if (e.weapon === 'oil' || e.weapon === 'glue') synth.noise(0.15, 0.2 * v, 400);
          else synth.tone(300, 0.08, 'triangle', 0.15 * v, 200);
          break;
        case 'status':
          if (!byPlayer) break;
          if (e.effect === 'emp') synth.tone(900, 0.3, 'square', 0.1, 120);
          else if (e.effect === 'glue') synth.tone(220, 0.3, 'triangle', 0.18, 110);
          else synth.noise(0.25, 0.2, 1500);
          break;
        case 'nitro':
          synth.noise(0.5, 0.25 * v, 1800);
          synth.tone(200, 0.5, 'sawtooth', 0.08 * v, 600);
          break;
        case 'bump': synth.noise(0.1, 0.3 * v, 500); break;
        case 'wall': if (e.force > WALL_DAMAGE.accident) synth.noise(0.12, 0.25 * v, 900); break;
        case 'pickup':
          if (!byPlayer) break;
          if (e.kind === 'money') {
            synth.tone(988, 0.08, 'square', 0.12);
            synth.tone(1319, 0.14, 'square', 0.12, null, 0.07);
          } else synth.tone(523, 0.2, 'triangle', 0.2, 1046);
          break;
        case 'finish':
          if (byPlayer) [523, 659, 784, 1046].forEach((f, i) => synth.tone(f, 0.18, 'square', 0.13, null, i * 0.12));
          break;
      }
    },
  };
}
