// 目標の初期値と筋トレメニュー（SPEC.md「目標」「ジム」）

/** 2026-11-20 時点：165cm・82kg。毎月 −2kg で半年後に 70kg */
export const DEFAULT_GOAL = {
  startDate: '2026-11-20',
  startWeight: 82,
  goalWeight: 70,
  perMonth: 2,
} as const;

/** 最初の体組成（TANITA 2026-11-28）。体重は 脂肪量21.2 ＋ 除脂肪量59.0 */
export const FIRST_COMP = {
  d: '2026-11-28',
  c: { w: 80.2, fat: 26.4, muscle: 55.9, visceral: 11, bmr: 1731, bone: 3.1, water: 49.6 },
} as const;

/** いつものジムの設備。メニューはここにあるものだけを使う */
export const EQUIPMENT = [
  // マシンエリア
  'レッグエクステンション', 'レッグカール', 'レッグプレス', 'ヒップアダクション', 'ヒップアブダクション',
  'ラットプルダウン', 'ロー', 'ペクトラルフライ兼リアデルトイド', 'チェストプレス', 'ショルダープレス',
  'アブドミナル（1F）', 'トーソローテーション（1F）',
  // フリーウェイト
  'スミスマシン', 'パワーラック', 'バーベル', 'ダンベル', 'ベンチ', 'ライナーレッグプレス', 'V-スクワット',
  'アイソラテラル フロントラットプルダウン', 'アイソラテラル D.Y.ロー', 'アイソラテラル インクラインプレス',
  'シーテッドアームカール', 'シットアップベンチ（1F）', 'バックエクステンション（1F）',
  // ファンクショナル
  'ケーブルマシン',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** 種目の役割（脚を毎回入れる・押す／引くをそろえる、の確認に使う） */
export type Part = 'legs' | 'hinge' | 'push' | 'pull' | 'core';

export interface Exercise {
  id: string;
  n: string;
  /** 使う設備（EQUIPMENT の名前） */
  where: Equipment[];
  part: Part;
  sets: number;
  lo: number;
  hi: number;
  /** レストタイマーの秒数 */
  restSec: number;
  /** 増量幅 kg */
  inc: number;
  /** バーベル種目のウォームアップ */
  warm?: string;
  tip: string;
  /** 設備が空いていないときの代わり */
  alt: { n: string; where: Equipment[] };
}

export type Session = 'A' | 'B';

export interface Workout {
  name: string;
  short: string;
  ex: Exercise[];
}

const BAR_WARM = 'バーだけ×10 → 本番の5割×5 → 7割×3';

/**
 * 週3回（水・金・日）の全身。ベンチの日とデッドリフトの日を交互に行う。
 * どちらの日も脚を入れ、押す・引くをそろえて4種目（1種目10分ほど）。
 */
export const WORKOUTS: Record<Session, Workout> = {
  A: {
    name: 'ベンチプレスの日',
    short: 'ベンチ',
    ex: [
      {
        id: 'bench',
        n: 'ベンチプレス',
        where: ['バーベル', 'ベンチ', 'パワーラック'],
        part: 'push',
        sets: 3,
        lo: 6,
        hi: 10,
        restSec: 150,
        inc: 2.5,
        warm: BAR_WARM,
        tip: 'セーフティバーを胸より少し低い高さに置く。肩甲骨を寄せて下げたまま、みぞおちのあたりへ下ろす。',
        alt: { n: 'チェストプレス', where: ['チェストプレス'] },
      },
      {
        id: 'squat',
        n: 'スクワット',
        where: ['バーベル', 'パワーラック'],
        part: 'legs',
        sets: 3,
        lo: 6,
        hi: 10,
        restSec: 150,
        inc: 2.5,
        warm: BAR_WARM,
        tip: 'セーフティバーをしゃがみきった高さの少し下に置く。太ももが床と平行になるまで下げ、膝はつま先と同じ向きに。',
        alt: { n: 'V-スクワット', where: ['V-スクワット'] },
      },
      {
        id: 'pulldown',
        n: 'ラットプルダウン',
        where: ['ラットプルダウン'],
        part: 'pull',
        sets: 3,
        lo: 8,
        hi: 12,
        restSec: 90,
        inc: 2.5,
        tip: '胸を張って、肘を脇腹へ引く。反動を使わず、2秒かけて戻す。',
        alt: { n: 'フロントラットプルダウン', where: ['アイソラテラル フロントラットプルダウン'] },
      },
      {
        id: 'abs',
        n: 'アブドミナル',
        where: ['アブドミナル（1F）'],
        part: 'core',
        sets: 3,
        lo: 10,
        hi: 15,
        restSec: 60,
        inc: 2.5,
        tip: 'おへそをのぞき込むように背中を丸める。腕の力で引かない。',
        alt: { n: 'ケーブルクランチ', where: ['ケーブルマシン'] },
      },
    ],
  },
  B: {
    name: 'デッドリフトの日',
    short: 'デッド',
    ex: [
      {
        id: 'deadlift',
        n: 'デッドリフト',
        where: ['バーベル'],
        part: 'hinge',
        sets: 3,
        lo: 5,
        hi: 8,
        restSec: 150,
        inc: 2.5,
        warm: BAR_WARM,
        tip: 'バーはすねの近く。背中をまっすぐ保ち、床を押すように立つ。下ろすときもバーを体から離さない。',
        alt: { n: 'スミスマシン デッドリフト', where: ['スミスマシン'] },
      },
      {
        id: 'legpress',
        n: 'レッグプレス',
        where: ['レッグプレス'],
        part: 'legs',
        sets: 3,
        lo: 10,
        hi: 15,
        restSec: 120,
        inc: 5,
        tip: '膝が胸に近づくまで下ろし、お尻が浮く手前で止める。伸ばしたときに膝を伸ばしきらない。',
        alt: { n: 'ライナーレッグプレス', where: ['ライナーレッグプレス'] },
      },
      {
        id: 'incline',
        n: 'インクラインプレス',
        where: ['アイソラテラル インクラインプレス'],
        part: 'push',
        sets: 3,
        lo: 8,
        hi: 12,
        restSec: 120,
        inc: 2.5,
        tip: '肩甲骨を寄せたまま押す。下ろすときは2秒かける。',
        alt: { n: 'ショルダープレス', where: ['ショルダープレス'] },
      },
      {
        id: 'row',
        n: 'ロー',
        where: ['ロー'],
        part: 'pull',
        sets: 3,
        lo: 8,
        hi: 12,
        restSec: 90,
        inc: 2.5,
        tip: '胸をパッドにつけ、肘を後ろへ引いて肩甲骨を寄せる。',
        alt: { n: 'D.Y.ロー', where: ['アイソラテラル D.Y.ロー'] },
      },
    ],
  },
};

export const ALL_EXERCISES: Exercise[] = [...WORKOUTS.A.ex, ...WORKOUTS.B.ex];

/** 有酸素（傾斜ウォーキング）の初期値。1km 12:30 ペース = 時速4.8km */
export const DEFAULT_CARDIO = {
  incline: 12,
  speed: 4.8,
  /** 有酸素日 */
  cardioMin: 25,
  /** 筋トレ日の筋トレのあと */
  liftMin: 20,
} as const;

/** 1km あたりの時間（分）を 'M:SS' に */
export function pace(speedKmh: number) {
  if (!(speedKmh > 0)) return '—';
  const sec = Math.round(3600 / speedKmh);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** 睡眠の目安（時間） */
export const SLEEP_TARGET_H = 7;
