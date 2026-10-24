import { CAREER, CAR_MODELS, UNIT_MAX, UPGRADE_MAX, UPGRADES, WEAPONS } from '../config.js';
import { equipped } from '../sim/loadout.js';

// Encaixe da tela Equipar → tipo de arma que cabe nele.
export const SLOT_KIND = { front0: 'front', front1: 'front', rear: 'rear', extra: 'extra' };

/** O que volta ao vender algo que custou `price` (metade, no original). */
export const resale = (price) => Math.round(price * CAREER.resale);

/** A arma num encaixe ('front0', 'front1', 'rear' ou 'extra'), ou null. */
export function slotWeapon(loadout, slot) {
  return (slot === 'front0' ? loadout.front[0] : slot === 'front1' ? loadout.front[1] : loadout[slot]) ?? null;
}

function setSlotWeapon(loadout, slot, id) {
  if (slot === 'front0' || slot === 'front1') loadout.front[slot === 'front0' ? 0 : 1] = id;
  else loadout[slot] = id;
}

/** O modelo tem esse encaixe? (A Arma 2 só existe no carro de 2 armas de frente.) */
export function hasSlot(model, slot) {
  const slots = CAR_MODELS[model].slots;
  return slot === 'front0' ? slots.front >= 1 : slot === 'front1' ? slots.front >= 2 : slots[slot] > 0;
}

/**
 * Quanto custa pôr mais uma unidade de `id` no encaixe, já descontada a venda da arma que sai de lá, ou
 * null se não dá: encaixe que o carro não tem, arma do tipo errado, 5 unidades ou a mesma arma nos dois
 * encaixes da frente. Pode dar negativo (trocar 3 foguetes por 1 óleo devolve dinheiro).
 */
export function unitCost(car, slot, id) {
  const w = WEAPONS[id];
  if (!w || !hasSlot(car.model, slot) || w.slot !== SLOT_KIND[slot]) return null;
  const current = slotWeapon(car.loadout, slot);
  if (current === id) return car.units[id] < UNIT_MAX ? w.price : null;
  const other = slot === 'front0' ? 'front1' : slot === 'front1' ? 'front0' : null;
  if (other && slotWeapon(car.loadout, other) === id) return null;
  return w.price - (current ? resale(WEAPONS[current].price) * car.units[current] : 0);
}

export function canBuyUnit(state, slot, id) {
  const cost = unitCost(state.car, slot, id);
  return cost !== null && state.money >= cost;
}

/** Compra uma unidade. Se o encaixe tem outra arma, ela é vendida e entra 1 unidade da nova. */
export function buyUnit(state, slot, id) {
  if (!canBuyUnit(state, slot, id)) return false;
  const car = state.car, current = slotWeapon(car.loadout, slot);
  state.money -= unitCost(car, slot, id);
  if (current !== id) {
    if (current) delete car.units[current];
    setSlotWeapon(car.loadout, slot, id);
    car.units[id] = 0;
  }
  car.units[id]++;
  return true;
}

/** Vende uma unidade da arma do encaixe. Vender a última deixa o encaixe vazio. */
export function sellUnit(state, slot) {
  const car = state.car, id = slotWeapon(car.loadout, slot);
  if (!id) return false;
  state.money += resale(WEAPONS[id].price);
  if (--car.units[id] <= 0) {
    delete car.units[id];
    setSlotWeapon(car.loadout, slot, null);
  }
  return true;
}

/** Preço do nível `level` de uma melhoria ('engine', 'tires' ou 'armor'). */
export const upgradePrice = (key, level) => UPGRADES[key].base * level;

export function canBuyUpgrade(state, key) {
  const level = state.car.upgrades[key];
  return level < UPGRADE_MAX && state.money >= upgradePrice(key, level + 1);
}

export function buyUpgrade(state, key) {
  if (!canBuyUpgrade(state, key)) return false;
  state.money -= upgradePrice(key, ++state.car.upgrades[key]);
  return true;
}

/** Vende o último nível pela metade do que ele custou. */
export function sellUpgrade(state, key) {
  const car = state.car;
  if (!(car.upgrades[key] > 0)) return false;
  state.money += resale(upgradePrice(key, car.upgrades[key]--));
  return true;
}

/** Quanto as armas e as melhorias instaladas valem na venda. */
export function equipmentValue(car) {
  let value = 0;
  for (const id of equipped(car.loadout)) value += resale(WEAPONS[id].price) * car.units[id];
  for (const key of Object.keys(UPGRADES)) {
    for (let n = 1; n <= car.upgrades[key]; n++) value += resale(upgradePrice(key, n));
  }
  return value;
}
