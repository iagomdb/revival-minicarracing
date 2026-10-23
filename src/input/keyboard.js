// Teclas de cada ação. Ctrl, Shift, Alt e Espaço são as do jogo original (arma 1, arma 2, traseira, extra);
// Z, X, C e V são alternativas na mesma ordem. Não usamos WASD porque Ctrl+W fecha a aba do navegador.
export const BINDINGS = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  fire1: ['ControlLeft', 'ControlRight', 'KeyZ'],
  fire2: ['ShiftLeft', 'ShiftRight', 'KeyX'],
  rear: ['AltLeft', 'AltRight', 'KeyC'],
  extra: ['Space', 'KeyV'],
};

/** Texto curto das teclas de cada encaixe, para o HUD e a tela de equipar. */
export const KEY_HINTS = { fire1: 'Ctrl · Z', fire2: 'Shift · X', rear: 'Alt · C', extra: 'Espaço · V' };

const BLOCKED = new Set([...Object.values(BINDINGS).flat(), 'Escape', 'Enter']);

export function createKeyboard(target = window) {
  const held = new Set();
  const pressHandlers = [], blurHandlers = [];
  const any = (codes) => codes.some((code) => held.has(code));

  target.addEventListener('keydown', (e) => {
    if (BLOCKED.has(e.code) || e.altKey) e.preventDefault(); // Alt+← não pode voltar a página no meio da corrida
    held.add(e.code);
    if (!e.repeat) pressHandlers.forEach((fn) => fn(e.code));
  });
  target.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (BLOCKED.has(e.code)) e.preventDefault(); // Alt solto sozinho abriria o menu do navegador
  });
  target.addEventListener('blur', () => {
    held.clear();
    blurHandlers.forEach((fn) => fn());
  });

  return {
    /** Tecla apertada agora (sem repetição), para comandos de menu: Enter, Esc etc. */
    onPress(fn) { pressHandlers.push(fn); },
    onBlur(fn) { blurHandlers.push(fn); },

    /** Copia o estado das teclas para o `input` do carro do jogador. */
    readControls(input) {
      input.up = any(BINDINGS.up);
      input.down = any(BINDINGS.down);
      input.steer = (any(BINDINGS.right) ? 1 : 0) - (any(BINDINGS.left) ? 1 : 0);
      input.fire1 = any(BINDINGS.fire1);
      input.fire2 = any(BINDINGS.fire2);
      input.rear = any(BINDINGS.rear);
      input.extra = any(BINDINGS.extra);
    },
  };
}
