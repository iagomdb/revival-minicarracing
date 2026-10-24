import { CAR_MODELS, DEFAULT_CAR, DEFAULT_LOADOUT, WEAPONS } from '../config.js';
import { pick, shuffle } from '../core/math.js';

/** Armas que cabem num tipo de encaixe ('front', 'rear' ou 'extra'). */
export const weaponsFor = (slot) => Object.keys(WEAPONS).filter((id) => WEAPONS[id].slot === slot);

/** Todas as armas equipadas, na ordem dos botões: frente 1, frente 2, traseira, extra (as que o carro tiver). */
export const equipped = (loadout) => [...loadout.front, loadout.rear, loadout.extra].filter(Boolean);

/** Munição por volta de uma arma no carro: a da arma vezes as unidades compradas (sem compra, 1). */
export const maxAmmo = (car, id) => WEAPONS[id].ammo * (car.units?.[id] ?? 1);

/** Enche a munição das armas equipadas até o limite da volta (não acumula). */
export function refillAmmo(car) {
  for (const id of equipped(car.loadout)) car.ammo[id] = maxAmmo(car, id);
}

/** Equipamento sorteado para a CPU, com o número de armas que o modelo do carro tem. */
export function randomLoadout(rng, model = DEFAULT_CAR) {
  const slots = CAR_MODELS[model].slots;
  const one = (kind) => (slots[kind] ? pick(rng, weaponsFor(kind)) : null);
  return { front: shuffle(weaponsFor('front'), rng).slice(0, slots.front), rear: one('rear'), extra: one('extra') };
}

/**
 * Equipamento comprado (campeonato): fica só o que cabe no modelo e tem unidade em `units`, sem repetir
 * arma na frente. Encaixe sem arma fica vazio (null), sem completar com o padrão. A frente sempre tem um
 * lugar por arma do modelo, para cada arma continuar na sua tecla.
 */
export function fitLoadout(loadout, model, units) {
  const slots = CAR_MODELS[model].slots;
  const has = (id, kind) => WEAPONS[id]?.slot === kind && units[id] > 0;
  const wanted = Array.isArray(loadout?.front) ? loadout.front : [];
  const front = Array.from({ length: slots.front }, (_, i) =>
    (has(wanted[i], 'front') && wanted.indexOf(wanted[i]) === i ? wanted[i] : null));
  const one = (kind) => (slots[kind] && has(loadout?.[kind], kind) ? loadout[kind] : null);
  return { front, rear: one('rear'), extra: one('extra') };
}

/**
 * Ajusta um equipamento (vindo do armazenamento ou de outro carro) aos encaixes do modelo: mantém as armas
 * válidas na ordem, descarta as repetidas e as que sobram, e completa o que faltar com o padrão.
 * Trocar para um carro de 1 arma deixa a primeira; voltar para um de 2 preenche a segunda com outra arma.
 */
export function sanitizeLoadout(loadout, model = DEFAULT_CAR) {
  const slots = CAR_MODELS[model].slots;
  const fits = (id, kind) => WEAPONS[id]?.slot === kind;
  const wanted = Array.isArray(loadout?.front) ? loadout.front : [];
  const front = [];
  for (const id of [...wanted, ...DEFAULT_LOADOUT.front, ...weaponsFor('front')]) {
    if (front.length < slots.front && fits(id, 'front') && !front.includes(id)) front.push(id);
  }
  const one = (kind) => (!slots[kind] ? null : fits(loadout?.[kind], kind) ? loadout[kind] : DEFAULT_LOADOUT[kind]);
  return { front, rear: one('rear'), extra: one('extra') };
}
