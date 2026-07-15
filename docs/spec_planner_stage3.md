# 仕様書：手帳 Stage 3（スキップ/編集・ホームに今日の予定・通知音/スヌーズ）

作成: 2026-07-16 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
対象: `scripts/calendar-review.js`（主）＋ `index.html`（カード1枚）＋
`scripts/core.js`/`scripts/settings-genre.js`（S3-3の設定1項目のみ）
⚠️ 着手条件: 他のJS作業と同時進行しない。新関数はIIFE内・原則window公開なし（Phase Dの作法）。

---

## 0. スコープ（手帳Stage1/2の積み残し。1機能=1コミット）

| # | 機能 | 一言でいうと |
|---|------|------------|
| S3-1 | ⏭ この日だけスキップ＋✏️編集 | 繰り返し予定を「今回だけ消す」「内容を直す」ができるように |
| S3-2 | 🏠 ホームに「今日の予定」カード | カレンダーを開かなくても今日やることが見える |
| S3-3 | 🔊 通知音＋⏰スヌーズ | リマインダーに音と「10分後にもう一度」 |

**新しい localStorage キーは無し**（S3-1はタスクにフィールド追加、S3-3の設定は既存 gq_settings 内）。

## 1. S3-1: ⏭ この日だけスキップ ＋ ✏️ 編集

### スキップ（データ）
- タスクに `skipDates: []` を追加（既存タスクには無いフィールド。`|| []` で互換）
- `planOccursOn(task, dateKey)` の先頭に1行:
  `if ((task.skipDates || []).includes(dateKey)) return false;`
- doneDates と同様に savePlanner() で永続化。**台帳追記不要**（gq_planner の中身が増えるだけ）

### スキップ（UI）
- renderDayPlanner の🗑ボタン: **繰り返しタスクの場合のみ**、confirm ではなく
  行の直下にインライン3択を出す:
  `⏭ この日だけスキップ ／ 🗑 すべての回を削除 ／ やめる`
- 単発タスク（repeat==='none'）は従来どおり即削除（confirmなしの現行挙動を維持）
- スキップ実行 → renderDayPlanner + renderCalendar 再描画（マスのバッジ数が減る）

### 編集
- 予定行のテキスト部分（.cdp-task-text）をタップ → 既存の追加フォームに
  値（text/time/repeat/kind）を読み込み、ボタンが「保存」表示になる（編集モード）
- 保存で該当タスクを**上書き**（idとdoneDates/skipDatesは維持）。
  繰り返しタスクの編集は**全回に効く**（シリーズ編集。回ごとの編集はやらない＝スコープ外）
- 編集モードの解除: 保存 or フォームの「やめる」

## 2. S3-2: 🏠 ホーム「今日の予定」カード

### 置き場所と形
- index.html の `#mission-card` の**直後**に静的カードを追加:
  `<div class="glass" id="today-plan-card" style="display:none">`
- **widget-grip は付けない**（並べ替えシステムに組み込まず固定位置。衝突リスク回避）
- 中身: `📅 今日の予定` ヘッダー ＋ リスト ＋ 右上に小さな「＋」ボタン
  （＋はカレンダーの**今日の日ポップアップ**を開く。既存の日タップと同じ経路を流用。
  新しいフォームを作らない）

### 描画ロジック
- `renderHomePlanner()` を calendar-review.js のIIFE内に新設:
  `planTasksOn(todayKey())` を描画。行UIは renderDayPlanner の簡易版
  （チェック＋時刻＋テキスト。ベル・削除はホームでは出さない＝操作は日ポップアップで）
- チェックで togglePlannerDone → renderHomePlanner + renderCalendar
- **今日の予定が0件ならカードごと非表示**（display:none。ホームを散らかさない）
- 更新のタイミング:
  1. 起動時（calendar-review.js 読み込み末尾で1回）
  2. **savePlanner() の末尾で renderHomePlanner() を呼ぶ**（保存=変更なので確実。
     画面と実データのズレ＝最頻出バグの予防）
  3. **日付が変わったら**: `GQ.on('day:changed', () => setTimeout(renderHomePlanner, 0))`
     （イベントバス初の実購読。spec_event_bus.md の注意どおり **setTimeoutで遅延**させ、
     todayKey のホットパスで重い描画をしない）

## 3. S3-3: 🔊 通知音 ＋ ⏰ スヌーズ

### 通知音
- `DEFAULT_SETTINGS`（core.js）に `reminderSound: true` を追加
- 設定パネル（settings-genre.js）の通知まわりに「リマインダー音」トグルを1つ追加
  （既存トグルのHTML/保存パターンを踏襲）
- fireReminder 内で `if (settings.reminderSound) playChime();`
  （playChime は timer.js の**公開済み**関数。window経由で解決される）

### スヌーズ
- リマインダートースト（#reminder-toast）に「⏰ 10分後にもう一度」ボタンを追加
- 実装: メモリ上の `_snoozed = [{key, atMin}]` に「今+10分」を積み、
  checkPlannerReminders（30秒ごと）が到達したら再度 fireReminder
- **永続化しない**（新キー禁止。リマインダー自体が「タブを開いている間だけ」の
  仕組みなので、リロードでスヌーズが消えるのは仕様として許容）
- スヌーズ再通知は同じ予定につき1回まで（無限スヌーズ連打の複雑化はしない）

## 4. 受け入れ基準

S3-1:
- [ ] 繰り返し予定の🗑でインライン3択が出て「この日だけスキップ」でその日だけ消える
- [ ] スキップした予定は翌日以降（次の該当日）には出る。カレンダーのバッジ数も追従
- [ ] 「すべての回を削除」は従来どおり全削除。単発予定は従来どおり即削除
- [ ] 予定のテキストをタップ→フォームに値が入り「保存」で上書き（id/done/skip維持）
- [ ] 既存の gq_planner データ（skipDates無し）がそのまま動く

S3-2:
- [ ] 今日の予定がある日はホームにカードが出て、チェックで完了できる
- [ ] 0件の日はカードが出ない
- [ ] 日ポップアップで予定を追加/削除するとホームカードが即追従する
- [ ] 「＋」で今日の日ポップアップが開く
- [ ] day:changed 購読は setTimeout 遅延つき（spec_event_bus.md の注意を遵守）

S3-3:
- [ ] 定刻でOS通知/バナーに加えてチャイムが鳴る（設定OFFで鳴らない）
- [ ] トーストの「10分後にもう一度」で10分後に再通知（同じ予定は1回まで）

共通:
- [ ] 新しい localStorage キーを作っていない（gq_settings/gq_planner の中身拡張のみ）
- [ ] 新関数はIIFE内。window公開が必要になったら止まって報告
- [ ] クラウド同期（syncPlannerToCloud）は無変更で従来どおり動く
- [ ] スマホ幅320〜375pxで崩れなし・コンソールエラーゼロ・bump_version.sh 実行済み

## 5. テスト手順

1. 繰り返し（毎日）の予定を作る→今日の分を「この日だけスキップ」→今日消える→
   日ポップアップで明日を見ると出ている
2. その予定のテキストをタップ→文言と時刻を変えて保存→全回に反映・doneDates維持
3. ホーム: 予定ありでカード表示→チェック→完了線→日ポップアップ側にも反映
4. 予定を全部消す→ホームカードが消える
5. 時刻を2分後に設定した予定＋通知ON→定刻にバナー＋チャイム→
   「10分後にもう一度」→（検証は checkPlannerReminders の時刻判定を一時的に
   短縮してよいが、**必ず元に戻す**）
6. 設定でリマインダー音OFF→チャイムが鳴らない
7. localStorage.clear()→新規ユーザーで崩れ・エラーなし

## 6. 迷ったら止まって報告

- widget並べ替えシステムがホームカードに干渉する
- GASクラウド同期が skipDates 入りデータで壊れる兆候
- 編集モードとフォームの状態管理が既存の _plannerAddFromForm と衝突する
- window公開が必要になった／day:changed 購読で描画が重い

## 7. Codexへの依頼文（コピペ用）

```text
docs/spec_planner_stage3.md に従って実装してください。
- 1機能=1コミット（S3-1スキップ/編集 → S3-2ホームカード → S3-3通知音/スヌーズ）。
- 新関数は calendar-review.js のIIFE内。day:changed購読は必ずsetTimeoutで遅延（§2）。
- 新しいlocalStorageキーは作らない。既存gq_plannerデータの互換を維持（skipDatesは||[]）。
- 各コミット後に§5のテスト＋起動スモーク。JS/HTML/CSSを触ったら bash tools/bump_version.sh。
- §6に該当したら作り変えずに止まって報告してください。
```
