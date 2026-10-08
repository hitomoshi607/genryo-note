# 減量ノート

筋肉を守ったまま脂肪だけを落として 69kg 台に到達するための、iPhone で毎日使う記録アプリ（PWA）。
詳しい仕様書は個人情報を含むため、リポジトリには入れていません。

- 記録は端末の中（localStorage / 写真は IndexedDB）だけに保存。サーバーには何も送らない
- ホーム画面に追加するとオフラインでも動く
- 技術: React 19 + TypeScript + Vite + vite-plugin-pwa、テストは Vitest

## 使い方（開発）

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 計算ロジックのテスト
npm run build      # dist/ に本番ビルド
```

同じ Wi-Fi の iPhone で見た目を確かめるときは `npm run dev:phone`（表示される Network の URL を開く）。
ただし HTTP なのでオフライン機能（Service Worker）は動きません。

## 公開（GitHub Pages）

1. GitHub でリポジトリを作る（例: `genryo-note`）
2. リポジトリの Settings → Pages → Source を **GitHub Actions** にする
3. `main` に push すると `.github/workflows/deploy.yml` がテスト → ビルド → 公開する
4. iPhone の Safari で `https://<ユーザー名>.github.io/genryo-note/` を開き、共有 →「ホーム画面に追加」

注意: 公開されたページは URL を知っていれば誰でも開けます（記録データは各端末の中なので見えません）。
初回測定の数値（`src/data/seed.ts`）はアプリのコードに含まれるので、公開リポジトリにすると誰でも読めます。
気になる場合はリポジトリを Private に（無料プランで Private から Pages を出すには GitHub Pro。学生は GitHub Student Developer Pack で無料）。

## 無料で食事を記録する

- **よく食べる食事**: 食事タブ・今日タブのボタンを1タップで記録（直後は取り消せる）。食事タブの「＋ 追加」か、記録画面の「よく食べる食事に登録」で追加
- **Claude のチャット**（iPhone ではこれが写真から推定する方法）: 「食事を記録」→「① Claude 用にコピー」→ Claude アプリの新しいチャットに貼り付けて写真を添付して送る →
  返事をコピー →「② 結果を貼り付け」。claude.ai の利用枠を使うので API 料金なし。送る文は `chatPrompt`（src/lib/ai.ts）、返事の読み取りは `parsePastedMeal`
- **claude.ai の推定ページ**（[減量ノート 食事推定](https://claude.ai/artifact/4er4eDHpp4cPCuVkHaUv5K)、持ち主だけが開ける非公開ページ）:
  写真を推定 →「減量ノート用にコピー」→「② 結果を貼り付け」。iPhone の Claude アプリなど、写真を送れない画面がある（メモだけなら推定できる）
- ページのソースは `companion/meal-estimator.html`。直したら claude.ai の同じ URL に公開し直す

## 写真からカロリー推定（Claude API・有料）

食事タブ／今日タブの「食事を記録」から、写真（とメモ）で品目ごとの kcal・PFC を推定できます。

1. [Anthropic Console](https://console.anthropic.com/) でアカウントを作り、クレジットを入れる（claude.ai の有料プランとは別の従量課金）
2. Limits で月の利用上限を設定しておく
3. API Keys でキーを作り、アプリの 設定 →「写真からカロリー推定」に貼り付けて「保存して確認」

- キーは端末の localStorage（`genryo-note-ai`）にだけ保存され、記録データ・バックアップ・リポジトリには入りません
- 既定モデルは Claude Opus 5.5（1枚 約5円が目安）。設定で Sonnet 5.5 / Haiku 5.5 に変えられます
- 推定のとき、写真とメモは Anthropic に送信されます
- 実装は `src/lib/ai.ts`（テストは `src/lib/ai.test.ts`。通信は偽物に差し替えて、API を呼ばずに確認しています）

## 試作版からの引き継ぎ

設定 → データ →「読み込む」で、試作版（localStorage キー `genryo-note-v2`）と同じ形の JSON を読み込めます。
「統合」は同じ日付なら読み込んだ側を優先、「置き換え」は今の記録を消して読み込んだ内容だけにします。
Safari で開いたページとホーム画面のアプリは保存場所が別なので、**ホーム画面のアプリの中で**読み込んでください。

## 構成

```
src/
  data/seed.ts        初回測定（2026-09-27 TANITA）と初期設定
  data/plan.ts        曜日の種別・チェック項目・筋トレメニュー・食事の内容
  lib/calc.ts         目標カロリー・PFC・段階目標・7日平均・到達予想・警告・ディロード
  lib/progression.ts  筋トレの次回の提案
  lib/schema.ts       保存データの型・検証・インポート
  lib/store.ts        localStorage への保存
  help.tsx            「?」の中の説明文
  views/              5つのタブ（今日・からだ・筋トレ・食事・習慣）
  components/         グラフ・シート・レストタイマーなど
```

計算式を変えるときは `src/lib/calc.test.ts` の初期値（2050 kcal / P130 / F55 / C260、段階目標 76.0 / 73.3 / 69.8 / 69.0）も確認すること。

## アイコン

`public/icon.svg` を編集して `npm run icons` で PNG を作り直す。
