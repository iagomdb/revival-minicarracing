import { clamp } from '../core/math.js';
import { roundRect } from './shapes.js';

const roofColors = new Map();

// Cor do teto: a cor do carro um pouco mais escura.
function roofColor(hex) {
  if (!roofColors.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    const dark = (v) => clamp(Math.round(v * 0.75), 0, 255);
    roofColors.set(hex, `rgb(${dark(n >> 16)},${dark((n >> 8) & 255)},${dark(n & 255)})`);
  }
  return roofColors.get(hex);
}

// Desenho de cada modelo. `length` e `width` (px) servem para a sombra e para a chama do nitro.
const BODIES = {
  micro: { length: 36, width: 20, draw: drawMicro },
  flecha: { length: 46, width: 18, draw: drawFlecha },
  arsenal: { length: 38, width: 26, draw: drawArsenal },
};
const bodyOf = (car) => BODIES[car.model] ?? BODIES.micro;

export function drawCarShadow(ctx, car) {
  const { length, width } = bodyOf(car);
  ctx.save();
  ctx.translate(car.x + 4, car.y + 6);
  ctx.rotate(car.a);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -length / 2, -width / 2, length, width, 6);
  ctx.fill();
  ctx.restore();
}

/** Carro visto de cima, com a frente apontando para +x. */
export function drawCar(ctx, car) {
  const body = bodyOf(car);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.a);
  if (car.invuln > 0 && Math.floor(car.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4; // pisca ao voltar à pista
  if (car.nitroT > 0) drawNitroFlame(ctx, -body.length / 2);
  body.draw(ctx, car.color);
  ctx.restore();
}

// Micro: o carrinho compacto de sempre.
function drawMicro(ctx, color) {
  ctx.fillStyle = '#151515'; // pneus
  ctx.fillRect(7, -11, 8, 4); ctx.fillRect(7, 7, 8, 4);
  ctx.fillRect(-14, -11, 8, 4); ctx.fillRect(-14, 7, 8, 4);

  ctx.fillStyle = color;
  roundRect(ctx, -18, -9.5, 36, 19, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, -16, -8, 32, 5, 2.5); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, -16, 3.5, 32, 4.5, 2.5); ctx.fill();

  ctx.fillStyle = '#1c2633'; // vidros
  ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(9, -6); ctx.lineTo(9, 6); ctx.lineTo(3, 7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = roofColor(color);
  roundRect(ctx, -8, -7, 11, 14, 3); ctx.fill();

  ctx.fillStyle = '#fff6c2'; // faróis
  ctx.fillRect(16, -7, 2, 4); ctx.fillRect(16, 3, 2, 4);
  ctx.fillStyle = '#ff3030'; // lanternas
  ctx.fillRect(-18, -7, 2, 4); ctx.fillRect(-18, 3, 2, 4);
}

// Flecha: comprido e fino, de bico fino, com aerofólio atrás.
function drawFlecha(ctx, color) {
  ctx.fillStyle = '#151515'; // pneus: os de trás são mais largos
  ctx.fillRect(9, -10, 8, 3.5); ctx.fillRect(9, 6.5, 8, 3.5);
  ctx.fillRect(-17, -11, 10, 4.5); ctx.fillRect(-17, 6.5, 10, 4.5);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(23, 0); ctx.lineTo(12, -5.5); ctx.lineTo(-17, -7); ctx.lineTo(-19, -5.5);
  ctx.lineTo(-19, 5.5); ctx.lineTo(-17, 7); ctx.lineTo(12, 5.5); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; // faixa no meio
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(10, -1.5); ctx.lineTo(-16, -1.5); ctx.lineTo(-16, 1.5); ctx.lineTo(10, 1.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.moveTo(12, 5.5); ctx.lineTo(-17, 7); ctx.lineTo(-17, 4.5); ctx.lineTo(12, 3.5); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#1c2633'; // cabine
  ctx.beginPath(); ctx.ellipse(-1, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = roofColor(color);
  ctx.beginPath(); ctx.ellipse(-3, 0, 3.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#1d1d22'; // aerofólio
  ctx.fillRect(-23, -9.5, 4.5, 19);
  ctx.fillStyle = roofColor(color);
  ctx.fillRect(-23.5, -10.5, 6, 2.5); ctx.fillRect(-23.5, 8, 6, 2.5);

  ctx.fillStyle = '#fff6c2'; // faróis
  ctx.fillRect(16, -3.5, 2, 2); ctx.fillRect(16, 1.5, 2, 2);
  ctx.fillStyle = '#ff3030'; // lanternas
  ctx.fillRect(-19, -4.5, 1.5, 3); ctx.fillRect(-19, 1.5, 1.5, 3);
}

// Arsenal: largo e quadradão, com as duas armas em cima do capô.
function drawArsenal(ctx, color) {
  ctx.fillStyle = '#151515'; // pneus grandes
  ctx.fillRect(6, -13.5, 9, 5); ctx.fillRect(6, 8.5, 9, 5);
  ctx.fillRect(-15, -13.5, 9, 5); ctx.fillRect(-15, 8.5, 9, 5);

  ctx.fillStyle = color;
  roundRect(ctx, -19, -11.5, 38, 23, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -17, -10, 34, 4, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -17, 6, 34, 4, 2); ctx.fill();

  ctx.fillStyle = '#1c2633'; // vidros
  ctx.fillRect(3, -7.5, 4, 15);
  ctx.fillRect(-15, -6.5, 3, 13);
  ctx.fillStyle = roofColor(color);
  roundRect(ctx, -12, -8, 15, 16, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; // escotilha
  ctx.beginPath(); ctx.arc(-4.5, 0, 3, 0, Math.PI * 2); ctx.fill();

  for (const y of [-10, 6.5]) { // as duas armas
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(5, y, 10, 3.5);
    ctx.fillStyle = '#4a515c';
    ctx.fillRect(15, y + 0.5, 9, 2.5);
    ctx.fillStyle = '#111';
    ctx.fillRect(23, y + 0.5, 1.5, 2.5);
  }

  ctx.fillStyle = '#fff6c2'; // faróis
  ctx.fillRect(17, -4, 2, 3); ctx.fillRect(17, 1, 2, 3);
  ctx.fillStyle = '#ff3030'; // lanternas
  ctx.fillRect(-19, -9, 2, 4); ctx.fillRect(-19, 5, 2, 4);
}

function drawNitroFlame(ctx, x) {
  const len = 14 + Math.random() * 10;
  ctx.fillStyle = 'rgba(120,200,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x - len, 0); ctx.lineTo(x, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x, -2.5); ctx.lineTo(x - len * 0.5, 0); ctx.lineTo(x, 2.5); ctx.closePath(); ctx.fill();
}

/** Plaquinha "VOCÊ" em cima do jogador na largada. */
export function drawYouTag(ctx, car, time) {
  const y = car.y - 34 + Math.sin(time * 6.5) * 2;
  ctx.font = 'bold 14px "Trebuchet MS", Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('VOCÊ', car.x, y);
  ctx.beginPath();
  ctx.moveTo(car.x - 6, y + 9); ctx.lineTo(car.x + 6, y + 9); ctx.lineTo(car.x, y + 15);
  ctx.closePath();
  ctx.fill();
}
