/** 83.47 → "1:23.4" */
export function formatTime(seconds) {
  const tenths = Math.floor(seconds * 10);
  const m = Math.floor(tenths / 600), s = (tenths % 600) / 10;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

/** 12000 → "12.000" (ponto separando os milhares). */
export const groupThousands = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 12000 → "$ 12.000". Negativo: "-$ 1.500". */
export function formatMoney(value) {
  return `${value < 0 ? '-' : ''}$ ${groupThousands(Math.abs(value))}`;
}
