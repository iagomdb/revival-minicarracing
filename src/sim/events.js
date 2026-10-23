// A simulação não toca som nem desenha: ela só anota o que aconteceu.
// Quem cuida de som, efeitos e HUD lê esta fila depois de cada passo.

export function emit(race, type, data = {}) {
  race.events.push({ type, ...data });
}

export function drainEvents(race) {
  const list = race.events;
  race.events = [];
  return list;
}
