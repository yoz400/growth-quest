# Growth Quest 全体設計レビュー & 「100機能に耐える」ための設計指針

作成: 2026-07-05 ／ 著者: クロ（Fable 5）
目的: 今後どのAI（Codex / 別モデルのClaude）や未来のヨージが読んでも、
**このアプリを壊さずに育てられる**ための、現状分析と掟をまとめる。

---

## 1. 現在のアーキテクチャ（俯瞰図）

```text
┌──────────────────────── ブラウザ ────────────────────────┐
│  index.html（画面の骨組み・全モーダルのHTML・940行）        │
│  styles/app.css（5,010行・?v=guild-Nでキャッシュ制御）      │
│                                                            │
│  scripts/ ── 依存順に読み込む9本のJS（計約14,400行）        │
│   1 core.js       OverlayManager・データ定義・装備/すごろく │
│   2 progression.js XP/レベル・褒めログ・世界樹の妖精        │
│   3 quests.js      今日のクエスト・選択肢クエスト           │
│   4 timer.js       タイマー・アニメ・セッション記録         │
│   5 settings-genre.js 設定・ジャンル・名言・バッジ          │
│   6 calendar-review.js カレンダー・手帳・週次レビュー・図表 │
│   7 features.js    スキルツリー・妖精ガイド・アバター       │
│   8 boot.js        全イベント配線・INIT・段階解放・召喚     │
│   9 otomon.js      オトモン（独自の window.Otomon 名前空間）│
│                                                            │
│  データ: localStorage 50キー（サーバー無し・端末内完結）    │
└────────────────────────────────────────────────────────────┘
配信: GitHub Pages https://yoz400.github.io/growth-quest/
      main へ push → 1〜2分で自動デプロイ
```

## 2. この設計の強み（壊してはいけない資産）

| # | 強み | なぜ守るか |
|---|------|-----------|
| 1 | **依存ゼロ・ビルド不要** | npmもフレームワークも無い。10年後もブラウザさえあれば動く。教材としても最強 |
| 2 | **壁時計方式のタイマー** | `Date.now()`差分で計測するのでバックグラウンド・リロードに強い（2026-07-05に復元機能も追加済み） |
| 3 | **OverlayManager**（core.js先頭） | 20+のモーダルの排他・フォーカス・ESCを一元管理。**新モーダルは必ずここに登録** |
| 4 | **UNLOCK_DEFS**（boot.js） | 機能の段階解放が宣言的なレジストリになっている。**新機能の解放条件は1行足すだけ** |
| 5 | **エクスポート/復元** | ユーザーの努力の記録を守る最後の砦 |

## 3. 弱点ランキング（100機能スケールで壊れる順）

### 🥇 弱点1: グローバル名前空間の共有（最重要）
9ファイルの関数・変数がすべて1つの空間に同居している。
**実際に2回事故った**（STEP5の`testCloudNotify`巻き上げ切れ／`featUnlocks`のTDZ）。
機能が増えるほど「名前の衝突」「暗黙の依存」「読み込み順の罠」が加速度的に増える。

### 🥈 弱点2: 描画が「手動での全再描画」方式
データを変えたら `renderStats(); renderXP(); renderCalendar();…` と**呼び忘れなく列挙**
する必要がある。新機能が増えるたび「どこで何を再描画すべきか」の把握コストが上がり、
更新漏れバグ（画面と実データのズレ）が最頻出バグになる未来が見える。

### 🥉 弱点3: localStorage 50キーの台帳が無い
どのキーを誰が読み書きするかがコードを全部読まないと分からない。
`growthPraiseLogs` という**命名規則（gq_接頭辞）違反も既に1件ある**。
エクスポート対象の追加漏れ＝ユーザーデータの永久欠損に直結する。

### 4位: otomon.js だけ別規範
唯一 `window.Otomon` 名前空間に包まれている（これ自体は良い）が、
モーダルがOverlayManagerを通らない独自実装。二重規範は事故の温床。

### 5位: テストが無い
毎回のスモークテストは人力（またはクロのブラウザ操作）。機能が増えると
「触っていない機能が壊れていることに気づけない」リスクが増える。

## 4. 掟：新機能を追加するときの7か条（最重要セクション）

```text
1. 新機能は原則「新しいファイル」に書く（既存ファイルの肥大化禁止）。
   index.html の <script> 群の boot.js の直前に追加する。
2. ファイルをまたぐ「読み込み時参照」は禁止。
   コールバックは () => fn() で包む。状態は localStorage 直読みか関数化。
   （typeof は TDZ に無力。過去2回の起動フリーズはすべてこれ）
3. モーダルを作るなら OverlayManager の DEFS に登録し、
   Overlay.open/close だけで開閉する。独自開閉の実装は禁止。
4. 解放制の機能は UNLOCK_DEFS に登録する（hint も必ず書く）。
5. localStorage キーは gq_ 接頭辞 + 本ドキュメント§6の台帳に追記 +
   exportAllData() の対象に含める。この3点セットを忘れない。
6. コードを変えたら tools/bump_version.sh を実行（?v=guild-N 一括+1）。
7. リリース前スモークテスト: 起動 → タイマーSTART/STOP → 設定開閉 →
   図鑑 → カレンダー → （新規ユーザーで）召喚。コンソールエラーゼロを確認。
```

## 5. 改善ロードマップ（優先度順・すべて任意）

| Phase | 内容 | 効果 | 費用対効果の判断 |
|-------|------|------|------------------|
| A ✅済 | キー台帳（§6）・bumpスクリプト・本ドキュメント | 事故の予防 | 済（2026-07-05） |
| B | **イベント通知の導入**: `GQ.emit('session:complete', {mins})` を作り、各機能は購読して自分の再描画だけ行う | 弱点2の根治。「100機能」への本丸。新機能は emit を1行も触らず購読だけで参加できる | 高。次の大型機能の**前**にやる価値あり（Codex向け仕様書化可能） |
| C | otomonモーダルのOverlayManager統合 | 弱点4解消 | 中。急がない |
| D | 各ファイルをIIFE（即時関数）で包み、公開APIだけ`window.GQ.*`に載せる | 弱点1の根治 | 中。Bと同時にやると効率的 |
| E | ES modules / ビルド導入 | 根本的な近代化 | **今はやらない**。依存ゼロの強み（§2-1）を失う。ユーザー数が増え、複数人開発になったら再検討 |

**フォルダ構成のリファクタリングについての結論**: 物理的なフォルダ移動は**現状不要**。
`scripts/`9本・`styles/`・`assets/`・`docs/`の構成は既に役割が明確で、
移動はキャッシュ・参照切れのリスクだけ生んで得るものが薄い。
「構成の問題」の実体は上の弱点1〜3であり、フォルダではなくルール（§4）で解決する。

## 6. localStorage キー台帳（2026-07-05時点・50キー）

新キー追加時はここに追記し、exportAllData() への追加を確認すること。

| 分類 | キー |
|------|------|
| 本体データ | gq_data（レベル/XP/履歴/連続日数）, gq_settings, gq_unlocks |
| プロフィール | gq_player_name, gq_av_type, gq_avatar, gq_summoned, gq_onboard_done, gq_tutorial_seen |
| タイマー | gq_timer_session（誤操作リロード復元用・完了時必ず削除） |
| クエスト/使命 | gq_daily_quests, gq_mission, gq_mission_reset, gq_nudge_course, gq_nudge_done, gq_vows |
| ジャンル/スキル | gq_genres, gq_skills, gq_skill_notes |
| 褒め/妖精/名言 | growthPraiseLogs（⚠️唯一の命名違反・既存データのため改名不可）, gq_words, gq_words_favs, gq_words_hist |
| すごろく/装備 | gq_sugoroku, gq_inventory, gq_equipped, gq_item_buffs, gq_active_buffs, gq_item_dex, gq_item_memories |
| オトモン | gq_otomon, gq_eggs, gq_wake_items, gq_hatch_quest |
| ギルド | gq_guild |
| 手帳/タイムログ | gq_planner, gq_planner_fired, gq_day_log, gq_day_templates, gq_tl_punch, gq_tl_routine, gq_tl_routine_days |
| レビュー | gq_reviews, gq_rv_status |
| ログイン演出 | gq_login_last, gq_login_streak, gq_loginbonus_seen |
| その他 | gq_badges, gq_confidence_rewards, gq_cloud_url, gq_header_luxe |

## 7. 開発環境メモ（MCP・ツール）

- **この構成に追加のMCPは不要**というのが結論。静的アプリ＋GitHub Pages＋
  localStorage で完結しており、DBやAPIサーバーのMCPを足す理由がない。
- 使っているもの: Claude Preview（ブラウザ検証）／claude-in-chrome（本番URL確認）／
  git+curl（GitHub操作。ghコマンドは未インストールだが不要）。
- ⚠️ Claude Preview の `preview_start` が起動するサーバーはサンドボックスの制約で
  このプロジェクトのファイルを読めない（全部404）。**検証はBashで
  `python3 -m http.server 8123` を立て、プレビュータブをそこへ向ける**（CLAUDE.md参照）。
