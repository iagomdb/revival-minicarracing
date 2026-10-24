import { CAR_MODELS, CHAMPIONSHIPS, DIFFICULTIES } from '../config.js';
import { SAVE_VERSION } from './championship.js';

const KEY = 'minicar.campeonato';

// `storage` é o localStorage do navegador (nos testes, um objeto falso). Ele pode faltar ou dar erro
// (aba privada, bloqueio): aí o jogo segue sem save.

/** O campeonato salvo, ou null se não há, está corrompido ou é de outra versão. */
export function loadChampionship(storage) {
  try {
    const state = JSON.parse(storage.getItem(KEY));
    return isValid(state) ? state : null;
  } catch {
    return null;
  }
}

export function saveChampionship(storage, state) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* sem armazenamento: tudo bem */ }
}

export function clearChampionship(storage) {
  try { storage.removeItem(KEY); } catch { /* sem armazenamento: tudo bem */ }
}

function isValid(s) {
  const car = s?.car;
  return s?.version === SAVE_VERSION
    && CHAMPIONSHIPS.some((c) => c.id === s.id) && Object.hasOwn(DIFFICULTIES, s.difficulty)
    && Number.isFinite(s.money) && Number.isInteger(s.race)
    && Array.isArray(s.drivers) && s.drivers.some((d) => d.player)
    && (car === null || (Object.hasOwn(CAR_MODELS, car?.model) && Array.isArray(car.loadout?.front)
      && car.units instanceof Object && car.upgrades instanceof Object));
}
