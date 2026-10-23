import { WEAPONS } from '../config.js';
import { formatTime } from '../core/format.js';
import { clamp, TAU } from '../core/math.js';
import { KEY_HINTS } from '../input/keyboard.js';
import { drawWeaponIcon, WEAPON_COLORS } from './icons.js';
import { roundRect, shadowText } from './shapes.js';

const FONT = '"Trebuchet MS", Arial, sans-serif';
const SLOT_W = 170, SLOT_GAP = 8;
const MAX_LEDS = 6; // acima disso a munição aparece em número
const STATUS_MESSAGES = {
  oil: ['ÓLEO!', '#c9c9d6', 'você está derrapando'],
  glue: ['COLA!', '#f3e7a0', 'velocidade reduzida'],
  emp: ['PEM!', '#5cc8ff', 'direção invertida'],
};

/** Informações da corrida na tela e as mensagens grandes ("VAI!", "ÚLTIMA VOLTA!"). */
export function createHud() {
  let msg = null;
  const show = (text, color, sub) => { msg = { text, color, sub, t: 2.2, max: 2.2 }; };

  return {
    reset() { msg = null; },

    handle(e, race) {
      const p = race.player;
      if (!p) return;
      if (e.type === 'go') return show('VAI!', '#7CFC9A');
      if (e.car !== p) return;
      switch (e.type) {
        case 'lap': show(e.final ? 'ÚLTIMA VOLTA!' : `VOLTA ${e.lap + 1}`, e.final ? '#ffd23f' : '#ffffff'); break;
        case 'false-start': show('QUEIMOU A LARGADA!', '#ff5a3c', 'você volta atrás do pelotão'); break;
        case 'explosion': if (e.reason !== 'false-start') show('DESTRUÍDO!', '#ff5a3c', 'um carro novo já vem aí'); break;
        case 'finish': show('CHEGADA!', '#ffd23f', `${e.rank}º lugar`); break;
        case 'status': show(...STATUS_MESSAGES[e.effect]); break;
      }
    },

    update(dt) {
      if (msg && (msg.t -= dt) <= 0) msg = null;
    },

    draw(ctx, view, race, trackPath, lights) {
      const p = race.player;
      const scale = clamp(Math.min(view.w / 1100, view.h / 700), 0.7, 1.2);
      const w = view.w / scale, h = view.h / scale;
      ctx.setTransform(view.dpr * scale, 0, 0, view.dpr * scale, 0, 0);
      ctx.textBaseline = 'alphabetic';
      drawLapAndPlace(ctx, race, p);
      drawMinimap(ctx, race, trackPath, 18, 62, 200, 136);
      drawMoneyAndTime(ctx, race, p, w);
      drawBottomBar(ctx, p, w, h);
      drawLights(ctx, lights, w);
      if (msg) drawMessage(ctx, msg, w, h);
    },
  };
}

// Volta e posição no canto superior esquerdo, como no original.
function drawLapAndPlace(ctx, race, p) {
  ctx.textAlign = 'left';
  ctx.font = `italic bold 30px ${FONT}`;
  const lapText = `VOLTA ${clamp(p.lap + 1, 1, race.laps)}/${race.laps}`;
  shadowText(ctx, lapText, 18, 42, '#ffffff');
  const lapWidth = ctx.measureText(lapText).width;
  ctx.font = `italic bold 44px ${FONT}`;
  shadowText(ctx, `${p.place}º`, 18 + lapWidth + 20, 46, '#ff6b8a');
}

function drawMoneyAndTime(ctx, race, p, w) {
  ctx.textAlign = 'right';
  ctx.font = `bold 22px ${FONT}`;
  shadowText(ctx, `$ ${p.extras}`, w - 18, 38, '#ffd23f', 2);
  ctx.font = `bold 18px ${FONT}`;
  shadowText(ctx, formatTime(p.finished ? p.finishTime : race.time), w - 18, 64, '#ffffff', 2);
}

function drawMinimap(ctx, race, trackPath, x, y, w, h) {
  const e = race.track.ext, ew = e.maxX - e.minX, eh = e.maxY - e.minY;
  const s = Math.min((w - 20) / ew, (h - 20) / eh);
  const ox = x + (w - ew * s) / 2 - e.minX * s, oy = y + (h - eh * s) / 2 - e.minY * s;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4 / s;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke(trackPath);
  ctx.restore();

  const start = race.track.pts[0];
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(ox + start.x * s - 1.5, oy + start.y * s - 5, 3, 10);
  const others = race.cars.filter((c) => c.alive && c !== race.player);
  for (const c of [...others, race.player]) {
    if (!c.alive) continue;
    const me = c === race.player;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(ox + c.x * s, oy + c.y * s, me ? 4.5 : 3.2, 0, TAU);
    ctx.fill();
    if (me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}

// Barra de baixo: os encaixes que o carro tem, com a munição da volta, e a blindagem (original).
function drawBottomBar(ctx, p, w, h) {
  const bh = 54, y = h - bh;
  const g = ctx.createLinearGradient(0, y, 0, h);
  g.addColorStop(0, 'rgba(30,30,36,0.92)');
  g.addColorStop(1, 'rgba(12,12,16,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, y, w, 1);

  const { front, rear, extra } = p.loadout;
  const slots = [[front[0], KEY_HINTS.fire1], [front[1], KEY_HINTS.fire2], [rear, KEY_HINTS.rear], [extra, KEY_HINTS.extra]]
    .filter(([id]) => id);
  let x = 12;
  for (const [id, keys] of slots) {
    drawSlot(ctx, p, id, keys, x, y);
    x += SLOT_W + SLOT_GAP;
  }
  drawArmor(ctx, p, x + 4, y, Math.max(80, w - x - 22));
}

function drawSlot(ctx, p, id, keys, x, y) {
  const w = WEAPONS[id], ammo = p.ammo[id] ?? 0, color = WEAPON_COLORS[id];
  const active = id === 'nitro' && p.nitroT > 0;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, x, y + 7, SLOT_W, 40, 6);
  ctx.fill();
  ctx.globalAlpha = ammo <= 0 && !active ? 0.35 : 1;
  drawWeaponIcon(ctx, id, x + 20, y + 27);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(w.name, x + 40, y + 24);
  ctx.fillStyle = '#9a96a0';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(keys, x + 40, y + 40);

  const right = x + SLOT_W - 8;
  if (w.ammo === 1) drawSingleUse(ctx, ammo > 0, active, color, right - 46, y + 28);
  else if (w.ammo <= MAX_LEDS) {
    for (let i = 0; i < w.ammo; i++) {
      ctx.fillStyle = i < ammo ? color : 'rgba(255,255,255,0.12)';
      ctx.fillRect(right - w.ammo * 10 + 4 + i * 10, y + 30, 6, 12);
    }
  } else {
    ctx.textAlign = 'right';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = ammo > 0 ? color : '#6a6670';
    ctx.fillText(`${ammo}/${w.ammo}`, right, y + 41);
  }
}

// Item de uso único (nitro): um selo PRONTO / ATIVO / USADO em vez de LEDs.
function drawSingleUse(ctx, ready, active, color, x, y) {
  roundRect(ctx, x, y, 46, 16, 8);
  if (active) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = ready ? color : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = active ? '#0b2233' : ready ? color : '#6a6670';
  ctx.font = `bold 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(active ? 'ATIVO' : ready ? 'PRONTO' : 'USADO', x + 23, y + 11.5);
}

// Blindagem em pontos de vida, com a barra embaixo.
function drawArmor(ctx, p, x, y, width) {
  const max = p.stats.armor, armor = p.alive ? Math.max(0, Math.ceil(p.armor)) : 0, ratio = armor / max;
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = '#9a96a0';
  ctx.textAlign = 'left';
  ctx.fillText('BLINDAGEM', x, y + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(`${armor}/${max}`, x + width, y + 18);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y + 24, width, 16, 4);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = ratio > 0.5 ? '#3ddc4a' : ratio > 0.25 ? '#ffd23f' : '#ff3b30';
    roundRect(ctx, x, y + 24, width * ratio, 16, 4);
    ctx.fill();
  }
}

function drawLights(ctx, lights, w) {
  if (!lights.lit && !lights.green) return;
  const x = w / 2 - 70, y = 16;
  ctx.fillStyle = 'rgba(20,20,24,0.85)';
  roundRect(ctx, x, y, 140, 50, 10);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const on = lights.green || i < lights.lit;
    ctx.fillStyle = lights.green ? '#30d158' : on ? '#ff3b30' : '#3a1515';
    if (on) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; }
    ctx.beginPath();
    ctx.arc(x + 30 + i * 40, y + 25, 14, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawMessage(ctx, msg, w, h) {
  const age = msg.max - msg.t, scale = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
  ctx.save();
  ctx.globalAlpha = msg.t < 0.4 ? msg.t / 0.4 : 1;
  ctx.translate(w / 2, h * 0.3);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.font = `italic bold 54px ${FONT}`;
  shadowText(ctx, msg.text, 0, 0, msg.color, 4);
  if (msg.sub) {
    ctx.font = `bold 20px ${FONT}`;
    shadowText(ctx, msg.sub, 0, 34, '#ffffff', 2);
  }
  ctx.restore();
}
