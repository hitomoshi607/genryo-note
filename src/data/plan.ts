import type { DayType, FoodKey, GymDay } from '../lib/schema';

/* ---------- 曜日の種別 ---------- */

export const T_SHORT: Record<DayType, string> = { uni: '大学', A: 'A', B: 'B', C: 'C', rest: '休' };
export const T_OPT: Record<DayType, string> = { uni: '大学', A: 'ジムA', B: 'ジムB', C: 'ジムC', rest: '休養' };
export const T_MAIN: Record<DayType, string> = { uni: '大学の日', A: 'ジムの日', B: 'ジムの日', C: 'ジムの日', rest: '休養日' };
export const T_SUB: Record<DayType, string> = {
  uni: '歩数をかせぐ日',
  A: 'Day A　全身（スクワット中心）',
  B: 'Day B　全身（デッドリフト中心）',
  C: 'Day C　全身（マシン中心）',
  rest: '体を回復させる日',
};

/* ---------- 毎日のチェック（id は試作版と同じ） ---------- */

export interface Check {
  id: string;
  t: string;
  d: string;
  gymOnly?: boolean;
}

export const CHECKS: Check[] = [
  { id: 'wake', t: '起きる時間を守る', d: '設定した起床時刻の±1時間以内。休日もそろえると夜に眠くなりやすくなります。' },
  { id: 'sleep', t: '7時間以上ねた', d: '寝不足の日は食欲が強くなり、内臓脂肪もつきやすくなります。' },
  { id: 'steps', t: '8,000歩あるいた', d: 'スマホの歩数計で確認。1日60分ほど歩く量です。' },
  { id: 'protein', t: '毎食タンパク質', d: '肉・魚・卵・大豆製品を毎食、手のひら1枚分以上。筋肉を守る一番の条件です。' },
  { id: 'rice', t: 'ご飯150gまで', d: '1食あたり。ジムの日の夕食だけ180gまで。' },
  { id: 'veg', t: '野菜を2食以上', d: 'サラダ、おひたし、汁物の具でもOK。' },
  { id: 'nosugar', t: '甘い飲み物ゼロ', d: 'ジュース、加糖コーヒー、エナジードリンク。内臓脂肪にいちばん効く項目です。水・お茶・無糖炭酸に。' },
  { id: 'gym', t: 'ジムのメニュー完了', d: 'ジムの日だけ表示されます。', gymOnly: true },
  { id: 'phone', t: '寝る30分前にスマホを置く', d: '画面の光と刺激で寝つきが悪くなるのを防ぎます。' },
];

/* ---------- 今日のひとこと ---------- */

export const TIPS = [
  '体重は1日で0.5〜1kg動きます。判断は7日平均だけでOK。',
  '筋肉量が減っていなければ、体重の減りが遅くても順調です。',
  '寝不足は内臓脂肪と食欲の両方に効きます。今夜は早めに。',
  'ご飯を量るのは最初の2週間だけでも効果あり。',
  '食べすぎた翌日に食事を抜く必要はなし。次の食事をいつも通りに。',
  'ジムでは「あと2回できる」強さで止める。追い込みすぎない。',
  '500mlのジュースをお茶に替えるだけで約200kcal減ります。',
  '家族に「いま減量中」と伝えると、ごはんの協力が得やすくなります。',
  '夕方に空腹すぎると食べすぎます。16時の間食は計画のうち。',
];

/* ---------- 筋トレメニュー（いつものジムの設備のみ） ---------- */
/*
 * 2026-10-08 改訂: 週3回とも全身を鍛える形（全身×3）。
 * - 主要な部位（脚前・胸・背中）は週3回・合計9セット、腹は週3回・合計8セット
 * - 1回休んでも、どの部位も週2回は鍛えられる
 * - バーベル種目は 6〜10回で重さを保つ（減量中に筋肉を守るいちばんの要素）
 * 根拠は help.tsx の 'program'。
 */

/** いつものジムの設備リスト。where はこの中の名前を「＋」でつないだもの */
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

export type Muscle = 'quads' | 'hams' | 'glutes' | 'chest' | 'back' | 'sideDelt' | 'rearDelt' | 'biceps' | 'triceps' | 'abs';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  quads: '脚の前（太もも前）',
  hams: '脚の裏（もも裏）',
  glutes: 'お尻',
  chest: '胸',
  back: '背中',
  sideDelt: '肩（横）',
  rearDelt: '肩（後ろ）',
  biceps: '腕（力こぶ）',
  triceps: '腕（裏）',
  abs: '腹',
};

export interface Exercise {
  id: string;
  n: string;
  /** 場所・マシン（EQUIPMENT の名前を「＋」でつなぐ） */
  where: string;
  /** 主に鍛える部位（週のセット数の集計に使う） */
  focus: Muscle;
  sets: number;
  lo: number;
  hi: number;
  /** 表示用の休憩時間 */
  rest: string;
  /** レストタイマーの秒数 */
  restSec: number;
  /** 増量幅 kg（0 = 自重） */
  inc: number;
  /** 片側ずつ行う種目 */
  side?: string;
  tip: string;
  alt?: string;
}

export interface Workout {
  name: string;
  short: string;
  time: string;
  warm: string;
  cardioAt: string;
  cardio: string;
  ex: Exercise[];
}

// 複数の日に出てくる種目（サイドレイズ・アブドミナル）は、記録と提案を共有するので内容をそろえる
const LATERAL: Exercise = {
  id: 'lateral', n: 'サイドレイズ', where: 'ダンベル', focus: 'sideDelt', sets: 2, lo: 12, hi: 20, rest: '60〜90秒', restSec: 75, inc: 1,
  tip: '軽い重さで、ひじから先に肩の高さまで上げる。反動を使わず、下ろすときもゆっくり。',
  alt: 'ケーブルマシンで片手ずつでもOK。重さは片手で記録。',
};

const ABS: Exercise = {
  id: 'abs', n: 'アブドミナル', where: 'アブドミナル（1F）', focus: 'abs', sets: 3, lo: 10, hi: 15, rest: '60〜90秒', restSec: 75, inc: 2.5,
  tip: 'おへそをのぞき込むように背中を丸める。腕や首で引っぱらない。1Fなので最後にまとめて。',
  alt: 'シットアップベンチ（1F）のクランチでもOK（自重なら0kgで記録）。',
};

export const WORKOUTS: Record<GymDay, Workout> = {
  A: {
    name: '全身（スクワット中心）',
    short: 'スクワット',
    time: '約70分',
    warm: 'バイク5分＋スクワットを軽く2〜3セット',
    cardioAt: 'ランニングマシン',
    cardio: '傾斜10%・時速5kmの早歩き 15〜20分',
    ex: [
      { id: 'squat', n: 'スクワット', where: 'パワーラック', focus: 'quads', sets: 3, lo: 6, hi: 10, rest: '2〜3分', restSec: 150, inc: 5,
        tip: '足は肩幅、太ももが床と平行になる深さまで。膝とつま先の向きをそろえる。セーフティバーは必ず設定。',
        alt: 'スミスマシンでもOK。' },
      { id: 'bench', n: 'ベンチプレス', where: 'パワーラック＋ベンチ', focus: 'chest', sets: 3, lo: 6, hi: 10, rest: '2〜3分', restSec: 150, inc: 2.5,
        tip: '肩甲骨を寄せて胸を張り、バーはみぞおちの上に下ろす。セーフティバーは必ず設定。',
        alt: 'スミスマシンでもOK。' },
      { id: 'latpull', n: 'ラットプルダウン', where: 'ラットプルダウン', focus: 'back', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 2.5,
        tip: '胸を張ったまま、ひじを脇腹へ下ろすイメージで鎖骨まで引く。',
        alt: 'アイソラテラル フロントラットプルダウンでもOK。' },
      { id: 'legcurl', n: 'レッグカール', where: 'レッグカール', focus: 'hams', sets: 3, lo: 10, hi: 15, rest: '90秒', restSec: 90, inc: 2.5,
        tip: '反動を使わず、戻すときに2秒かける。' },
      LATERAL,
      ABS,
    ],
  },
  B: {
    name: '全身（デッドリフト中心）',
    short: 'デッドリフト',
    time: '約65分',
    warm: 'クロストレーナー5分＋ルーマニアン・デッドリフトを軽く2セット',
    cardioAt: 'クロストレーナーかバイク',
    cardio: '15〜20分（会話がぎりぎりできる強さ）',
    ex: [
      { id: 'rdl', n: 'ルーマニアン・デッドリフト', where: 'パワーラック＋バーベル', focus: 'hams', sets: 3, lo: 6, hi: 10, rest: '2〜3分', restSec: 150, inc: 5,
        tip: '膝は軽く曲げたまま、お尻を後ろに引いて下ろす。背中は丸めない。もも裏が伸びたら戻る。',
        alt: 'ダンベルでもOK。' },
      { id: 'incline', n: 'インクライン・プレス', where: 'アイソラテラル インクラインプレス', focus: 'chest', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 2.5,
        tip: '胸の上のほうを使う意識で。肩がすくまないように。',
        alt: 'ダンベル＋アジャストベンチでもOK。' },
      { id: 'row', n: 'シーテッド・ロー', where: 'ロー', focus: 'back', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 2.5,
        tip: '背すじを伸ばし、肩甲骨を寄せて引く。',
        alt: 'アイソラテラル D.Y.ローでもOK。' },
      { id: 'legpress', n: 'レッグプレス', where: 'レッグプレス', focus: 'quads', sets: 3, lo: 10, hi: 15, rest: '90秒', restSec: 90, inc: 5,
        tip: '膝を伸ばし切らない。お尻が浮かない深さまで下ろす。',
        alt: 'ライナーレッグプレスでもOK。' },
      { id: 'curl', n: 'アームカール', where: 'シーテッドアームカール', focus: 'biceps', sets: 2, lo: 10, hi: 15, rest: '60〜90秒', restSec: 75, inc: 2.5,
        tip: 'ひじの位置を動かさず、下ろすときもゆっくり。次のプレスダウンと交互に行うと時間を短くできる。' },
      { id: 'pushdown', n: 'プレスダウン', where: 'ケーブルマシン', focus: 'triceps', sets: 2, lo: 10, hi: 15, rest: '60〜90秒', restSec: 75, inc: 2.5,
        tip: 'ひじを脇につけたまま、腕を伸ばし切る。' },
      { id: 'cablecrunch', n: 'ケーブル・クランチ', where: 'ケーブルマシン', focus: 'abs', sets: 2, lo: 10, hi: 15, rest: '60〜90秒', restSec: 75, inc: 2.5,
        tip: 'ロープを頭の横で持って膝立ちになり、みぞおちを骨盤に近づけるように背中を丸める。腰ではなくお腹で曲げる。',
        alt: 'アブドミナル（1F）でもOK。' },
    ],
  },
  C: {
    name: '全身（マシン中心）',
    short: 'マシン',
    time: '約80分',
    warm: 'バイク5分＋V-スクワットを軽く2セット',
    cardioAt: 'ランニングマシン',
    cardio: '傾斜ウォーク 25〜30分（休日なので長め）',
    ex: [
      { id: 'vsquat', n: 'V-スクワット', where: 'V-スクワット', focus: 'quads', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 5,
        tip: 'Day Aより軽め・回数多めで、深くしゃがむ。',
        alt: 'ブルガリアン・スクワット（ダンベル＋ベンチ）でもOK。' },
      { id: 'chestpress', n: 'チェストプレス', where: 'チェストプレス', focus: 'chest', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 2.5,
        tip: '肩甲骨を寄せて背もたれにつけたまま押す。グリップは胸の中ほどの高さに。',
        alt: 'ダンベル＋ベンチのダンベルプレスでもOK。' },
      { id: 'dbrow', n: 'ワンハンド・ダンベルロー', where: 'ダンベル＋ベンチ', focus: 'back', sets: 3, lo: 8, hi: 12, rest: '90秒', restSec: 90, inc: 2, side: '片側ずつ',
        tip: 'ベンチに手とひざをつき、ダンベルを腰の方へ引く。背中は平らに。',
        alt: '重さは片手で記録。アイソラテラル D.Y.ローでもOK。' },
      { id: 'hipthrust', n: 'ヒップスラスト', where: 'スミスマシン＋ベンチ', focus: 'glutes', sets: 3, lo: 8, hi: 12, rest: '2分', restSec: 120, inc: 5,
        tip: '肩甲骨の下をベンチに乗せ、お尻を締めて体が一直線になるまで上げる。',
        alt: 'バーにはタオルかパッドを。' },
      LATERAL,
      { id: 'reardelt', n: 'リア・デルトイド', where: 'ペクトラルフライ兼リアデルトイド', focus: 'rearDelt', sets: 2, lo: 12, hi: 20, rest: '60〜90秒', restSec: 75, inc: 2.5,
        tip: '肩の後ろを使って腕を横に開く。肩をすくめない。',
        alt: 'ケーブルマシンのリアレイズでもOK。' },
      ABS,
    ],
  },
};

/** 種目の一覧（同じ種目は1つにまとめる） */
export const ALL_EXERCISES: Exercise[] = [...new Map(Object.values(WORKOUTS).flatMap((w) => w.ex.map((e) => [e.id, e] as const))).values()];

/** 部位ごとの週の直接セット数と、鍛える日数 */
export function weeklySets() {
  const out = new Map<Muscle, { sets: number; days: number }>();
  for (const w of Object.values(WORKOUTS)) {
    const seen = new Set<Muscle>();
    for (const e of w.ex) {
      const cur = out.get(e.focus) ?? { sets: 0, days: 0 };
      cur.sets += e.sets;
      if (!seen.has(e.focus)) cur.days += 1;
      seen.add(e.focus);
      out.set(e.focus, cur);
    }
  }
  return (Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => ({ m, label: MUSCLE_LABEL[m], ...(out.get(m) ?? { sets: 0, days: 0 }) }));
}

/* ---------- 食事 ---------- */

export const RULES: { text: string; strong?: string }[] = [
  { text: 'ご飯は1食 150g（ジムの日の夕食は180g）', strong: '150g' },
  { text: '主菜は 手のひら1〜1.5枚分', strong: '手のひら1〜1.5枚分' },
  { text: '汁物・野菜 → 主菜 → ご飯 の順' },
  { text: 'おかわりは野菜・汁物・豆腐・納豆だけ' },
  { text: '飲み物は水・お茶・無糖' },
  { text: '夕食は寝る3時間前まで', strong: '3時間前' },
];

export const VISCERAL3: { t: string; d: string }[] = [
  { t: '甘い飲み物をやめる', d: 'ジュース・加糖コーヒー・エナジードリンク' },
  { t: '揚げ物は週2回まで', d: '量ではなく頻度で管理' },
  { t: 'お酒は週2回・2杯まで', d: '20歳以上' },
];

export const EXAMPLE_DAY: { when: string; what: string; kcal: number; p: number }[] = [
  { when: '朝', what: 'ご飯150g・卵2個・納豆・味噌汁', kcal: 530, p: 26 },
  { when: '昼', what: '学食の定食（焼き魚か生姜焼き）', kcal: 650, p: 35 },
  { when: '間食', what: 'プロテイン＋無糖ヨーグルト（16時ごろ）', kcal: 180, p: 30 },
  { when: '夕', what: 'ご飯150g・主菜・野菜・汁物', kcal: 650, p: 40 },
];

export const LUNCH: { ok: boolean; t: string }[] = [
  { ok: true, t: '焼き魚・生姜焼き・チキンの定食 / そば＋卵' },
  { ok: true, t: 'コンビニは おにぎり1〜2個＋サラダチキン・ゆで卵・焼き魚・ギリシャヨーグルトのどれか' },
  { ok: false, t: 'カツ丼・カレー大盛り・ラーメン＋ライス（週1回まで）' },
];

export const SNACKS: [string, number][] = [
  ['プロテイン', 120],
  ['無糖ギリシャヨーグルト', 60],
  ['ゆで卵2個', 160],
  ['アーモンド20粒', 120],
  ['バナナ', 90],
  ['焼き芋 小', 150],
  ['あたりめ', 80],
  ['高カカオチョコ3かけ', 80],
  ['冷凍ブルーベリー', 50],
  ['枝豆', 130],
];

/** 週の回数で管理するもの */
export const FOOD_LIMITS: { key: FoodKey; label: string; limit: number; note: string; adult?: boolean }[] = [
  { key: 'fried', label: '揚げ物', limit: 2, note: '週2回まで' },
  { key: 'alcohol', label: 'お酒', limit: 2, note: '週2回・2杯まで', adult: true },
  { key: 'treat', label: 'ごほうび食', limit: 1, note: '週1回・1食だけ' },
  { key: 'heavy', label: '△の昼ごはん', limit: 1, note: 'カツ丼・カレー大盛り・ラーメン＋ライス' },
];

/* ---------- ストレス食い対策 ---------- */

export const HALT: { id: string; label: string; advice: string }[] = [
  { id: 'hungry', label: 'お腹が空いている', advice: '本当に空腹なら我慢しなくてOK。お菓子ではなく、プロテイン・ゆで卵・ヨーグルトを選びましょう。' },
  { id: 'stress', label: 'イライラ・不安', advice: '4秒吸って6秒吐く呼吸を5回。そのあと外を5分歩くか、モヤモヤをメモに書き出す。' },
  { id: 'bored', label: '退屈・さみしい', advice: '部屋を出る、誰かに連絡する、好きな曲を1曲。手と頭を別のことに使うと衝動は弱まります。' },
  { id: 'tired', label: '疲れた・眠い', advice: 'いちばんの対策は早く寝ること。今日は間食1つだけにして布団に入りましょう。' },
];

export const SOS_STEPS = ['水かお茶を1杯飲む', '外を5分歩く・歯みがき・シャワー', 'それでも食べたいなら間食を1つだけお皿に'];
