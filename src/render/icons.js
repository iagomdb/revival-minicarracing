import { TAU } from '../core/math.js';
import { circle, roundRect } from './shapes.js';

/** Cor de destaque de cada arma (LEDs de munição e selos do HUD). */
export const WEAPON_COLORS = {
  laser: '#ff4040', mg: '#ffd23f', rocket: '#ff8a3d',
  mine: '#ffb020', emp: '#5cc8ff', oil: '#a9a9b8', glue: '#f3e7a0', nitro: '#5cc8ff',
};

/** Ícone pequeno (uns 20 px) de uma arma, centrado em (x, y). */
export function drawWeaponIcon(ctx, id, x, y) {
  ctx.save();
  ctx.lineCap = 'round';
  switch (id) {
    case 'laser':
      ctx.strokeStyle = 'rgba(255,60,60,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x - 9, y + 6); ctx.lineTo(x + 9, y - 6); ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, y + 6); ctx.lineTo(x + 9, y - 6); ctx.stroke();
      break;
    case 'mg':
      for (const dx of [-6, 0, 6]) {
        ctx.fillStyle = '#c9932b'; ctx.fillRect(x + dx - 2, y - 1, 4, 9);   // cápsula
        ctx.fillStyle = '#ffd23f'; roundRect(ctx, x + dx - 2, y - 8, 4, 8, 2); ctx.fill(); // ponta
      }
      break;
    case 'rocket':
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-9, -2.5); ctx.lineTo(-14, 0); ctx.lineTo(-9, 2.5); ctx.fill();
      ctx.fillStyle = '#d8d8d8'; ctx.fillRect(-9, -3, 14, 6);
      ctx.fillStyle = '#e8392b'; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(10, 0); ctx.lineTo(5, 3); ctx.fill();
      break;
    case 'mine':
    case 'emp':
      ctx.fillStyle = '#202020'; circle(ctx, x, y, 9);
      ctx.strokeStyle = WEAPON_COLORS[id]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
      if (id === 'mine') { ctx.fillStyle = '#ff3b30'; circle(ctx, x, y, 3); }
      else { // raio
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.moveTo(x + 1, y - 6); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x, y + 1); ctx.lineTo(x - 1, y + 6);
        ctx.lineTo(x + 3, y - 1); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill();
      }
      break;
    case 'oil':
    case 'glue':
      ctx.fillStyle = id === 'oil' ? '#15151a' : '#f3e7a0';
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.quadraticCurveTo(x + 8, y, x + 7, y + 3);
      ctx.arc(x, y + 3, 7, 0, Math.PI); ctx.quadraticCurveTo(x - 8, y, x, y - 10); ctx.fill();
      ctx.strokeStyle = id === 'oil' ? '#6a6a78' : '#b8a650'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, x - 3, y + 2, 1.8);
      break;
    case 'nitro':
      ctx.fillStyle = '#5cc8ff'; roundRect(ctx, x - 6, y - 10, 12, 20, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 13, 6, 4);
      ctx.fillStyle = '#1b5a80'; ctx.fillRect(x - 4, y - 2, 8, 3);
      break;
  }
  ctx.restore();
}
