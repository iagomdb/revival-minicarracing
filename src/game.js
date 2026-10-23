import { CAR_MODELS, DEFAULT_CAR, DIFFICULTIES } from './config.js';
import { drainEvents } from './sim/events.js';
import { sanitizeLoadout } from './sim/loadout.js';
import { createRace, updateRace } from './sim/race.js';
import { getTrack, nextTrackId } from './sim/tracks/index.js';

const STORAGE = { difficulty: 'minicar.diff', loadout: 'minicar.loadout', track: 'minicar.track', car: 'minicar.car' };
const DIFFICULTY_KEYS = { Digit1: 'facil', Numpad1: 'facil', Digit2: 'medio', Numpad2: 'medio', Digit3: 'dificil', Numpad3: 'dificil' };

/**
 * O "maestro": sabe em que tela o jogo está (menu, equipar, corrida, resultado), cria as corridas,
 * repassa as teclas para o carro do jogador e entrega os eventos da simulação para som, efeitos e HUD.
 */
export function createGame({ camera, effects, hud, synth, sfx, keyboard, screens }) {
  const car = Object.hasOwn(CAR_MODELS, load(STORAGE.car)) ? load(STORAGE.car) : DEFAULT_CAR;
  const game = {
    screen: 'menu', paused: false, race: null,
    track: getTrack(load(STORAGE.track)),
    difficulty: DIFFICULTIES[load(STORAGE.difficulty)] ? load(STORAGE.difficulty) : 'medio',
    car,
    loadout: sanitizeLoadout(safeParse(load(STORAGE.loadout)), car),
  };

  function begin(race, screen) {
    game.race = race;
    game.screen = screen;
    game.paused = false;
    effects.reset();
    hud.reset();
    camera.snap(race.player || race.cars[0]);
  }

  // No menu roda uma corrida só com a CPU, de fundo.
  function startDemo() {
    begin(createRace({ track: game.track, mode: 'demo' }), 'menu');
    screens.show('menu');
  }

  // A tela de equipar fica por cima da corrida que estiver rodando (a do menu ou a que acabou).
  function openLoadout() {
    game.screen = 'loadout';
    screens.showLoadout(game.loadout, game.car);
    screens.show('loadout');
  }

  function startPlay({ autopilot = false } = {}) {
    begin(createRace({ track: game.track, mode: 'play', difficulty: game.difficulty, playerCar: game.car, playerLoadout: game.loadout }), 'play');
    game.race.player.autopilot = autopilot;
    screens.show(null);
  }

  // Escolher na arma 2 a mesma da arma 1 (ou o contrário) troca as duas de lugar.
  function pickWeapon(slot, id) {
    const l = game.loadout;
    if (slot === 'front0' || slot === 'front1') {
      const i = slot === 'front0' ? 0 : 1;
      if (l.front[1 - i] === id) l.front[1 - i] = l.front[i];
      l.front[i] = id;
    } else l[slot] = id;
    save(STORAGE.loadout, JSON.stringify(l));
    screens.showLoadout(l, game.car);
  }

  // Trocar de carro ajusta as armas: num carro de 1 arma fica a primeira; no de 2, a segunda volta preenchida.
  function pickCar(id) {
    game.car = id;
    game.loadout = sanitizeLoadout(game.loadout, id);
    save(STORAGE.car, id);
    save(STORAGE.loadout, JSON.stringify(game.loadout));
    screens.showLoadout(game.loadout, id);
  }

  function setPaused(paused) {
    if (game.screen !== 'play') return;
    game.paused = paused;
    screens.show(paused ? 'pause' : null);
  }

  function setDifficulty(key) {
    game.difficulty = key;
    screens.setDifficulty(key);
    save(STORAGE.difficulty, key);
  }

  // A corrida de fundo do menu recomeça na pista escolhida.
  function setTrack(id) {
    if (getTrack(id) === game.track) return;
    game.track = getTrack(id);
    screens.setTrack(game.track.id);
    save(STORAGE.track, game.track.id);
    if (game.screen === 'menu') startDemo();
  }

  function onKey(code) {
    synth.init();
    if (code === 'KeyM') { synth.muted = !synth.muted; return; }
    switch (game.screen) {
      case 'menu':
        if (code === 'Enter') openLoadout();
        else if (DIFFICULTY_KEYS[code]) setDifficulty(DIFFICULTY_KEYS[code]);
        else if (code === 'KeyT') setTrack(nextTrackId(game.track.id));
        break;
      case 'loadout':
        if (code === 'Enter') startPlay();
        else if (code === 'Escape') startDemo();
        break;
      case 'results':
        if (code === 'Enter') openLoadout();
        else if (code === 'KeyQ') startDemo();
        break;
      case 'play':
        if (code === 'Escape') setPaused(!game.paused);
        else if (game.paused && code === 'KeyR') startPlay();
        else if (game.paused && code === 'KeyQ') startDemo();
        break;
    }
  }

  keyboard.onPress(onKey);
  keyboard.onBlur(() => setPaused(true));
  const withSound = (fn) => () => { synth.init(); fn(); };
  screens.bind({
    equip: withSound(openLoadout),
    race: withSound(() => startPlay()),
    resume: withSound(() => setPaused(false)),
    restart: withSound(() => startPlay()),
    quit: withSound(startDemo),
    difficulty: setDifficulty,
    track: setTrack,
    car: pickCar,
    pick: pickWeapon,
  });
  screens.setDifficulty(game.difficulty);
  screens.setTrack(game.track.id);

  return {
    startDemo,
    startPlay,
    get race() { return game.race; },
    isRacing: () => game.screen === 'play',

    /** Um passo fixo da simulação. */
    step(dt) {
      if (game.paused) return;
      const race = game.race;
      if (race.player && !race.player.autopilot) keyboard.readControls(race.player.input);
      updateRace(race, dt);
      sfx.enabled = game.screen === 'play';
      for (const e of drainEvents(race)) {
        effects.handle(e, race, camera);
        hud.handle(e, race);
        sfx.handle(e, race, camera);
        if (e.type === 'race-over' && game.screen === 'play') {
          game.screen = 'results';
          screens.showResults(race);
        }
      }
    },

    /** Uma vez por quadro de tela: efeitos, câmera e som do motor. */
    frame(dt) {
      const race = game.race, p = race.player;
      if (!game.paused) {
        effects.update(race, dt);
        hud.update(dt);
      }
      camera.follow(p || race.ranking[0], dt);
      synth.engine(game.screen === 'play' && !game.paused && p?.alive, p ? Math.hypot(p.vx, p.vy) / p.stats.maxSpeed : 0);
    },
  };
}

// localStorage pode não existir (aba privada, bloqueio): o jogo funciona sem ele.
function load(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* sem armazenamento: tudo bem */ }
}
function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
