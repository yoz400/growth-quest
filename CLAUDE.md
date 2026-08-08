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
   `typeof` はTDZ（宣言前のlet）に無力。**起動フリーズ事故3回の原因**
   → **JSを編集したら `python3 tools/check_load_order.py` を実行**（数秒で終わる）。
     「読み込み時に、後から読まれるファイルの関数を裸で呼んでいないか」を機械的に調べる。
     3回とも目視では見つけられなかった（guild-141 は本番が起動不能になった）
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
  （ロジック検証は jsc が使える:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`）
- **読み込み順の確認**: `python3 tools/check_load_order.py`。
  ⚠️ **プレビュー検証だけでは足りない**。guild-141 の起動フリーズは
  「ナッジコースを選んでいる人」にしか出ず、`localStorage.clear()` から始める
  プレビューでは一度も再現しなかった。**条件付きで走る経路は、条件を作らないと踏めない**
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

## 作業開始プロトコル

1. **`docs/AI/CURRENT.md` を読む**（更新日が3日以上前なら、実装前にヨージへ確認）
2. `git status` を確認。未コミットがあれば着手前に報告
3. 受け入れ基準の無い依頼は、作業前に確認する

以下は**必要になった段階でのみ**読む（全体は物理的に読めない。コード約333k＋docs約184kトークン）:

```text
docs/architecture_review.md  設計判断が必要なとき（正典）
docs/AI/DECISIONS.md         既存仕様の理由が必要なとき
docs/AI/FAILURES.md          同種の作業に入る前（過去の事故歴）
docs/spec_*.md               対象の仕様書のみ
コード                        変更対象とその依存のみ
```

## 実装を自分でやるか、Codexへ渡すか

仕様書を書いて渡すのは固定費がかかる。実装が小さいほど赤字になる。

- 1ファイル・50行以下 → **その場で直す**（仕様書を書かない）
- 複数ファイル / 150行超 / 新機能 / 繰り返し作業 → **仕様書を書いて Codex へ**

コードを必要としない仕事（企画・優先順位・文言・仕様の目的妥当性チェック）は
**ChatGPT へ回す**。ここで始めると開始時点で1〜3万トークンが乗るため損。

## レビューは差分のみ

`git diff` と仕様書の受け入れ基準だけで判定する。
**変更ファイル全体や周辺コードを読み直さない**（約17倍のコスト。精度は上がらない）。
読み込み順・依存の問題は差分では見えないので `tools/check_load_order.py` に任せる。

## 事前確認が必要な変更

新規ファイル3つ以上 / localStorage の新キー・意味変更 / `scripts/` の読み込み順変更 /
削除を伴う変更 / 依頼にない機能追加 / 30分以上かかる作業

## 完了報告

```md
## Completed     受け入れ基準ごとに、満たした根拠を1行
## Remaining     残作業（無ければ「なし」）
## Problems      発生した問題・想定外（無ければ「なし」）
## Decisions     作業中に判断したこと
## Next Action   次にやること 1〜3件
## Diff          git diff --stat の出力
```

作業完了時、`docs/AI/` を自分で更新する（記録は作業の一部。実装だけ終えて返すのは途中で手を止めているのと同じ）:

- `CURRENT.md`（**60行以内**に保つ。書き足すのではなく減らす）
- `DECISIONS.md`（重要な判断があれば追記）
- `FAILURES.md`（事故・つまずきがあれば追記。掟が増えたなら必ず残す）
