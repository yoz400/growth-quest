# オトモンシステム 実装プラン（設計案）

> **ステータス:** 設計案（まだ実装しない）
> **作成日:** 2026-06-18
> **前提:** [growthquest_otomon_system.md](growthquest_otomon_system.md)（設計ベースライン）
> **方針:** 既存コードへの影響を最小にする。新機能は「新しい localStorage キー」と「新ファイル」に隔離し、既存 `scripts/app.js` には“細い差し込み口（フック）”だけを足す。

---

## 0. 既存コード調査の結論

`scripts/app.js`（約9,800行）を調査した結果、**8機能のほとんどに流用できる土台が既にある**。

| 必要なもの | 既存の流用元（app.js） | やること |
|---|---|---|
| ① 卵を双六で入手 | `doSugorokuRoll()` の到着マス処理 ＋ `_sgPendingReward`（到着GET演出） | 「卵が出る分岐」を1つ足す |
| ② 卵に目覚めアイテムを使う | `ITEM_MASTER` / `inventory` / `getItemById()` | 目覚めアイテム定義を新設 |
| ③ アイテム→オトモンクエスト | `DAILY_QUESTS` / `dailyQuests`、`NUDGE_COURSES` / `completeNudge()` / `showNudgeToast()` | 同じ「カード＋1日1回ガード＋トースト」を流用 |
| ④ 達成→孵化ゲージ | 上のクエスト達成フロー | 達成時に `gauge += 1` |
| ⑤ 満タン→誕生 | 演出系 `showNudgeToast` 等 | 抽選＋誕生演出 |
| ⑥ オトモン図鑑 | `.gq-panel` オーバーレイ（board/skill/avatar と同じ）＋フィルタタブ（words/badges） | `otomon-panel` を新設 |
| ⑦ ナッジ効果 | タイマー開始/セッション完了処理 | 発火フックを足す |
| ⑧ 導きの妖精ナビ | **`FG_CATEGORIES` ＋ `buildFairyOracle()` ＋ `fgGo()`（実装済み）** | 分岐とジャンプ先を足す |
| 機能の解放制 | `UNLOCK_DEFS` / `featUnlocks`（`gq_unlocks`） | `egg` / `otomon` キーを追加 |
| 画像アセット | `assets/equipment/...` の命名規約 | `assets/otomon/...` を新設 |

> **重要:** 「導きの妖精ガイド」（⑧）はヘッダー「迷ったら押す」ボタンとして **ほぼ完成済み**（`buildFairyOracle` が状況を見て「次の一歩」を出す）。卵・図鑑の案内は分岐を足すだけ。

---

## 1. データ構造（新規 localStorage キー・既存に非干渉）

既存は「機能ごとに localStorage キー＋ load/save 関数」という統一パターン。オトモンも**新しいキーを3つ足すだけ**で、既存データには一切触れない。

```text
新規キー（3つ）
┌──────────────────┬───────────────────────────────────────────┐
│ gq_eggs          │ 保有中の卵と孵化ゲージの進み具合          │
│ gq_hatch_quest   │ 今発生しているオトモンクエスト（同時1件） │
│ gq_otomon        │ 図鑑（仲間にしたオトモン）＋お供設定      │
└──────────────────┴───────────────────────────────────────────┘
```

### マスター定義（コード内定数。`ITEM_MASTER` と同じ流儀）

```js
// オトモン図鑑の全個体。attribute は10カテゴリ（学習/集中/運動/回復/睡眠/整理/交流/自制/発想/冒険）
const OTOMON_MASTER = [
  { id:'echo_slime', name:'こだまスライム', rarity:'R', attribute:'study',
    role:'学習開始', emoji:'🟢', imageBase:'assets/otomon/echo_slime',
    nudge:{ trigger:'timer_start', text:'学習を始めると跳ねて応援するよ' },
    flavorText:'学習音に反応して跳ねる相棒。' },
  // …第1弾10体。後から append するだけで100体まで拡張可
];

// 卵：どの目覚めアイテムを受け付けるか／満タンに必要な回数（レアで変動）
const EGG_MASTER = [
  { id:'echo_egg', name:'こだまの卵', habitat:'cave', emoji:'🥚',
    accepts:['echo_flute','sun_blanket','drowse_feather'], rarity:'R', hatchGoal:3 },
  // …
];

// 目覚めアイテム（消費型の行動トリガー）。基本＝属性つき、特別＝special フラグ
const WAKE_ITEM_MASTER = [
  { id:'echo_flute', name:'こだまの笛', emoji:'🎵', attribute:'study',
    questPool:[ { kind:'study_5min', text:'5分だけ学習を開始しよう', gauge:+1 },
                { kind:'read_aloud',  text:'音読を1分する',         gauge:+1 } ],
    favors:['echo_slime','echo_bat','rune_lizard'] },
  // 特別アイテム（専用ロジックで処理）
  { id:'starter_seed', name:'はじまりの種', emoji:'🌱', special:'universal',
    questPool:[ { kind:'just_start', text:'とりあえず1分だけ着手する', gauge:+1 } ] },
  { id:'retry_quill',  name:'再挑戦の羽ペン', emoji:'🪶', special:'retry' },
  { id:'bond_ribbon',  name:'きずなのリボン', emoji:'🎀', special:'bond' },
  // …
];

// 旅先（双六ステージ）→ 出る卵
const HABITAT_EGGS = {
  forest:['leaf_egg','komorebi_egg'], cave:['echo_egg','crystal_egg'],
  snow:['ice_egg','drowse_egg'], desert:['sand_egg','starry_egg'],
  ruins:['karakuri_egg','rune_egg'], shore:['drop_egg','bubble_egg'],
  shrine:['ward_egg','shirotsu_egg'], guild:['random_egg','special_egg'],
};
```

### 保存データの形（localStorage）

```js
// gq_eggs … 保有中の卵（配列）
[{ uid:'e1718…', eggId:'echo_egg', gauge:1, goal:3,
   usedItem:'echo_flute', sleeping:false, gotAt:1718000000000 }]

// gq_hatch_quest … 発生中のオトモンクエスト（1件 or null）
{ eggUid:'e1718…', itemId:'echo_flute',
  kind:'study_5min', text:'5分だけ学習を開始しよう',
  issuedDate:'2026-06-18', done:false }

// gq_otomon … 図鑑＋お供設定
{ discovered:{ echo_slime:{ bornAt:1718…, count:1, bond:0 } },
  active:'echo_slime',   // 今お供させているオトモン（ナッジ発動元）
  nudgeOn:true }
```

> **失敗時の扱い:** 未達成のまま日付が変わったら卵を `sleeping:true` に。割れない。`retry_quill`（再挑戦の羽ペン）か翌日タップで復帰。ペナルティは作らない。

---

## 2. ファイル構成（新コードを1ファイルに隔離）

```text
claude-practice/
├─ index.html              ← <script otomon.js?v=…> を1行＋図鑑/卵モーダルのHTML
├─ scripts/
│   ├─ app.js              ← “細い差し込み口”を数か所だけ追加
│   └─ otomon.js           ★新規：卵・孵化・図鑑・ナッジの全ロジック
├─ styles/
│   ├─ app.css
│   └─ otomon.css          ★新規（任意）：図鑑・卵カード・誕生演出の見た目
└─ assets/
    └─ otomon/<id>/{source,1024,256,64}/…   ★新規：オトモン画像
```

> `app.js` はクラシックスクリプトなので、後から読む `otomon.js` は `app.js` のグローバル（`sugorokuData` 等）をそのまま使える。`app.js` 側からは `window.Otomon?.xxx()`（`?.` で“未読込でも落ちない”）で呼ぶ。
> ※「1ファイルが分かりやすい」場合は `app.js` 内に `// ── OTOMON SYSTEM ──` セクションを足す形でも可（要相談）。

### `app.js` に入れる“細い差し込み口”（各1〜2行）

| 場所 | 差し込む内容 | 目的 |
|---|---|---|
| `doSugorokuRoll()` の到着分岐 | `window.Otomon?.maybeDropEgg(sugorokuData.stage)` → `_sgPendingReward` | ① 卵入手 |
| タイマー開始処理 | `window.Otomon?.onTimerStart()` | ③④⑦ クエスト達成判定／ナッジ |
| セッション完了処理 | `window.Otomon?.onSessionComplete(mins)` | ③④ 達成判定 |
| ホーム描画 | `window.Otomon?.renderHomeCards()` | 卵・クエストカード表示 |
| `FG_CATEGORIES` / `buildFairyOracle()` / `fgGo()` | 卵・図鑑の項目・分岐を追加 | ⑧ 妖精ナビ |

---

## 3. UI導線（画面の流れ）★今回の重点

既存UIは「ホーム（縦スクロール）＋ ヘッダーのボタンで開く全画面パネル（`.gq-panel`）」構成。オトモンも**この型に合わせる**ので、操作感が既存と揃う。

### 全体マップ（どこから入って、どこへ行くか）

```text
                         ┌──────────────── ヘッダー ────────────────┐
                         │ …  🧚迷ったら押す   📔オトモン図鑑(新) │
                         └──────────────────────────────────────────┘
   [双六パネル]                        [ホーム(縦スクロール)]
   サイコロ→旅先到着                    ┌───────────────────────────┐
        │「🥚卵を見つけた！」演出       │ ⚡オトモンクエストカード(新) │ ←発生中だけ
        ▼ [受け取る]                    │ 🥚 卵カード(新)             │ ←保有卵があれば
        └──────────────────────────────▶│ daily-quest / mission …    │
                                         └───────────────────────────┘
        卵カード タップ                            │ 📔タップ
        ▼                                          ▼
   [卵モーダル]                              [オトモン図鑑パネル]
   卵情報＋使える目覚めアイテム一覧          発見済み=カラー / 未発見=シルエット
        │ [このアイテムを使う]                属性フィルタ・個体詳細・お供設定
        ▼
   ⚡オトモンクエスト発生（ホームにカード）
```

### 中心となる1本の流れ（卵→誕生）

```text
[双六] 旅先到着 ─▶「🥚 こだまの卵を見つけた！」(既存GET演出を流用)
      │[受け取る]
      ▼
[ホーム:🥚卵カード] 「未使用の卵が1つ」     ←─────────────────┐
      │ タップ                                                  │
      ▼                                                         │
[卵モーダル] 卵の情報 ＋ 使える目覚めアイテム（accepts）        │
      │ アイテム選択 →[このアイテムを使う]                      │
      ▼                                                         │
[ホーム:⚡クエストカード] 「5分だけ学習を開始しよう」          │
      │ 現実行動 →[達成した] or タイマー連動で自動達成          │
      ▼                                                         │
  孵化ゲージ +1 演出「孵化ゲージ 1 / 3」── 満タン? ──No──▶──────┘（翌日また）
      │ Yes
      ▼
[誕生演出(全画面)] 「こだまスライムが生まれた！」 →[図鑑で見る]
      ▼
[図鑑] 新オトモン追加＋お供に設定 → 以後ナッジ発動
```

### 各画面の要点

- **卵カード（ホーム新カード）:** `daily-quest-card` の位置・見た目を踏襲。保有卵数とゲージを表示。卵が無ければ非表示。
- **卵モーダル:** その卵の `accepts` にある目覚めアイテムだけを所持品から表示。特別アイテム（はじまりの種＝全卵可）も提示。
- **オトモンクエストカード（ホーム新カード）:** 既存ナッジカードのUIを踏襲。発生中の1件を表示。達成は「達成した」ボタン or `study_5min` 等は学習で自動判定。優先度：クエスト発生中＞卵カード。
- **オトモン図鑑（`otomon-panel`）:** グリッド表示。発見済み＝カラー＋名前、未発見＝シルエット＋「？」。属性フィルタタブ（既存 words/badges のタブUIを流用）。個体タップで詳細（フレーバー・相性アイテム・ナッジ説明・「お供にする」）。
- **導きの妖精（導線のハブ）:** `buildFairyOracle()` の優先カスケードに以下を追加。
  - クエスト発生中・未達成 →「卵が待ってるよ。5分だけ始めてみない？」→クエストへ
  - 卵を持つがアイテム未使用 →「拾った卵、起こしてあげよう」→卵モーダルへ
  - 卵が眠った →「卵が眠っちゃった。もう一度そっと起こそう」→再挑戦へ

---

## 4. 8機能のマッピング（どこに、何を作るか）

```text
①入手   双六到着 → maybeDropEgg(stage) → HABITAT_EGGS抽選 → gq_eggs に追加
②使う   卵モーダルで accepts のアイテム選択 → gq_hatch_quest 生成
③発生   WAKE_ITEM_MASTER[item].questPool から1つ → クエストカード表示
④ゲージ  quest.kind を onTimerStart/onSessionComplete/[達成]で判定 → gauge += 1
⑤誕生   gauge >= goal → favors 重み付け抽選 → gq_otomon.discovered 追加＋卵削除
⑥図鑑   otomon-panel：discovered をグリッド、未発見はシルエット、属性フィルタ
⑦ナッジ  active オトモンの nudge.trigger で応援トースト（timer_start 等）
⑧ナビ   buildFairyOracle に卵/クエスト分岐、FG_CATEGORIES に図鑑、fgGo に 'otomon'
```

---

## 5. 段階的な進め方（急がない前提）

| フェーズ | 内容 | 確認方法 |
|---|---|---|
| **P0 土台** | `otomon.js` 新設、3キー＋マスター定義のみ（UIなし） | コンソールで卵追加→図鑑反映を確認 |
| **P1 入手＋図鑑** | 双六で卵が出る／図鑑パネル表示／ホーム卵カード | 双六で卵が出る、図鑑が開く |
| **P2 本ループ** | 卵モーダル→クエスト→ゲージ→誕生（設計の画面文言） | 卵→アイテム→達成→誕生を通す |
| **P3 ナッジ＋ナビ** | お供の応援＋導きの妖精に組み込み | タイマー開始で応援、妖精が案内 |

各フェーズは単独で動作確認でき、途中で止めても既存機能を壊さない。

---

## 6. 開発メモ（落とし穴）

- `app.js` / `app.css` / 新ファイルを編集・追加したら `index.html` の `?v=guild-N` を上げる（キャッシュ対策）。新ファイルにも `?v=` を付ける。
- プレビューは `python3 -m http.server 8000` → `http://localhost:8000`。
- 画像は ChatGPT が原画 → クロが `assets/otomon/<id>/{1024,256,64}/` にリサイズ配置。用意できるまで `emoji` でフォールバック。
- 第1弾は10体。`OTOMON_MASTER` / `EGG_MASTER` / `WAKE_ITEM_MASTER` に append するだけで100体まで拡張できる設計を保つ。
