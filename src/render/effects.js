import { MONEY } from '../config.js';
import { clamp, TAU } from '../core/math.js';
import { circle } from './shapes.js';

// Efeitos só visuais: não mudam o jogo, por isso usam Math.random à vontade.
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FIRE = ['#ffd23f', '#ff8c1a', '#ff4d1a', '#fff3b0'];
const MAX_PARTICLES = 900;
const MAX_SKID_SEGMENTS = 3000;
const MAX_DECALS = 40;
const SMOKE_BELOW = 35;       // pontos de vida: abaixo disso o carro solta fumaça
const BLACK_SMOKE_BELOW = 15; // e abaixo disso, fumaça preta

/**
 * Partículas, marcas de pneu, manchas de explosão e textos flutuantes.
 * Nascem dos eventos da simulação e do estado dos carros a cada quadro.
 */
export function createEffects() {
  let particles = [], floats = [], decals = [], skids = [], perCar = new Map();

  const add = (x, y, vx, vy, life, r, color, grow = 0, drag = 2) => {
    particles.push({ x, y, vx, vy, life, max: life, r, color, grow, drag });
    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  };
  const sparks = (x, y, n, color) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(80, 260);
      add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.35), rand(1.5, 3), color, -3, 5);
    }
  };
  const explode = (x, y, size, camera) => {
    for (let i = 0; i < 22 * size; i++) {
      const a = rand(0, TAU), s = rand(40, 260) * size;
      add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), rand(4, 10) * size, pick(FIRE), -4, 3);
    }
    for (let i = 0; i < 14 * size; i++) {
      const a = rand(0, TAU), s = rand(20, 90) * size;
      add(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.8, 1.6), rand(8, 14) * size, '#3c3c3c', 18, 1.5);
    }
    camera.kick(10 * size * clamp(1 - Math.hypot(x - camera.x, y - camera.y) / 700, 0, 1));
  };
  const floatText = (x, y, text, color) => floats.push({ x, y, text, color, t: 1.2 });

  return {
    reset() {
      particles = []; floats = []; decals = []; skids = []; perCar = new Map();
    },

    handle(e, race, camera) {
      const byPlayer = race.player && e.car === race.player;
      switch (e.type) {
        case 'explosion':
          explode(e.x, e.y, 1, camera);
          decals.push({ x: e.x, y: e.y, r: 26 });
          if (decals.length > MAX_DECALS) decals.shift();
          break;
        case 'mine-blast':
          if (e.weapon === 'emp') sparks(e.x, e.y, 18, '#9be3ff');
          else explode(e.x, e.y, 0.6, camera);
          break;
        case 'hit':
        case 'shot-wall':
          if (e.weapon === 'rocket') explode(e.x, e.y, 0.7, camera);
          else if (e.weapon === 'mg') sparks(e.x, e.y, 3, '#ffe08a');
          else if (e.weapon === 'plasma') sparks(e.x, e.y, 14, '#d9a8ff');
          else sparks(e.x, e.y, e.type === 'hit' ? 10 : 5, '#ffb0a0');
          break;
        case 'shot-bounce': sparks(e.x, e.y, 4, '#d9a8ff'); break;
        case 'status':
          if (e.effect === 'emp') sparks(e.x, e.y, 14, '#9be3ff');
          break;
        case 'wall': sparks(e.x, e.y, Math.min(12, e.force / 25), '#ffe08a'); break;
        case 'bump': sparks(e.x, e.y, 6, '#ffd27a'); break;
        case 'pickup':
          if (byPlayer) floatText(e.x, e.y - 14, e.kind === 'money' ? `+$${MONEY.bag}` : 'Consertado!', e.kind === 'money' ? '#ffd23f' : '#7CFC9A');
          break;
        case 'kill':
          if (race.player && e.killer === race.player) floatText(e.x, e.y - 24, `+$${MONEY.kill}`, '#ffd23f');
          break;
      }
    },

    // Fumaça de carro avariado, chama do nitro e marcas de pneu saem do estado de cada carro.
    update(race, dt) {
      for (const car of race.cars) {
        if (!car.alive) { perCar.delete(car); continue; }
        const st = perCar.get(car) || { smokeT: 0, skid: null };
        perCar.set(car, st);
        const fx = Math.cos(car.a), fy = Math.sin(car.a);
        const forward = car.vx * fx + car.vy * fy, sideways = -car.vx * fy + car.vy * fx;

        st.smokeT -= dt;
        if (car.armor < SMOKE_BELOW && st.smokeT <= 0) {
          const bad = car.armor < BLACK_SMOKE_BELOW;
          st.smokeT = bad ? 0.04 : 0.08;
          add(car.x + fx * 12, car.y + fy * 12, rand(-15, 15), rand(-25, -5), rand(0.6, 1.1), rand(3, 5), bad ? '#2b2b2b' : '#8d8d8d', 14, 1);
        }
        if (car.nitroT > 0) {
          add(car.x - fx * 20, car.y - fy * 20, -fx * 120 + rand(-20, 20), -fy * 120 + rand(-20, 20), 0.18, rand(3, 5), pick(['#7fd3ff', '#ffffff', '#ffb347']), -10, 4);
        }
        if (car.status.emp > 0 && Math.random() < dt * 25) {
          const a = rand(0, TAU);
          add(car.x + Math.cos(a) * 14, car.y + Math.sin(a) * 14, rand(-40, 40), rand(-40, 40), 0.15, rand(1.5, 2.5), '#9be3ff', -4, 6);
        }

        if (Math.abs(sideways) > 40 || (car.input.down && forward > 150)) {
          const left = [car.x - fx * 11 + fy * 8, car.y - fy * 11 - fx * 8];
          const right = [car.x - fx * 11 - fy * 8, car.y - fy * 11 + fx * 8];
          if (st.skid && (left[0] - st.skid[0][0]) ** 2 + (left[1] - st.skid[0][1]) ** 2 > 36) {
            skids.push([...st.skid[0], ...left], [...st.skid[1], ...right]);
            if (skids.length > MAX_SKID_SEGMENTS) skids.splice(0, 200);
            st.skid = [left, right];
          } else if (!st.skid) st.skid = [left, right];
        } else st.skid = null;
      }

      for (const s of race.shots) { // rastro de fumaça dos foguetes e brilho do plasma
        if (s.weapon === 'rocket') add(s.x, s.y, rand(-10, 10), rand(-10, 10), rand(0.4, 0.7), rand(3, 4), '#bdbdbd', 10, 2);
        else if (s.weapon === 'plasma' && Math.random() < dt * 30) add(s.x, s.y, 0, 0, 0.25, 4, '#c77dff', -12, 0);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if ((p.life -= dt) <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.r = Math.max(0.5, p.r + p.grow * dt);
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        floats[i].y -= 30 * dt;
        if ((floats[i].t -= dt) <= 0) floats.splice(i, 1);
      }
    },

    // Marcas de pneu e manchas: ficam no chão, embaixo dos carros.
    drawGround(ctx) {
      if (skids.length) {
        ctx.strokeStyle = 'rgba(25,25,25,0.32)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of skids) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        ctx.stroke();
      }
      for (const d of decals) {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, 'rgba(20,15,10,0.55)');
        g.addColorStop(1, 'rgba(20,15,10,0)');
        ctx.fillStyle = g;
        circle(ctx, d.x, d.y, d.r);
      }
    },

    // Fogo, fumaça, faíscas e textos: por cima de tudo.
    drawAir(ctx) {
      for (const p of particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.9;
        ctx.fillStyle = p.color;
        circle(ctx, p.x, p.y, p.r);
      }
      ctx.globalAlpha = 1;
      ctx.font = 'bold 16px "Trebuchet MS", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of floats) {
        ctx.globalAlpha = clamp(f.t / 0.4, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(f.text, f.x + 1.5, f.y + 1.5);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
