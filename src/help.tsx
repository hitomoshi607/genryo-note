// 「?」ボタンの中身。画面には数字とやることだけを置き、根拠や説明はここにしまう
import type { ReactNode } from 'react';
import { ALL_EXERCISES, pace, SLEEP_TARGET_H, WORKOUTS, type Part } from './data/plan';
import { jMD } from './lib/date';
import { f1, kg } from './lib/format';
import { deloadWindow } from './lib/gym';
import { mmss } from './lib/timer';
import type { AppData } from './lib/schema';
import { checkpoint, goalDate, monthsToGoal, weightStatus } from './lib/weight';

export interface Help {
  title: string;
  body: ReactNode;
}

const Kv = ({ rows }: { rows: [ReactNode, ReactNode][] }) => (
  <dl className="kv">
    {rows.map(([k, v], i) => (
      <div key={i}>
        <dt>{k}</dt>
        <dd className="n">{v}</dd>
      </div>
    ))}
  </dl>
);

const PART_LABEL: Record<Part, string> = { legs: '脚', hinge: 'もも裏・お尻・背中', push: '胸・肩・腕（押す）', pull: '背中・腕（引く）', core: '腹' };

/** 傾斜ウォーキングの消費の目安（ACSM の歩行の式）。kcal/分 */
export function walkKcalPerMin(speedKmh: number, inclinePct: number, weightKg: number) {
  const v = (speedKmh * 1000) / 60; // m/分
  const vo2 = 0.1 * v + 1.8 * v * (inclinePct / 100) + 3.5; // mL/kg/分
  return (vo2 * weightKg * 5) / 1000;
}

export function getHelp(key: string, d: AppData, today: string): Help | null {
  const s = d.settings;

  if (key.startsWith('ex:')) {
    const ex = ALL_EXERCISES.find((e) => e.id === key.slice(3));
    if (!ex) return null;
    return {
      title: ex.n,
      body: (
        <>
          <Kv
            rows={[
              ['回数', `${ex.sets}セット × ${ex.lo}〜${ex.hi}回`],
              ['休憩', mmss(ex.restSec)],
              ['設備', ex.where.join('・')],
              ['重さの上げ方', `全セットで${ex.hi}回できたら次回 +${kg(ex.inc)}kg`],
            ]}
          />
          <p>{ex.tip}</p>
          {ex.warm && (
            <p>
              <b>ウォームアップ</b>：{ex.warm}
            </p>
          )}
          <p>
            <b>空いていないとき</b>：{ex.alt.n}（{ex.alt.where.join('・')}）。同じ回数・セットで行い、記録はこの種目に入れて構いません。
          </p>
          <p className="muted">どのセットも「あと1〜2回できる」ところで止めます。フォームが崩れる重さは使いません。</p>
        </>
      ),
    };
  }

  switch (key) {
    case 'today':
      return {
        title: '今日の画面',
        body: (
          <ul>
            <li>朝：体重を量って記録 → 昨夜の寝た時刻・起きた時刻を記録。前回の値が最初から入っているので、±で合わせて「記録」だけで済みます。</li>
            <li>ジムの日：下のカードに今日のメニューが出ます。「ジムの記録を開く」で重さと回数を入れます。</li>
            <li>有酸素の日：終わったら「完了」を押します。</li>
            <li>曜日ごとの予定は、右上の設定で変えられます。</li>
          </ul>
        ),
      };

    case 'weight': {
      const st = weightStatus(d, today);
      const n = monthsToGoal(s);
      return {
        title: '体重の見方',
        body: (
          <>
            <ul>
              <li>毎朝、トイレのあと・何か食べたり飲んだりする前に量ります。</li>
              <li>体重は水分や食事で1日に1kgほど上下するので、その日の値ではなく7日平均で見ます。</li>
              <li>
                計画は {jMD(s.startDate)} の {kg(s.startWeight)}kg から毎月 −{kg(s.perMonth)}kg。{n}か月後の {jMD(goalDate(s))} に {kg(s.goalWeight)}kg です。
                月の区切りの間は日数でならしています。
              </li>
              <li>「計画との差」がマイナスなら計画より先に進んでいます。</li>
              <li>
                1か月 −{kg(s.perMonth)}kg は1週間で約 {f1((s.perMonth * 12) / 52)}kg（体重の約{f1(((s.perMonth * 12) / 52 / s.startWeight) * 100)}%）です。一般的な減量の目安（1週間に体重の0.5〜1%）の範囲です。
              </li>
            </ul>
            <Kv rows={Array.from({ length: n + 1 }, (_, i) => checkpoint(s, i)).map((c, i) => [i === 0 ? `開始 ${jMD(c.d)}` : `${i}か月目 ${jMD(c.d)}`, `${f1(c.w)}kg`])} />
            {st && <p className="muted n">いまの7日平均 {f1(st.now)}kg（{jMD(st.last.d)}）</p>}
          </>
        ),
      };
    }

    case 'month':
      return {
        title: '1か月ごとの目標',
        body: (
          <ul>
            <li>開始日から1か月ずつ区切り、それぞれの月で −{kg(s.perMonth)}kg を目指します。</li>
            <li>今月の変化は「区切りの日の7日平均」から「いまの7日平均」までです。区切りの日に記録がないときは計画の値から数えます。</li>
            <li>1か月で届かなくても、次の月の計画はそのままです。7日平均が計画線に近づいていれば順調です。</li>
          </ul>
        ),
      };

    case 'sleep':
      return {
        title: '睡眠の見方',
        body: (
          <ul>
            <li>目安は{SLEEP_TARGET_H}時間以上。寝不足の日は食欲が増えやすく、減量中は筋肉も落ちやすくなることが研究で示されています。</li>
            <li>寝る時刻をそろえるほど眠りが安定します。「寝る時刻の幅」（直近7日でいちばん早い日と遅い日の差）は1時間以内が目安です。</li>
            <li>記録は起きた日の日付で、寝た時刻と起きた時刻を入れます。日付をまたいでも睡眠時間は自動で計算します。</li>
            <li>前回の時刻が最初から入っているので、同じなら「記録」を押すだけです。</li>
          </ul>
        ),
      };

    case 'gym': {
      const dl = deloadWindow(s.startDate, today);
      // 1種目3セット × 2週で各メニュー3回 → 1週あたり 1.5回
      const perWeek = new Map<Part, number>();
      for (const w of Object.values(WORKOUTS)) for (const ex of w.ex) perWeek.set(ex.part, (perWeek.get(ex.part) ?? 0) + ex.sets * 1.5);
      return {
        title: 'メニューの考え方',
        body: (
          <>
            <ul>
              <li>
                週3回の筋トレの日は、全身を「{WORKOUTS.A.name}」と「{WORKOUTS.B.name}」の交互で行います。前回の反対が自動で選ばれます。
              </li>
              <li>どちらの日も脚の種目が入り、押す・引くの両方をそろえた4種目です。1種目3セット・10分ほどで約40分、そのあと有酸素{s.cardio.liftMin}分。</li>
              <li>
                減量中は筋肉が落ちやすいので、<b>重さを保つ・少しずつ上げる</b>ことがいちばん大事です。そのためバーベルの大きな種目を最初に置いています。
              </li>
              <li>ベンチプレス・スクワット・デッドリフトは、パワーラックのセーフティバーを必ず使います。</li>
            </ul>
            <p>
              <b>重さの上げ方</b>
            </p>
            <ul>
              <li>全セットで回数の上限に届いたら、次回は重さを上げます（画面に「→ ○kg に上げる」と出ます）。</li>
              <li>下限に届かないセットがあったら同じ重さのまま。2回続けて届かなければ1段階下げます。</li>
              <li>
                8週ごとに1週間は軽めの週（重さはいつもの7割）にして、疲れを抜きます。
                {dl.active ? `今週（${jMD(dl.from)}〜${jMD(dl.to)}）が軽めの週です。` : `次は ${jMD(dl.from)}〜${jMD(dl.to)} です。`}
              </li>
            </ul>
            <p>
              <b>1週間あたりのセット数（目安）</b>
            </p>
            <Kv rows={[...perWeek].map(([p, n]) => [PART_LABEL[p], `${f1(n)}セット`])} />
            <p className="muted">使う設備は、いつものジムにあるものだけです。痛みがあるときは、その種目を休んでください。</p>
          </>
        ),
      };
    }

    case 'cardio': {
      const c = s.cardio;
      const st = weightStatus(d, today);
      const w = st?.now ?? s.startWeight;
      const per = walkKcalPerMin(c.speed, c.incline, w);
      return {
        title: '傾斜ウォーキング',
        body: (
          <>
            <Kv
              rows={[
                ['傾斜・速さ', `${kg(c.incline)}%・時速${kg(c.speed)}km（1km ${pace(c.speed)}）`],
                ['有酸素の日', `${c.cardioMin}分・${((c.speed * c.cardioMin) / 60).toFixed(1)}km・約${Math.round((per * c.cardioMin) / 10) * 10}kcal`],
                ['筋トレのあと', `${c.liftMin}分・${((c.speed * c.liftMin) / 60).toFixed(1)}km・約${Math.round((per * c.liftMin) / 10) * 10}kcal`],
              ]}
            />
            <ul>
              <li>手すりにつかまると負荷が大きく下がります。腕を振って歩きます。</li>
              <li>筋トレの日は、重さを出せるように筋トレを先にして、有酸素はあとにします。</li>
              <li>消費の目安は体重 {f1(w)}kg で計算しています（ACSM の歩行の式。実際は人によって前後します）。</li>
              <li>傾斜・速さ・時間は設定で変えられます。</li>
            </ul>
          </>
        ),
      };
    }

    case 'rest':
      return {
        title: '休憩タイマー',
        body: (
          <ul>
            <li>種目ごとの休憩時間で始まります。終わると音と振動で知らせます（マナーモードでは音が鳴りません）。</li>
            <li>タイマーが動いている間は画面が消えにくくなります。</li>
            <li>ほかのアプリに切り替えても、戻ったときに正しい残り時間になります。</li>
          </ul>
        ),
      };
  }
  return null;
}
