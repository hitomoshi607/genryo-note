# 減量ノート — 開発メモ

仕様は SPEC.md（個人情報を含むためリポジトリには入れず、手元にだけ置く）。README.md に構成と公開手順。

## 守ること

- SPEC.md「3. 計算ロジック」の式と、初回測定値（src/data/seed.ts）は実測に基づくので変えない。
  変更したら `npm test` で src/lib/calc.test.ts の初期値が通ることを確認する。
- 筋トレメニューは src/data/plan.ts の EQUIPMENT（いつものジムの設備）にあるマシンだけを使う。
- 画面には数字とやることだけを置き、説明文は「?」（src/help.tsx）の中に入れる。タブは5つまで。
- 保存データの形は試作版（localStorage キー genryo-note-v2）と互換。項目を足すときは src/lib/schema.ts の normalize も更新する。
- 医療的な判断はしない。
- 写真からのカロリー推定（src/lib/ai.ts）の API キーは localStorage の `genryo-note-ai` にだけ置く。
  記録データ（genryo-note-v2）・バックアップ JSON・コード・リポジトリに入れない。テストは偽の fetch で行い、実際の API は呼ばない。

## コマンド

- `npm run dev` / `npm test` / `npm run build`（型チェック込み）
- Windows の Git Bash で `BASE_PATH=/xxx/` を渡すときは `MSYS_NO_PATHCONV=1` を付ける
