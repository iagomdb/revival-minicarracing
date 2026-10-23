/** 83.47 → "1:23.4" */
export function formatTime(seconds) {
  const tenths = Math.floor(seconds * 10);
  const m = Math.floor(tenths / 600), s = (tenths % 600) / 10;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
