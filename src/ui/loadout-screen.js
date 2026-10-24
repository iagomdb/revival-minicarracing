import { CAR_MODELS, UNIT_MAX, UPGRADE_MAX, UPGRADES, WEAPONS } from '../config.js';
import { formatMoney } from '../core/format.js';
import { canBuyUnit, canBuyUpgrade, hasSlot, resale, SLOT_KIND, slotWeapon, unitCost, upgradePrice } from '../career/shop.js';
import { weaponsFor } from '../sim/loadout.js';
import { carCard } from './car-card.js';
import { el, leds } from './dom.js';

const TEXT = {
  quick: { sub: 'Escolha o carro e o que vai nele. A munição de cada arma recarrega a cada volta, e cada unidade a mais soma munição.', car: 'Carro', back: 'Voltar' },
  shop: { sub: 'Compre armas e melhorias. Cada unidade de uma arma soma munição por volta, e vender devolve metade.', car: 'Seu carro', back: 'Garagem' },
};

/** "60 de dano · 8 por volta" */
function weaponStats(w, units) {
  const dmg = w.shot?.damage ?? w.mine?.damage;
  return `${dmg ? `${dmg} de dano` : 'sem dano'} · ${w.ammo * units} por volta`;
}

/**
 * A tela Equipar. Na corrida rápida tudo é de graça: carro, armas e de 1 a 5 unidades de cada uma.
 * No campeonato ela vira a loja: o carro é o comprado, cada unidade e cada nível de melhoria custam
 * dinheiro, e um encaixe pode ficar vazio. A tela só mostra; quem compra é o jogo.
 */
export function createLoadoutScreen(doc) {
  const $ = (id) => doc.getElementById(id);
  const on = { car() {}, pick() {}, units() {}, upgrade() {} };
  const quickCars = Object.keys(CAR_MODELS).map((id) => carCard(doc, id));
  for (const b of quickCars) b.addEventListener('click', () => on.car(b.dataset.id));

  // Em cada encaixe: um botão por arma e, no cabeçalho, os LEDs das unidades com − e +.
  const slots = [...doc.querySelectorAll('#loadout [data-slot]')].map((box) => {
    const slot = box.dataset.slot;
    const cards = weaponsFor(SLOT_KIND[slot]).map((id) => {
      const w = WEAPONS[id], button = el(doc, 'button', 'choice');
      button.dataset.id = id;
      button.append(el(doc, 'b', '', w.name), el(doc, 'span', 'stat'), el(doc, 'span', 'info', w.info), el(doc, 'span', 'price'));
      button.addEventListener('click', () => on.pick(slot, id));
      return button;
    });
    box.replaceChildren(...cards);
    const minus = el(doc, 'button', 'tiny', '−'), plus = el(doc, 'button', 'tiny', '+'), bar = el(doc, 'span');
    minus.addEventListener('click', () => on.units(slot, -1));
    plus.addEventListener('click', () => on.units(slot, +1));
    const units = el(doc, 'span', 'units');
    units.append(minus, bar, plus);
    box.parentElement.querySelector('.slot-head').append(units);
    return { slot, box, cards, minus, plus, bar };
  });

  // Melhorias: só no campeonato.
  const upgradeRows = Object.keys(UPGRADES).map((key) => {
    const row = el(doc, 'div', 'upgrade'), name = el(doc, 'span');
    name.append(el(doc, 'b', '', UPGRADES[key].name), el(doc, 'span', 'info', UPGRADES[key].info));
    const bar = el(doc, 'span'), minus = el(doc, 'button', 'tiny', '−'), plus = el(doc, 'button', 'tiny');
    minus.addEventListener('click', () => on.upgrade(key, -1));
    plus.addEventListener('click', () => on.upgrade(key, +1));
    row.append(name, minus, bar, plus);
    return { key, bar, minus, plus, row };
  });
  $('upgradeList').replaceChildren(...upgradeRows.map((u) => u.row));

  function setMode(mode) {
    const shop = mode === 'shop';
    $('loSub').textContent = TEXT[mode].sub;
    $('carLabel').textContent = TEXT[mode].car;
    $('backBtn').firstChild.textContent = `${TEXT[mode].back} `;
    $('loMoney').hidden = !shop;
    $('upgrades').hidden = !shop;
    for (const s of slots) for (const b of s.cards) b.lastChild.hidden = !shop;
  }

  // O que vale para as duas: encaixe que o carro não tem some, a arma escolhida fica marcada e os LEDs
  // mostram as unidades. `units(id)` diz quantas unidades a arma tem.
  function drawSlots(model, loadout, units) {
    for (const s of slots) {
      s.box.parentElement.hidden = !hasSlot(model, s.slot);
      const chosen = slotWeapon(loadout, s.slot), n = chosen ? units(chosen) : 0;
      s.bar.replaceChildren(leds(doc, UNIT_MAX, n));
      for (const b of s.cards) {
        const id = b.dataset.id;
        b.classList.toggle('on', id === chosen);
        b.children[1].textContent = weaponStats(WEAPONS[id], id === chosen ? n : 1);
      }
    }
  }

  return {
    bind(handlers) { Object.assign(on, handlers); },

    /** Corrida rápida: o carro escolhido, as armas e as unidades de cada uma (de 1 a 5, de graça). */
    showLoadout(loadout, model, units) {
      setMode('quick');
      $('cars').replaceChildren(...quickCars);
      for (const b of quickCars) b.classList.toggle('on', b.dataset.id === model);
      const count = (id) => units[id] ?? 1;
      drawSlots(model, loadout, count);
      for (const s of slots) {
        const n = count(slotWeapon(loadout, s.slot));
        s.minus.disabled = n <= 1;
        s.plus.disabled = n >= UNIT_MAX;
        s.minus.title = s.plus.title = '';
        for (const b of s.cards) b.disabled = false;
      }
    },

    /** Campeonato: o carro comprado e o que dá para comprar ou vender com o dinheiro que o jogador tem. */
    showShop(state) {
      const car = state.car;
      setMode('shop');
      $('loMoney').textContent = formatMoney(state.money);
      const mine = carCard(doc, car.model, { upgrades: car.upgrades, tag: 'div' });
      mine.classList.add('on');
      $('cars').replaceChildren(mine);
      drawSlots(car.model, car.loadout, (id) => car.units[id] ?? 0);

      for (const s of slots) {
        const chosen = slotWeapon(car.loadout, s.slot), price = chosen ? WEAPONS[chosen].price : 0;
        s.minus.disabled = !chosen;
        s.plus.disabled = !chosen || !canBuyUnit(state, s.slot, chosen);
        s.minus.title = chosen ? `Vender 1: volta ${formatMoney(resale(price))}` : '';
        s.plus.title = chosen ? `Comprar mais 1: ${formatMoney(price)}` : '';
        for (const b of s.cards) {
          const id = b.dataset.id, cost = unitCost(car, s.slot, id);
          b.disabled = id !== chosen && !canBuyUnit(state, s.slot, id);
          b.lastChild.textContent =
            id === chosen ? `${car.units[id]}× · ${formatMoney(WEAPONS[id].price)} cada`
            : cost === null ? 'Já está na outra arma'
            : chosen ? (cost < 0 ? `Trocar: volta ${formatMoney(-cost)}` : `Trocar: ${formatMoney(cost)}`)
            : formatMoney(cost);
        }
      }

      for (const u of upgradeRows) {
        const level = car.upgrades[u.key];
        u.bar.replaceChildren(leds(doc, UPGRADE_MAX, level));
        u.minus.disabled = level <= 0;
        u.minus.title = level > 0 ? `Vender 1 nível: volta ${formatMoney(resale(upgradePrice(u.key, level)))}` : '';
        u.plus.disabled = !canBuyUpgrade(state, u.key);
        u.plus.textContent = level >= UPGRADE_MAX ? 'Máximo' : `+ ${formatMoney(upgradePrice(u.key, level + 1))}`;
      }
    },
  };
}
