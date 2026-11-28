# 減量ノート — 開発メモ

仕様は SPEC.md（個人情報を含むためリポジトリには入れず、手元にだけ置く）。README.md に構成と公開手順。

## 守ること

- 記録するのは体重（体組成を含む）・睡眠・ジムの3つ。黒ベースで、片手で速く入れられることを優先する。
- 目標（開始 2026-11-20・82kg、毎月 −2kg、70kg）と計画線の計算は src/lib/weight.ts。
  変えたら `npm test` で src/lib/weight.test.ts の区切り（82 / 80 / 78 / 76 / 74 / 72 / 70）を確認する。
- 体組成（TANITA）の計算は src/lib/comp.ts。最初の記録は 2026-11-28（src/data/plan.ts の FIRST_COMP）。
  脂肪量・除脂肪量は体重と体脂肪率から出す（src/lib/comp.test.ts で体組成計の表示と合うことを確認）。
- 筋トレメニューは src/data/plan.ts の EQUIPMENT（いつものジムの設備）にあるものだけを使う。
  どの日も4種目で、脚を毎回入れ、ベンチプレスかデッドリフトのどちらかを入れる（src/data/plan.test.ts で確認）。
- 画面には数字とやることだけを置き、説明文は「?」（src/help.tsx）の中に入れる。タブは4つ。
- 保存先は localStorage の `genryo-note-v3`。項目を足すときは src/lib/schema.ts の normalize も更新する。
- 医療的な判断はしない。

## コマンド

- `npm run dev` / `npm test` / `npm run build`（型チェック込み）
- Windows の Git Bash で `BASE_PATH=/xxx/` を渡すときは `MSYS_NO_PATHCONV=1` を付ける
