# CLAUDE.md

このファイルは、Claude Code がこのプロジェクトで作業するときの案内です。
プロジェクトの全体設計と「新機能追加の掟」は **docs/architecture_review.md** が正典です。
実装担当Codex向けの案内は `AGENTS.md`（内容はこのファイルと整合させて維持する）。

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
└─ docs/                 設計書・仕様書（spec_*.md は Codex への発注書）
```

## 開発の掟（違反すると実際に事故る。詳細は docs/architecture_review.md §4）

1. **CSS/JSを編集したら `bash tools/bump_version.sh`**（?v=guild-N を一括+1）。
   忘れると「直したのに直ってない」現象になる（過去に何度もハマった）
2. **ファイルをまたぐ読み込み時参照は禁止**。コールバックは `() => fn()` で包む。
   `typeof` はTDZ（宣言前のlet）に無力。起動フリーズ事故2回の原因
3. モーダルは OverlayManager（core.js）の DEFS 登録 + Overlay.open/close のみ
4. localStorage 新キーは gq_接頭辞 + architecture_review.md §6 の台帳へ追記 +
   exportAllData() に含める
5. データを変えたら該当する render系関数の呼び忘れに注意（画面と実データのズレが最頻出バグ）

## 検証方法（重要な環境の癖）

- **プレビュー**: `preview_start` のサーバーはサンドボックス制約でファイルを読めない（全404）。
  Bashで `python3 -m http.server 8123` を run_in_background で立て、
  preview_eval で `location.href='http://localhost:8123/index.html'` に向ける
- **新規ユーザー検証**: preview上で `localStorage.clear()` → reload（実データはヨージの
  各端末にあるので消えない）
- 構文チェック: node未インストール。ブラウザ実行とコンソールエラー確認で代替
- 本番確認: `curl -s https://yoz400.github.io/growth-quest/ | grep v=guild-` でデプロイ確認
- MCPは現状構成（Claude Preview / claude-in-chrome）で十分。追加不要と判断済み

## 分担体制

- **クロ（Claude）**: 設計・仕様書作成（docs/spec_*.md）・レビュー・小さな修正
- **Codex**: 仕様書ベースの実装量産。各spec末尾の「依頼文」をヨージがコピペして発注
- 仕様書には必ず「受け入れ基準」「テスト手順」「迷ったら止まって報告」を書く。
  レビュー合格時は受け入れ基準にチェックを入れ、レビュー記録を仕様書末尾に追記する
- Codexと同時にコードを触らない。ドキュメント作業は常に安全

## コラボレーションのルール

- ユーザーの名前は**ヨージ**。Claude / Codex のことは「クロ」と呼んでいる
- 説明はすべて**初心者向け**に。専門用語は**必ず意味を説明**する
- 重要な概念は**図解（テキスト図・ASCII図）**で視覚的に伝える

## Git運用ルール

- 機能の実装・修正が完了したタイミングで自動的に git add → commit → push
- コミットメッセージは日本語で変更内容を簡潔に
- push = 本番デプロイであることを意識する（壊れた状態でpushしない。
  ブラウザ検証してからpush）
- Codexが並行作業中の可能性があるときは `git status` を確認し、
  自分の変更だけをパス指定でコミットする
