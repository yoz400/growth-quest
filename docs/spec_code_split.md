# 仕様書：コード分割（STEP5 / P2）

作成: 2026-07-04 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親: [ux_ui_improvement_plan.md](ux_ui_improvement_plan.md) P2
⚠️ 着手条件: **STEP4（アセット軽量化）の完了・レビュー合格後**。app.js全体を動かす作業
なので、他のapp.js作業と絶対に同時進行しないこと。

---

## 1. 背景

`scripts/app.js` は **11,489行の1ファイル**。修正のたびに全体を読む必要があり、
編集事故（無関係な行を壊す）のリスクが増え続けている。`styles/app.css` も5,006行。

## 2. 方針: 「順序を保った機械的な切り分け」だけをやる

> リファクタリング（作り直し）は**しない**。ファイルを章ごとに切って並べるだけ。
> こうする理由: app.js はグローバル関数・変数が相互参照する設計なので、
> ES modules 化（import/export）は大工事になり事故率が高い。
> 通常の `<script>` を**現在の記述順どおりに複数並べる**なら、実行順・スコープが
> 今と完全に同じになり、動作は変わらない（top-level の let/const は
> script間で共有されるため）。

### 分割案（app.js → 8ファイル、現在の行順を維持）

| # | ファイル | 含むセクション（現app.jsの行順のまま） |
|---|---------|--------------------------------------|
| 1 | `scripts/core.js` | OverlayManager／DATA／SUGOROKU DATA／EQUIPMENT DATA（1〜2160行付近） |
| 2 | `scripts/progression.js` | SKILL TREE DATA／XP・LEVEL／PRAISE／世界樹の妖精（〜2641） |
| 3 | `scripts/quests.js` | DAILY QUEST／選択肢クエスト（〜3104） |
| 4 | `scripts/timer.js` | TIMER STATE／BREAK／告／ANIMATIONS／MODE TABS（〜4092） |
| 5 | `scripts/settings-genre.js` | SETTINGS／GENRE／QUOTES／BADGES（〜5433） |
| 6 | `scripts/calendar-review.js` | CALENDAR／手帳／WEEKLY REVIEW／診断／ジョハリ／グラフ（〜7309） |
| 7 | `scripts/features.js` | SKILL TREE／妖精ガイド／導きのしるべ／AVATAR（〜8817） |
| 8 | `scripts/boot.js` | イベントリスナー群／INIT／段階解放／はじめの一歩／タイムログ／装備UI／D&D／チュートリアル／召喚／使命／ログインボーナス（〜末尾） |

- セクションの境界は `// ═══` コメント行。**行の中身は1文字も変えない**
- `index.html` では上の順に `<script src="...?v=guild-N">` を8行並べる
  （`otomon.js` は既存のまま最後）

### CSSも同じ思想で（任意・余力があれば）

`app.css` → `base.css` / `home.css` / `overlays.css` / `responsive.css` の4分割。
`@media` ブロックの途中で切らないこと。

## 3. 進め方（事故防止が最優先）

1. **1コミット=1ファイル切り出し**。core.js を切ったら動作確認→コミット、を繰り返す
2. 各コミット後の確認: `node --check scripts/*.js`（全ファイル）＋ブラウザで
   起動→タイマーSTART→設定開閉→図鑑開閉 のスモークテスト
3. 全部終わったら `git diff` で「結合すると元と同一」を検証:
   `cat scripts/core.js scripts/progression.js ... > /tmp/joined.js` と
   分割前の app.js を diff（空行・区切りコメント以外の差分ゼロであること）
4. 最後に旧 `app.js` を削除する**独立コミット**

## 4. 受け入れ基準

- [x] 全機能のスモークテスト合格（起動/タイマー/設定/図鑑/召喚/カレンダー）
- [x] 結合diff検証で中身の差分ゼロ（※クロの修正1行を除く）
- [x] コンソールエラーゼロ（特に ReferenceError/TDZ エラー）
- [x] `?v=guild-N` の一括更新がしやすいよう、8行のscriptタグは連続して並んでいる
- [x] 旧 app.js の削除が独立コミットになっている

> ✅ **レビュー完了（2026-07-05 クロ）**：Codexの分割（8ファイル・結合diff一致）は正確。
> ただし起動時に ReferenceError が出て停止 → **原因は本仕様書の設計見落とし**：
> 1ファイル内では関数宣言の巻き上げ（hoisting）がファイル全体に効くが、
> ファイルを分けると「前のファイルの読み込み時コード」から「後のファイルの関数」は
> 見えない。settings-genre.js:43 の `addEventListener('click', testCloudNotify)` が
> calendar-review.js 定義の関数を直接参照していて即死 → settings-genre.js の残り全体が
> 中断 → `genreQuickAdd` が TDZ のまま → 連鎖エラーで起動画面フリーズ。
> **修正（クロ、1行）**: 参照をアロー関数で包んで遅延化
> `addEventListener('click', () => testCloudNotify())`（?v=guild-59）。
> 修正後、起動/タイマー/設定/ジャンル簡易追加/図鑑のスモークテスト合格・エラーゼロ。
> Codexが仕様§5どおり「作り変えずに停止・報告」してくれたことで原因特定が容易だった。
> 教訓: 分割系の仕様書には「ファイルをまたぐ読み込み時参照（コールバック直接渡し・
> 即時呼び出し）は遅延参照に書き換えてよい」という例外ルールを最初から入れること。
> **STEP5完了。**

## 5. Codexへの依頼文（コピペ用）

```text
docs/spec_code_split.md に従って実装してください。
- STEP4が完了済みであることを確認してから着手。
- 1コミット=1ファイル切り出し。行の中身は1文字も変更禁止（移動のみ）。
- §3の結合diff検証の結果と、スモークテスト結果を報告してください。
- 期待どおりに動かない箇所があったら、自分で作り変えずに報告して止まってください。
```

実装後のレビューはクロ（Fable 5）が行う。
