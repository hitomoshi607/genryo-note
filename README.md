# 減量ノート

体重（体組成を含む）・睡眠・ジム（筋トレと有酸素）を毎日記録する、iPhone 用の記録アプリ（PWA）。黒ベースで、片手で速く入れられることを優先しています。
詳しい仕様書は個人情報を含むため、リポジトリには入れていません。

- 記録は端末の中（localStorage の `genryo-note-v3`）だけに保存。サーバーには何も送らない
- ホーム画面に追加するとオフラインでも動く
- 技術: React 19 + TypeScript + Vite + vite-plugin-pwa、テストは Vitest

## 使い方（開発）

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 計算ロジックとメニューのテスト
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
開始時の体重・目標・最初の体組成（`src/data/plan.ts`）はアプリのコードに含まれるので、公開リポジトリにすると誰でも読めます。

## 前の版から

2026-11 に体重・睡眠・ジムだけの版に作り直し、記録は新しく始めました（保存先のキーを `genryo-note-v2` → `genryo-note-v3` に変更）。
前の版の記録が端末に残っていると、設定に「前の版の記録」が出て、書き出し・端末からの削除ができます（写真推定の API キーと写真も消えます）。

## 構成

```
src/
  data/plan.ts        目標の初期値・ジムの設備・筋トレメニュー・有酸素の初期値
  lib/weight.ts       7日平均・毎月の計画線・目標日
  lib/comp.ts         体組成：脂肪量・除脂肪量・前回との差・目標時の体脂肪率
  lib/sleep.ts        睡眠時間・7日平均・寝る時刻のばらつき
  lib/gym.ts          曜日の予定・ベンチの日とデッドの日の交互・軽めの週
  lib/progression.ts  次回の重さの提案
  lib/schema.ts       保存データの型・検証
  lib/store.ts        localStorage への保存・前の版のデータ
  help.tsx            「?」の中の説明文
  views/              4つのタブ（今日・体重・睡眠・ジム）
  components/         入力・グラフ・シート・休憩タイマー
```

## アイコン

`public/icon.svg` を編集して `npm run icons` で PNG を作り直す。
