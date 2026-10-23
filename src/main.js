import './styles.css';
import { createSfx } from './audio/sfx.js';
import { createSynth } from './audio/synth.js';
import { STEP } from './config.js';
import { startLoop } from './core/loop.js';
import { createGame } from './game.js';
import { createKeyboard } from './input/keyboard.js';
import { createCamera } from './render/camera.js';
import { createEffects } from './render/effects.js';
import { createHud } from './render/hud.js';
import { createRenderer } from './render/renderer.js';
import { createScreens } from './ui/screens.js';

const renderer = createRenderer(document.getElementById('game'));
const camera = createCamera();
const effects = createEffects();
const hud = createHud();
const synth = createSynth();
const game = createGame({
  camera, effects, hud, synth,
  sfx: createSfx(synth),
  keyboard: createKeyboard(),
  screens: createScreens(),
});

const resize = () => renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
window.addEventListener('resize', resize);
resize();

// Pede confirmação antes de fechar ou recarregar a aba no meio de uma corrida.
window.addEventListener('beforeunload', (e) => {
  if (game.isRacing()) e.preventDefault();
});

game.startDemo();

// Só em desenvolvimento: ?autopilot começa uma corrida com o seu carro dirigindo sozinho.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('autopilot')) game.startPlay({ autopilot: true });

startLoop({
  step: STEP,
  update: game.step,
  render(dt, time) {
    game.frame(dt);
    renderer.render({ race: game.race, camera, effects, hud, time });
  },
});
