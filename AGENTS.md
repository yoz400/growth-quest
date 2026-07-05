# AGENTS.md

このファイルは、Codex がこのプロジェクトで作業するときの案内です。
全体設計と「新機能追加の掟」は **docs/architecture_review.md** が正典です。

## プロジェクトの現状

**Growth Quest** — 学習をゲームのように続けるためのブラウザアプリ（依存ゼロ・ビルド不要）。
**本番公開中**: https://yoz400.github.io/growth-quest/ （mainへpush→1〜2分で自動デプロイ）

```text
claude-practice/
├─ index.html            画面の骨組み（全モーダル含む）
├─ styles/app.css        CSS（?v=guild-N でキャッシュ制御）
├─ scripts/              JS 9本を依存順に読み込む
│   core → progression → quests → timer → settings-genre
│   → calendar-review → features → boot → otomon
├─ assets/               画像（WebP。PWAアイコンのみPNG維持）
├─ tools/bump_version.sh キャッシュ用バージョン一括+1
└─ docs/                 設計書・仕様書（spec_*.md が発注書）
```

## 作業の進め方

- 実装は `docs/spec_*.md` の仕様書に従う。仕様書に無い判断は**勝手にせず、
  リストにして報告して止まる**（この方針で過去に大きな事故を2回防いだ）
- コミットは仕様書の指示どおりに分割。メッセージは英語でも日本語でも可
- 期待どおり動かない場合: 作り変えずに、エラー全文・該当ファイル・行番号を報告

## 開発の掟（違反すると実際に事故る）

1. **CSS/JSを編集したら `bash tools/bump_version.sh`**（?v=guild-N を一括+1）
2. **ファイルをまたぐ「読み込み時参照」は禁止**。コールバックは `() => fn()` で包む。
   前のファイルから後のファイルの関数・変数は、読み込み時点では見えない
   （function宣言の巻き上げはファイル内でしか効かない。typeofもTDZには無力）
3. モーダルは OverlayManager（core.js）の DEFS 登録 + Overlay.open/close のみ
4. localStorage 新キーは gq_接頭辞 + architecture_review.md §6 の台帳へ追記 +
   exportAllData() に含める
5. 削除系の作業前は `git status` で **git管理外ファイルの巻き込み**を確認する

## 動作確認

```sh
python3 -m http.server 8123   # プロジェクト直下で
```
ブラウザで `http://localhost:8123` を開く。
スモークテスト: 起動 → タイマーSTART/STOP → 設定開閉 → 図鑑 → カレンダー →
（localStorage.clear()して）召喚。コンソールエラーゼロを確認。
node は未インストール（構文チェックは jsc かブラウザで）。

## 初心者向けの用語

- **localStorage**: ブラウザの中にデータを保存する仕組み。サーバーなしで使える
- **キャッシュ**: ブラウザが前回のファイルを使い回す仕組み。?v=guild-N の数字を
  上げることで「新しいファイルを取り直して」と伝える
- **TDZ**: let/const で宣言した変数は、宣言行より前で触るとエラーになる期間があること

## コラボレーションのルール

- ユーザーの名前はヨージ。Codex のことは「クロ」と呼んでいる
- 説明はすべて**初心者向け**に。専門用語は**必ず意味を説明**する
- 重要な概念は**図解（テキスト図・ASCII図）**で視覚的に伝える
