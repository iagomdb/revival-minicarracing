import { clamp } from '../core/math.js';
import { lightState } from '../sim/race.js';
import { drawCar, drawCarShadow, drawYouTag } from './draw-car.js';
import { drawMines, drawPickups, drawPuddles, drawShots } from './draw-items.js';
import { createTrackArt, drawGantry, drawGround, drawTrack } from './draw-track.js';
import { buildScenery, drawScenery } from './scenery.js';

/** Desenha um quadro: o mundo visto pela câmera e, por cima, o HUD. Só lê o estado, nunca muda. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1, zoom: 1 };
  let track = null, art = null, scenery = null;

  // A arte e o cenário são montados uma vez por pista, e refeitos quando a corrida muda de pista.
  function useTrack(next) {
    if (next === track) return;
    track = next;
    art = createTrackArt(ctx, track);
    scenery = buildScenery(track);
  }

  return {
    resize(w, h, dpr) {
      view.w = w;
      view.h = h;
      view.dpr = Math.min(2, dpr);
      view.zoom = clamp(Math.min(w / 1150, h / 760), 0.55, 1.35);
      canvas.width = Math.round(w * view.dpr);
      canvas.height = Math.round(h * view.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    },

    render({ race, camera, effects, hud, time }) {
      useTrack(race.track);
      const { w, h, dpr, zoom } = view;
      const lights = lightState(race);
      const player = race.player;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.translate(w / 2 + (Math.random() - 0.5) * camera.shake, h / 2 + (Math.random() - 0.5) * camera.shake);
      ctx.scale(zoom, zoom);
      ctx.translate(-camera.x, -camera.y);
      const hw = w / 2 / zoom + 120, hh = h / 2 / zoom + 120;
      const rect = { x0: camera.x - hw, x1: camera.x + hw, y0: camera.y - hh, y1: camera.y + hh };

      drawGround(ctx, art, rect);
      drawTrack(ctx, track, art);
      effects.drawGround(ctx);
      drawPuddles(ctx, race.puddles);
      drawScenery(ctx, scenery, rect);
      drawPickups(ctx, race.pickups, time);
      drawMines(ctx, race.mines);
      const alive = race.cars.filter((c) => c.alive);
      for (const car of alive) drawCarShadow(ctx, car);
      for (const car of alive) drawCar(ctx, car);
      drawShots(ctx, race.shots);
      drawGantry(ctx, track, lights);
      effects.drawAir(ctx);
      if (player && player.alive && (race.state === 'countdown' || race.time < 2.5)) drawYouTag(ctx, player, time);
      ctx.restore();

      if (race.mode === 'play' && player) hud.draw(ctx, view, race, art.path, lights);
    },
  };
}
