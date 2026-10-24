import { createTrack } from '../track.js';
import desert from './desert.js';
import escada from './escada.js';
import oito from './oito.js';
import serpente from './serpente.js';
import triangulo from './triangulo.js';

// Todas as pistas, na ordem do menu. A primeira é a pista inicial.
// Pista nova: crie o arquivo nesta pasta e ponha uma linha aqui.
export const TRACKS = [oito, desert, serpente, escada, triangulo];

const built = new Map();

/** A pista pronta para correr, montada só na primeira vez. Um id desconhecido dá a pista inicial. */
export function getTrack(id) {
  const data = TRACKS.find((t) => t.id === id) || TRACKS[0];
  if (!built.has(data.id)) built.set(data.id, createTrack(data));
  return built.get(data.id);
}

/** A pista seguinte da lista (depois da última, volta para a primeira). */
export function nextTrackId(id) {
  const i = TRACKS.findIndex((t) => t.id === id);
  return TRACKS[(i + 1) % TRACKS.length].id;
}
