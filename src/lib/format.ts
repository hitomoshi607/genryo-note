export const r1 = (n: number) => Math.round(n * 10) / 10;

/** 小数1桁固定: 78.3 / 69.0 */
export const f1 = (n: number) => r1(n).toFixed(1);

/** 余計な 0 を付けない: 69 / 69.5 */
export const kg = (n: number) => String(r1(n));

/** 符号付き: −0.4 / ＋0.2 / ±0.0 */
export const signed = (n: number) => {
  const v = r1(n);
  if (Math.abs(v) < 0.05) return '±0.0';
  return (v < 0 ? '−' : '＋') + Math.abs(v).toFixed(1);
};

export const comma = (n: number) => Math.round(n).toLocaleString('ja-JP');
