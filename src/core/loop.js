/**
 * Laço do jogo com passo fixo: a simulação sempre avança em pedaços de `step` segundos,
 * não importa a taxa de quadros da tela. O desenho acontece uma vez por quadro.
 */
export function startLoop({ step, update, render }) {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= step) {
      update(step);
      acc -= step;
    }
    render(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
