// 日付はすべて端末のローカル時刻の 'YYYY-MM-DD' 文字列で扱う

export const WD = ['日', '月', '火', '水', '木', '金', '土'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayStr = () => ymd(new Date());

export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** b − a の日数 */
export const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

export const weekday = (s: string) => parse(s).getDay();

/** その日を含む週の月曜日 */
export const mondayOf = (s: string) => addDays(s, -((weekday(s) + 6) % 7));

export const isYmd = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s;

/** 10月8日（木） */
export const jDate = (s: string) => {
  const d = parse(s);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
};

/** 10/8 */
export const jMD = (s: string) => {
  const d = parse(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const isHHMM = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 分 → 'H:MM'（日をまたいでも 0〜23 時に丸める） */
export const fromMin = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};
