/** Cria um elemento, com classe e texto se vierem. */
export function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Fileira de `total` LEDs com os `lit` primeiros acesos (os 5 níveis da loja original). */
export function leds(doc, total, lit) {
  const row = el(doc, 'span', 'leds');
  for (let i = 0; i < total; i++) row.append(el(doc, 'i', i < lit ? 'on' : ''));
  return row;
}

/** Linha de tabela com um valor por célula. */
export function tableRow(doc, values, cls) {
  const tr = el(doc, 'tr', cls);
  for (const value of values) tr.append(el(doc, 'td', '', value));
  return tr;
}
