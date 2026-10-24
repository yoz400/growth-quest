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
├─ tools/bump_version.sh キャッシュ用バージョン一括+1（version.json も同時更新）
└─ docs/                 設計書・仕様書（spec_*.md は Codex への発注書）
```

## 開発の掟（違反すると実際に事故る。詳細は docs/architecture_review.md §4）

1. **CSS/JSを編集したら `bash tools/bump_version.sh`**（?v=guild-N と version.json を一括更新）。
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
- MCPは Claude Preview / claude-in-chrome。**Codexは MCP では繋がらない**ので Bash から呼ぶ
  （下の「Codex / チャッピー連携ルール」参照）

## 分担体制

- **クロ（Claude）**: 設計・仕様書作成（docs/spec_*.md）・レビュー・小さな修正
- **Codex**: 仕様書ベースの実装量産。各spec末尾の「依頼文」を、クロが `codex exec` で直接発注してよい
  （ヨージがコピペしてもよい。下の「Codex / チャッピー連携ルール」参照）
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

## Codex / チャッピー連携ルール（Bashから呼ぶ）

**⚠️ CodexはMCPでは繋がらない。`mcp__codex__*` と `chappy` サブエージェントは使えない。**
`.mcp.json` は `codex mcp-server` を指しているが、いまの codex-cli 0.163.0 にその命令は無い
（`mcp` は「Codexが外部MCPを使う」ための命令で、逆向き。2026-10-23 に2か所のインストールで確認）。
**セッション開始時に毎回「codex: CONNECTION_CLOSED」と出るが、これは既知で無視してよい。**

呼ぶときは Bash から `codex exec` を使う。ChatGPTでログイン済み
（`codex login status` → `Logged in using ChatGPT`）。これまでヨージがコピペしていた
発注・相談を、クロが直接行ってよい。

### ⚠️ 必ず **アプリ同梱のCLI** をフルパスで呼ぶこと

```bash
/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
```

**`codex` と素で打たない**（PATH が通っているのは `~/.local/bin/codex` のほう）。
CLIが2つ入っていて、`~/.local/bin` 側には実行ホスト `codex-code-mode-host` が
**同梱されていない**。そちらで発注すると、こうなる:

```text
failed to spawn code-mode host ~/.local/bin/codex-code-mode-host: No such file or directory
```

このとき Codex は**ファイルを1つも読めず**、「実装できません」とだけ返す。
テキストを返すだけの相談は通ってしまうので、**壊れていることに気づきにくい**
（2026-10-24 に緊急依頼の発注で実際に踏んだ。FAILURES.md 参照）。
`--disable code_mode` でも回避できない。

### 相談モード（チャッピー）— `-s read-only`

```bash
/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex exec --skip-git-repo-check -s read-only "相談内容"
```

次のときは、ヨージに確認せず自分から相談してよい:
- 同じバグの修正に2回失敗したとき
- localStorage のキー・意味を変える前
- 3ファイル以上にまたがる変更の後のレビュー
- 設計の選択肢が2つ以上あって迷ったとき

※企画・優先順位・文言など「コード不要の相談」は従来どおりヨージ経由で ChatGPT へ回す

### 実行モード（Codex）— `-s workspace-write`

```bash
/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex exec -C /Users/hapiyopi/Desktop/claude-practice -s workspace-write "依頼文"
```

- 仕様書（docs/spec_*.md）末尾の「依頼文」を、クロが直接渡して発注してよい
- 依頼文には必ず「git commit / push はしない。終わったら変更ファイルと受け入れ基準の結果を報告」を加える
- `-s danger-full-access` と `--dangerously-bypass-approvals-and-sandbox` は使わない
- Codex の作業中、クロは同じファイルを触らない
- 終わったら従来どおり差分だけでレビュー → 合格ならクロが commit / push

### 使えるオプション（実測で確認済み）

| オプション | 意味 |
|---|---|
| `-s read-only` / `workspace-write` / `danger-full-access` | 書き込みをどこまで許すか |
| `-C <フォルダ>` | 作業フォルダを指定（`--cd` と同じ） |
| `--skip-git-repo-check` | gitリポジトリ外でも動かす |

### 最終判断
- チャッピーとクロの意見が割れたら、両案と理由をヨージに短く報告して判断を仰ぐ
- 「努力の記録を消さない」が最優先。保存データが消える・壊れる可能性がある変更は、どちらが提案してもヨージの確認を取る
- Codex を使ったときは、完了報告の Decisions に「相談/発注した内容と結論」を1〜2行で書く
