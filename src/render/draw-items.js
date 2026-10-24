import { PUDDLES } from '../config.js';
import { clamp, TAU } from '../core/math.js';
import { WEAPON_COLORS } from './icons.js';
import { circle, roundRect } from './shapes.js';

export function drawPickups(ctx, pickups, time) {
  for (const p of pickups) {
    if (!p.active) continue;
    const bob = Math.sin(time * 4 + p.x) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 5, 10, 6, 0, 0, TAU);
    ctx.fill();
    if (p.kind === 'money') {
      ctx.fillStyle = '#8a5a2b';
      circle(ctx, p.x, p.y + bob, 9);
      ctx.fillStyle = '#6b4320';
      ctx.fillRect(p.x - 3, p.y - 12 + bob, 6, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', p.x, p.y + 1 + bob);
    } else {
      ctx.fillStyle = '#f7f7f7';
      roundRect(ctx, p.x - 9, p.y - 9 + bob, 18, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#e02b2b';
      ctx.fillRect(p.x - 2.5, p.y - 6 + bob, 5, 12);
      ctx.fillRect(p.x - 6, p.y - 2.5 + bob, 12, 5);
    }
  }
}

// Manchas de óleo e cola: crescem ao cair e somem aos poucos nos últimos 2 segundos.
export function drawPuddles(ctx, puddles) {
  for (const p of puddles) {
    const r = PUDDLES.radius * clamp(p.age / 0.3, 0.3, 1);
    ctx.globalAlpha = clamp(p.life / 2, 0, 1) * 0.9;
    ctx.fillStyle = p.effect === 'oil' ? '#141418' : '#efe3a0';
    // Três círculos sobrepostos dão uma forma de mancha, sempre igual para a mesma posição.
    const k = (p.x * 7 + p.y * 13) % TAU;
    circle(ctx, p.x, p.y, r * 0.8);
    circle(ctx, p.x + Math.cos(k) * r * 0.35, p.y + Math.sin(k) * r * 0.35, r * 0.6);
    circle(ctx, p.x + Math.cos(k + 2.4) * r * 0.4, p.y + Math.sin(k + 2.4) * r * 0.4, r * 0.55);
    ctx.fillStyle = p.effect === 'oil' ? 'rgba(140,150,190,0.35)' : 'rgba(255,255,255,0.45)'; // brilho
    circle(ctx, p.x - r * 0.25, p.y - r * 0.25, r * 0.22);
    ctx.globalAlpha = 1;
  }
}

export function drawMines(ctx, mines) {
  for (const m of mines) {
    const blink = Math.floor(m.age * 4) % 2;
    ctx.fillStyle = '#202020';
    circle(ctx, m.x, m.y, 7);
    ctx.strokeStyle = m.weapon === 'emp' ? WEAPON_COLORS.emp : m.owner.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 7, 0, TAU);
    ctx.stroke();
    if (m.weapon === 'emp') ctx.fillStyle = blink ? '#9be3ff' : '#1b4a66';
    else ctx.fillStyle = blink ? '#ff3b30' : '#5a1010';
    circle(ctx, m.x, m.y, 2.5);
  }
}

export function drawShots(ctx, shots) {
  ctx.lineCap = 'round';
  for (const s of shots) {
    const sp = Math.hypot(s.vx, s.vy), ux = s.vx / sp, uy = s.vy / sp;
    if (s.weapon === 'rocket') drawRocket(ctx, s, Math.atan2(uy, ux));
    else if (s.weapon === 'plasma') drawPlasma(ctx, s);
    else if (s.weapon === 'mg') beam(ctx, s, ux, uy, 10, 'rgba(255,210,63,0.35)', 5, '#ffe27a', 2);
    else beam(ctx, s, ux, uy, 24, 'rgba(255,60,60,0.4)', 7, '#ffffff', 2.5);
  }
}

// Tiro em forma de risco: um brilho largo e um miolo fino.
function beam(ctx, s, ux, uy, len, glow, glowWidth, core, coreWidth) {
  ctx.strokeStyle = glow;
  ctx.lineWidth = glowWidth;
  ctx.beginPath(); ctx.moveTo(s.x - ux * len, s.y - uy * len); ctx.lineTo(s.x, s.y); ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = coreWidth;
  ctx.beginPath(); ctx.moveTo(s.x - ux * len * 0.8, s.y - uy * len * 0.8); ctx.lineTo(s.x, s.y); ctx.stroke();
}

function drawRocket(ctx, s, angle) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);
  const flame = 8 + Math.random() * 6;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-8 - flame, 0); ctx.lineTo(-8, 3); ctx.fill();
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(-8, -3, 14, 6);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(-8, -5, 4, 10); // aletas
  ctx.fillStyle = '#e8392b';
  ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.fill();
  ctx.restore();
}

// Bola de plasma: brilho pulsando em volta de um miolo claro; some aos poucos no último meio segundo.
function drawPlasma(ctx, s) {
  ctx.globalAlpha = clamp(s.life / 0.5, 0, 1);
  ctx.fillStyle = 'rgba(199,125,255,0.35)';
  circle(ctx, s.x, s.y, 10 + Math.sin(s.life * 25) * 1.5);
  ctx.fillStyle = '#c77dff';
  circle(ctx, s.x, s.y, 6);
  ctx.fillStyle = '#f3e6ff';
  circle(ctx, s.x - 1.5, s.y - 1.5, 2.5);
  ctx.globalAlpha = 1;
}
