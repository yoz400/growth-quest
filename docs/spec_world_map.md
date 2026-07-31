# 仕様書：エリア定義の一本化と大陸図（areas.js の正典化）

作成: 2026-07-31 ／ 設計: クロ（Opus 5）／ 実装担当: Codex
親: [architecture_review.md](architecture_review.md) §3 弱点1・弱点3 / §4 掟
⚠️ **Phase 1 は core.js を触る**。他のJS作業と同時進行しない。
**1コミット＝1Phase**、各コミット後に必ず起動スモーク＋すごろく実機確認。

---

## 1. 何を解決するか

すごろくの「10マスごとに世界が変わる」設定が、いま **core.js の `SG_ZONES` 1か所**に
表示情報（名前・絵文字・色）だけを持っています。ここに新しい設計案 `areas.js`
（心の段階・ランドマーク・演出強度・地図座標を持つ）を足すと、**同じものの定義が2つ**に
なります。GQで最も多いバグは「データと画面のズレ」なので、これは必ず事故ります。

```text
【いま】                          【二重定義になると】
core.js                            core.js       areas.js
  SG_ZONES ──→ 盤面・冒険ビュー      SG_ZONES      STAGES
             （唯一の情報源）          │ 名前A        │ 名前B
                                       └→ 盤面        └→ 大陸図
                                     ヨージが片方だけ直す → 画面ごとに別の世界名が出る
```

本仕様は **areas.js を唯一の情報源（正典）にし、`SG_ZONES` を廃止**する。
そのうえで、areas.js が持つ新しい情報（雲・ランドマーク）を使った**大陸図**を作る。

### やらないこと（スコープ境界）
- **ステージ2以降を作らない**。areas.js の `STAGES` は配列だが、中身は stage1 のみ
- **オトモンの出現属性（`otomonAttr`）は Phase 1〜3 では使わない**（§7 で理由を後述）
- **ESモジュール化・ビルド導入はしない**（依存ゼロの強みを壊さない）

---

## 2. 【最重要】設計案そのままでは起動フリーズする2点

§11 付録Aの完成形では**この2点は既に直してある**。ここは「なぜそう書いてあるか」の説明。
付録Aを書き換えるときは、この2つを絶対に壊さないこと。

### 2.1 `export` / `import` を書いてはいけない

GQの9本のJSは全部 `<script src="...">`（classic script）で読まれている。
そこに `export` があると、ブラウザは**中身を1行も実行せず SyntaxError で丸ごと捨てる**。
`Areas` が存在しない状態で core.js が動き、起動フリーズになる（過去2回やった事故と同型）。

```javascript
// ❌ 原案                          // ✅ GQの流儀（otomon.js と同じ）
export const STAGES = [...];        const STAGES = [...];
export function areaOf(...) {}      function areaOf(...) {}
                                    // ファイル末尾で窓口に載せる
                                    window.Areas = { STAGES, KEYS, getStage, areaOf,
                                      progressInArea, isBoundary, cloudOpacity,
                                      revealDiff, markSeen };
```

### 2.2 `localStorage` を裸で触ってはいけない

原案の `commitMaxCell` / `markSeen` / `revealDiff` は `try` 無しで保存領域に触っている。
保存領域に触るだけで例外が飛ぶ環境がある（Safariの file://・プライベートブラウズ）。
[c5a0b9d](../scripts/core.js) の代替シムで通常は守られるが、**シムを入れられない環境では
そこでファイルの評価が止まり、以降の宣言が未初期化のまま残る**＝ロゴ画面フリーズ。

```javascript
function lsGet(k, fallback = null) { try { return localStorage.getItem(k); } catch { return fallback; } }
function lsSet(k, v)               { try { localStorage.setItem(k, v); } catch {} }
```
areas.js 内の保存アクセスは**すべてこの2関数を経由**させる。

---

## 3. 読み込み順（ここを間違えると起動しない）

`areas.js` は **core.js より前**に置く。core.js が読み込み時に `window.Areas.STAGES` を
読んで `SG_ZONES` を作るため。

```html
<script src="scripts/areas.js?v=guild-119"></script>   ← 新規。必ず先頭
<script src="scripts/core.js?v=guild-119"></script>
<script src="scripts/progression.js?v=guild-119"></script>
        …以下、既存のまま…
```

areas.js は**他のどのファイルも参照しない**（純粋なデータ＋関数だけ）。
依存が一方通行なので、掟2「ファイルをまたぐ読み込み時参照は禁止」に抵触しない。
逆向き（areas.js が core.js の関数を呼ぶ）は**絶対に書かないこと**。

---

## 4. Phase 1：二重定義をなくす（見た目は1ピクセルも変えない）

**このPhaseのゴールは「何も変わらないこと」**。表示が変わったらバグ。

### 4.1 areas.js に「表示情報」も持たせる

各エリアは、**表示情報**（いま `SG_ZONES` が持っている値）と**意味情報**（新設計）の
両方を1か所に持つ。

```javascript
{
  id: 'sougen', no: 1, range: [1, 10],
  // ── 表示情報：Phase 1 では既存 SG_ZONES の値をそのまま使う ──
  name: '草　原',            // ← Phase 2 の 'はじまりの草原' ではなく、いまの値
  terrain: 'grassland',
  emoji: '🌿', accent: '#86efac', rgb: '134,239,172',
  // ── 意味情報：Phase 1 ではまだ誰も読まない ──
  theme: '踏み出す',
  palette: { base:'#2c5b3c', accent:'#3f8a55', sky:'#1b3a2c' },
  otomonAttr: 'beast',
  landmark: { id:'ishibashi', name:'石橋' },
  intensity: 2,
  map: { x: 95, y: 350 },
}
```

📌 **10エリア分の完成形は [§11 付録A](#11-付録aphase-1-の-scriptsareasjs-完成形) にそのまま載せてある。
Codexは付録Aをコピーすればよく、値を1つも考える必要はない。**
表示値の写し元は [core.js:1488-1499](../scripts/core.js:1488) の `SG_ZONES`。
`name` の全角スペース（`草　原`）や `❄️` `☁️` の異体字セレクタまで**1文字も変えずに**写してある。

⚠️ `terrain` は単なるラベルではなく**表示の鍵**。3か所で使われている：

```text
terrain: 'cave'
   ├─→ CSS  #ba-zone-header.zt-cave    （app.css:1774）
   ├─→ SPOT_ICONS['cave']              （core.js:1502）マスの絵文字
   └─→ ZONE_PARTICLES['cave']          （core.js:1516）舞う粒
```
ここを新しい名前（`marsh` 等）に変えると、**エラーは1つも出ないのに見た目だけ静かに壊れる**。
Phase 1 では絶対に変えない。

### 4.2 core.js の `SG_ZONES` を areas.js から作る

[core.js:1488](../scripts/core.js:1488) の配列リテラルを削除し、導出に置き換える。

```javascript
// ── すごろくゾーン定義（10マスごとに世界が変わる）──
// 情報源は scripts/areas.js（唯一の正典）。ここは表示用の形に変換するだけ。
const SG_ZONES = (window.Areas?.getStage('stage1').areas || []).map(a => ({
  start: a.range[0], end: a.range[1],
  name: a.name, terrain: a.terrain, emoji: a.emoji, accent: a.accent, rgb: a.rgb,
}));
```

`SPOT_ICONS` / `ZONE_PARTICLES` は **core.js に残す**（表示専用テーブルであり、
エリアの意味ではないため）。`window.SG_ZONES` の再公開（core.js:2521）もそのまま残す。

### 4.3 Phase 1 の受け入れ基準

- [x] `areas.js` に `export` / `import` が1つも無い
- [x] すごろくを開いて、**10ゾーンすべての名前・絵文字・色が変更前と完全に同一**
- [x] 冒険ビュー（🗺トグル）のヘッダー背景・舞う粒が変更前と同一（全ゾーン目視）
- [x] ゾーン突入バナー（`○○ へ突入！`）が出る
- [x] コンソールエラーゼロ
- [x] `bash tools/bump_version.sh` 実行済み

---

## 5. Phase 2：新しい世界名に差し替える（見た目が変わる）

Phase 1 が本番で1日以上安定してから着手する。

### 5.1 差し替え表

| マス | 現在 | → 新 | terrain |
|---|---|---|---|
| 1-10 | 草　原 | はじまりの草原 | `grassland`（変更なし） |
| 11-20 | 深い森 | ささやきの森 | `forest`（変更なし） |
| 21-30 | 洞　窟 | 霧雨の湿原 | `cave` → **`marsh`** |
| 31-40 | 古代遺跡 | 忘れられた遺跡 | `ruins`（変更なし） |
| 41-50 | 砂　漠 | 灼けた砂原 | `desert`（変更なし） |
| 51-60 | 大海原 | 鏡面の湖 | `ocean` → **`lake`** |
| 61-70 | 凍る雪山 | 凍る雪山（変更なし） | `snow`（変更なし） |
| 71-80 | 天空の城 | 雷鳴の峠 | `sky` → **`storm`** |
| 81-90 | 火　山 | 熾火の谷 | `volcano` → **`ember`** |
| 91-100 | 龍の城 | 暁の頂 | `dragon` → **`summit`** |

### 5.2 terrain を変える5エリアは、3点セットで追加する

`marsh` / `lake` / `storm` / `ember` / `summit` について、**必ず3つとも**足す。
1つでも欠けると、その画面だけ無言で崩れる。

1. **CSS**：[app.css:1772-1781](../styles/app.css:1772) に `#ba-zone-header.zt-marsh { ... }` を追加
   > 📌 **実装時の判断（2026-07-31）**: 当初は「色は areas.js の `palette` を使う」と書いたが、
   > **既存の accent / rgb をそのまま引き継ぐ**ことにした。`palette` は Phase 3 の大陸図の
   > 背景用に作った暗い色で、ヘッダーの文字色に流用すると読みにくくなるため。
   > 色の作り直しは Phase 2.5 として切り出す（§12 のレビュー記録を参照）
2. **`SPOT_ICONS`**：[core.js:1502](../scripts/core.js:1502) に `marsh: { normal, item, event, rare, checkpoint, goal }` を追加
3. **`ZONE_PARTICLES`**：[core.js:1516](../scripts/core.js:1516) に5個の絵文字を追加

絵文字案（ヨージの確認を取ること）：

| terrain | normal | item | event | rare | checkpoint | goal | 粒 |
|---|---|---|---|---|---|---|---|
| `marsh` | 🌫 | 🏺 | 🐸 | 🪷 | ⛺ | 🌳 | 🌫💧🌫🍃💧 |
| `lake` | 💧 | 🐚 | 🦢 | 🪞 | ⛵ | 🌳 | 💧✦💧🍃✦ |
| `storm` | ⛰ | 🎁 | ⚡ | 🌩 | 🏕 | 🌳 | ⚡✦⚡💨✦ |
| `ember` | 🪨 | 🔥 | 🌋 | 💠 | 🏯 | 🌳 | 🔥✦·🔥✦ |
| `summit` | ☁ | 🎀 | 🦅 | 🌅 | 🏔 | 🏆 | ✦☁✦·☁ |

### 5.3 受け入れ基準

- [x] 10ゾーンすべてで、名前・ヘッダー背景・スポット絵文字・粒が**素の見た目に転んでいない**
- [x] `SPOT_ICONS[terrain] || SPOT_ICONS.grassland` のフォールバックに**一度も落ちない**
      （検証：`Object.keys(SPOT_ICONS)` と全 `terrain` 値が一致すること）
- [x] コンソールエラーゼロ／`bump_version.sh` 実行済み

---

## 6. Phase 3：大陸図（雲が晴れる地図）

> 📌 **Phase 3 は「新しい画面を1枚つくる」仕事**。Phase 1・2 のような値の差し替えではない。
> 実装の骨組み（HTML・CSS・JS）は **[§13 付録B](#13-付録bphase-3-の実装骨組み)** に全部載せてある。
> Codexは付録Bを土台にすればよく、SVGの座標や関数の形を考える必要はない。

### 6.0 何を作るのか（画面の姿）

すごろくは「いま自分がいる10マス」しか見えない。**旅全体のどこまで来たか**が分かる画面が無い。
大陸図は、10エリアを1枚の地図に並べ、**まだ行っていない場所を雲で隠す**。
進むと雲が晴れる ＝ 進んだことが「地図が広がる」という形で見える。

```text
┌─ 🗺 大陸図 ──────────────────────── ✕ ┐
│  習慣の大陸 ・ マス 37 / 100            │
│                                          │
│   ☁️      ☁️           ☁️              │  ← 未到達は雲
│  暁の頂  熾火の谷    雷鳴の峠  ☁️       │
│                              凍る雪山    │
│  🌿───🌲───🌫───🏛───🌵───💧          │
│ はじまり ささやき 霧雨 忘れられた 灼けた 鏡面 │
│  の草原  の森   の湿原  遺跡   砂原  の湖  │
│  ✓      ✓      ✓     ▲ここ   ☁️   ☁️  │
│                                          │
│  忘れられた遺跡  7 / 10                  │
│  次のランドマーク  🏛 遺跡の門（あと3マス）│
└──────────────────────────────────────────┘
```

- **道**: 10エリアを `map` 座標の順につなぐ線。通った区間だけ明るい
- **雲**: `cloudOpacity()` の値でエリアを覆う。エリアに入ると薄くなり、最終マスで晴れる
- **ランドマーク**: 晴れたエリアにだけ、そのエリアの `landmark.name` を出す
- **現在地**: いまいるエリアに `▲` を置く

### 6.1 入口をどこに置くか（🗺 が2つになる問題）

すごろくの中に **「🗺 世界地図を見る」** というボタンが既にある
（[core.js:2064](../scripts/core.js:2064) `toggleBoardMap`、[index.html:448](../index.html:448)）。
中身は**100マスの盤面グリッド**で、大陸図とは別物。ここに 🗺 をもう1つ足すと確実に混乱する。

**✅ ヨージ決定（2026-07-31）**: 既存ボタンを実態に合わせて改名し、🗺 は大陸図に譲る。

```text
【今】🗺 世界地図を見る ▾   → 中身は100マスの盤面グリッド（名前と中身がズレている）

【決定】
  🎲 マス目を見る ▾        ← 既存トグル。中身どおりの名前にする
  🗺 大陸図をひらく        ← 新規。旅全体の地図（新しいオーバーレイ）
```

⚠️ **この文言は3か所にある。1つでも漏れると、開いた瞬間に古い名前へ戻る。**

| 場所 | 今の文字列 | 変更後 |
|---|---|---|
| [index.html:448](../index.html:448) | `🗺 世界地図を見る ▾` | `🎲 マス目を見る ▾` |
| [core.js:2064](../scripts/core.js:2064) | `🗺 世界地図を見る ▾` | `🎲 マス目を見る ▾` |
| [core.js:2068](../scripts/core.js:2068) | `🗺 世界地図を閉じる ▴` | `🎲 マス目を閉じる ▴` |

（index.html は初期表示用、core.js の2つは開閉のたびに書き換えられる。
index.html だけ直すと、一度開いて閉じた瞬間に古い名前へ戻る）

### 6.2 到達マスの出し方（⚠️ ここに罠がある）

`gq_world_max_cell` は**追加しない**。到達マスは `gq_sugoroku.pos` が既に持っており、
2か所に分けると「片方だけ更新される日」が必ず来る（掟5）。

> 🚨 **この仕様書の初版（§6.2）の記述は不十分だった。訂正する。**
> 初版は「`sgGetCellNum(pos)` を通せばよい」と書いたが、**それだけでは大陸図が壊れる**。
> `sgGetCellNum` は100で折り返すので、ステージ2に入った瞬間に**晴れた雲が全部戻る**。

```text
ステージ1をクリアして先へ進んだとき

  pos = 103
    ↓ sgGetCellNum(103) = 3        ← 盤面の表示としては正しい（3マス目にいる）
    ↓ 大陸図がこれを使うと…
  到達マス = 3  →  はじまりの草原しか晴れていない状態に逆戻り 🚨
```

**必ずこの関数を経由すること**（`sgGetStage` は [core.js:1044](../scripts/core.js:1044) に既存）:

```javascript
// 大陸図が使う「到達マス」。ステージ1をクリア済みなら 100 で頭打ちにする。
// （大陸図はステージ1の地図なので、2周目に入っても晴れた雲は戻さない）
function worldMaxCell() {
  const pos = sugorokuData.pos;
  if (pos <= 0) return 0;
  return sgGetStage(pos) > 1 ? 100 : sgGetCellNum(pos);
}
```

これで **`worldMaxCell()` は単調増加**になり、「一度晴れた雲は戻らない」が構造的に守られる。

### 6.3 雲と差分アニメの動き

`areas.js` の `cloudOpacity` / `revealDiff` / `markSeen` は Phase 1 で実装済み。呼ぶだけでよい。

```text
大陸図をひらく
   ↓
 to   = worldMaxCell()              いまの到達マス
 from = gq_world_seen_cell（前回）   ※初回は 0
   ↓
 まず from の状態で雲を描く         ← いきなり晴れた状態にしない
   ↓
 1フレーム後に to の opacity へ transition（900ms）
   ↓  ＝ 前回から進んだぶんだけ、雲がすうっと晴れる
 アニメ終了後 markSeen(to)          ← 次に開いたときはもう晴れている
```

- **進んでいないとき**（`from === to`）はアニメを出さない。最初から `to` の状態で描く
- `prefers-reduced-motion` は [app.css:5271](../styles/app.css:5271) の全体ルールで
  transition が 0.01ms になるため、**個別対応は不要**（結果だけ即座に表示される）
- `markSeen` は**アニメの完了後**に呼ぶ。途中で閉じられた場合は呼ばない
  （次に開いたときにもう一度晴れるほうが、見逃すより良い）

### 6.4 保存キーの手続き（掟4）

増やすキーは **`gq_world_seen_cell` の1つだけ**（`KEYS.seenCell`、Phase 1 で定義済み）。

- [ ] `docs/architecture_review.md` §6 の台帳「すごろく/装備」の行に `gq_world_seen_cell` を追記
- [ ] `exportAllData()` は **追記不要**。`gq_` で始まるキーを自動で拾う作り
      （[settings-genre.js:106](../scripts/settings-genre.js:106)）。ここは確認だけして触らない

### 6.5 モーダルは OverlayManager に登録する（掟3）

新しい画面は **`world-map-overlay`** という独立したオーバーレイにする。
すごろくの上に重なって開くので、Phase C（オトモン）と同じスタック挙動になる。
**3か所とも**必要。1つでも漏れると ESC が効かない・背景が操作できてしまう。

1. `DEFS` に登録（[core.js:34](../scripts/core.js:34) 付近）
   `'world-map-overlay': { openClass: 'open', dismissible: true },`
2. `styles/app.css` の**共通 visibility セレクタ2本**に id を追加
   （[app.css:5236](../styles/app.css:5236) の非表示側と [5247](../styles/app.css:5247) の `.open` 側）
3. 開閉は `Overlay.open('world-map-overlay')` / `Overlay.close(...)` のみ。
   `classList.add('open')` を直接書かない

### 6.6 `checkpoint` の意味がぶつかっている（対応済み）

`BOARD_CELL_TYPES` は **10・20・30…90 の全部**を `checkpoint`（休憩マス）にしている
（[core.js:413](../scripts/core.js:413)）。原案は60番だけに `checkpoint: true`（中間の振り返り）
を置いていた。同じ言葉で別物なので、areas.js 側は **`review: true` に改名済み**（Phase 1 で対応）。
大陸図では、`review: true` のエリア（鏡面の湖）に**中間地点の印**を出す。

### 6.7 受け入れ基準

- [x] 入口ボタンから大陸図が開き、✕・ESC・背景タップで閉じる（OverlayManager 経由）
- [x] 開いている間、下のすごろく画面は操作できない（`inert`）。閉じるとフォーカスが戻る
- [x] 到達済みエリアの雲が晴れ、未到達エリアは雲で隠れている
- [x] 前回見たときより進んでいる場合**だけ**、差分のエリアで雲が晴れるアニメが再生される
- [x] アニメ後に `gq_world_seen_cell` が更新され、**閉じて開き直すとアニメは再生されない**
- [x] 現在地の `▲` が正しいエリアにあり、下部に「エリア名 7 / 10」と次のランドマーク名が出る
- [x] `localStorage.clear()` → リロード（新規ユーザー）で、**全エリアが雲に覆われた状態**から始まる
- [x] **ステージ2に入っても（`pos` が100を超えても）晴れた雲が戻らない**（§6.2 の罠）
- [x] 保存領域が使えない環境（Safari file://）でも起動でき、大陸図が開ける
      （`gq_world_seen_cell` を保存できないので毎回アニメになるが、それでよい）
- [x] 375px 幅（iPhone SE 級）で地図が横にはみ出さない
- [x] コンソールエラーゼロ／`bash tools/bump_version.sh` 実行済み

### 6.8 テスト手順の追加分（§8 に加えて）

`pos` をコンソールで書き換えて、次の4状態を必ず通ること。**確認後は必ず元の値に戻す**。

| `pos` | 期待される見え方 |
|---|---|
| `0` | 全エリアが雲。現在地なし |
| `37` | 草原〜遺跡が晴れ、遺跡は途中まで薄い雲。現在地＝忘れられた遺跡 |
| `100` | 全エリアが晴れる。暁の頂に🏆 |
| `103` | **100と同じ見え方**（雲が戻らないこと。§6.2 の罠の確認） |

差分アニメは、`gq_world_seen_cell` を小さい値に手で書き換えてから開くと再現できる。

```javascript
localStorage.setItem('gq_world_seen_cell', '15');  // 15マスまで見た状態にする
// → 大陸図を開くと、16マス目以降のエリアで雲が晴れるアニメが出る
```

---

## 7. 保留：`otomonAttr` は今は使わない

原案は各エリアに `otomonAttr`（`beast` / `plant` / `mist` / `ancient` / `mineral` /
`aqua` / `ice` / `thunder` / `ember` / `light`）を置いているが、**既存オトモンの属性軸と
まったく噛み合っていない**。

```text
areas.js の属性（元素）        既存オトモンの属性（生活の領域）
  beast  獣                     study     学習
  aqua   水                     focus     集中
  ice    氷                     recover   回復
  thunder 雷                    sleep     睡眠
  light  光                     exercise  運動 / organize 整理 / social / idea …
```

既存側は「**実生活のどの領域を助ける子か**」で属性を決めている。GQは成長支援ツールであり、
属性が生活領域と結びついていることには意味がある（[ロードマップの4基準](architecture_review.md)）。
元素属性を足すと**軸が2本**になり、どちらでオトモンを分類するのか分からなくなる。

**Codexへの指示**：`otomonAttr` はデータとしてファイルに残してよいが、
**どのコードからも読まない**こと。この軸を採用するかはヨージの決定事項。

---

## 8. テスト手順（各Phase共通）

1. `python3 -m http.server 8123` を立て、`http://localhost:8123/index.html` を開く
   （`preview_start` のサーバーはサンドボックス制約で全404になるため使わない）
2. **既存ユーザー**：そのまま開いて、すごろく → 冒険ビュー → 全ゾーンを目視
   （`gq_sugoroku` の `pos` をコンソールで書き換えれば各ゾーンへ飛べる。
   確認後は必ず元の値に戻す）
3. **新規ユーザー**：`localStorage.clear()` → リロードで、起動〜すごろく解放まで
4. **保存が使えない環境**：Safari で `file://` のまま index.html を開き、
   ロゴ画面で固まらないこと＋警告バナーが出ることを確認
5. コンソールエラーがゼロであること
6. `bash tools/bump_version.sh` → 本番push後 `curl -s https://yoz400.github.io/growth-quest/ | grep v=guild-` で反映確認

---

## 9. 迷ったら止まって報告すること

以下に当たったら、**推測で進めずヨージに報告**する。

- Phase 1 で、写したはずなのに**見た目が変わってしまった**箇所がある
  （＝ `SG_ZONES` 以外にもゾーン情報を持っている場所がある可能性。設計の前提が崩れる）
- `SPOT_ICONS` / `ZONE_PARTICLES` / CSS の3点セットのうち、**どれかが既に想定と違う構造**だった
- `sgGetCellNum()` を通しても areas.js の範囲（1〜100）に収まらないケースを見つけた
- Phase 2 の新しい世界名・絵文字が、既存の演出（ゾーン突入バナー等）で**文字数が溢れる**
- `otomonAttr` を読まないと実装できない要求が出てきた（＝§7 の判断が必要）

---

## 10. Codexへの依頼文（ヨージがコピペする）

```text
docs/spec_world_map.md の Phase 1 を実装してください。

ゴールは「見た目が1ピクセルも変わらないこと」です。

1. §11 付録A のコードを、そのまま scripts/areas.js にコピーして新規作成
   （付録Aが完成形です。値を推測・補完する必要はありません）
2. §3 のとおり index.html で areas.js を core.js より前に読み込む
3. §4.2 のとおり core.js の SG_ZONES（1488行目）を areas.js からの導出に置き換える

特に §2（export禁止・localStorage を try で包む）と §3（読み込み順）は
起動フリーズに直結します。付録Aでは対応済みなので、崩さないでください。

§4.3 の受け入れ基準を全部満たしてから、§8 のテスト手順で検証し、
bash tools/bump_version.sh を実行してコミットしてください。
§9 に当たったら、進めずに報告してください。
```

---

## 11. 付録A：Phase 1 の `scripts/areas.js` 完成形

> 🚨 **2026-07-31 追記：この付録はもう「現在のコード」ではない。**
> Phase 2 で `name` / `terrain` / `emoji` を差し替えたため、いまの `scripts/areas.js` とは違う。
> **この付録をコピーするとPhase 2が巻き戻る。** 現在のコードは `scripts/areas.js` を直接見ること。
> ここは「Phase 1 の完成形」の記録として残してある（Phase 1 のやり直し・差分確認用）。

**この付録が原案の唯一の保管場所**（設計案はチャットで共有されたもので、
リポジトリにもGit履歴にも存在しない）。Phase 1 ではこれを **そのまま `scripts/areas.js` に
コピーした**。値を推測・補完する必要は1つもなかった。

表示情報（`name` / `terrain` / `emoji` / `accent` / `rgb`）は
[core.js:1488-1499](../scripts/core.js:1488) の `SG_ZONES` から1文字も変えずに写してある。
全角スペース（`草　原`）と `❄️` `☁️` の異体字セレクタ（U+FE0F付き）に注意。

```javascript
// areas.js
// ステージとエリアの定義。すごろく盤面・冒険ビュー・大陸図は
// すべてこのファイルを参照する。ここが唯一の情報源。
//
// ⚠️ このファイルは他のどのファイルも参照しない（純粋なデータ＋関数だけ）。
//    依存は一方通行。逆向き（ここから core.js の関数を呼ぶ）は絶対に書かないこと。
// ⚠️ export / import は書かない。GQは classic script で読み込むため、
//    export があるとブラウザが中身を1行も実行せず SyntaxError で丸ごと捨てる。

/**
 * @typedef {Object} Area
 * @property {string} id          ローマ字ID。オトモン等との結合キー。変更禁止。
 * @property {number} no          ステージ内の通し番号（1始まり）
 * @property {[number,number]} range  マス範囲 [開始, 終了]（両端含む）
 *
 * -- 表示情報（Phase 1 では既存 SG_ZONES と同値。Phase 2 で差し替える）--
 * @property {string} name        表示名
 * @property {string} terrain     地形タイプ。CSS(.zt-*)・SPOT_ICONS・ZONE_PARTICLES の鍵
 * @property {string} emoji       ゾーン絵文字
 * @property {string} accent      アクセント色（16進）
 * @property {string} rgb         同色のRGB三つ組（rgba() に埋める用）
 *
 * -- 意味情報（Phase 3 の大陸図で使う。Phase 1〜2 では誰も読まない）--
 * @property {string} theme       心の段階。デバッグ・設計用の覚え書き
 * @property {Object} palette     大陸図用の配色
 * @property {string} otomonAttr  ⚠️ 保留中。§7 の決着まで、どのコードからも読まないこと
 * @property {Object} landmark    境界ランドマーク（そのエリアの最終マスに置く）
 * @property {number} intensity   演出強度 1〜5。5がクライマックス
 * @property {Object} map         大陸図上の座標（viewBox 680x460 基準）
 */

const STAGES = [
  {
    id: 'stage1',
    no: 1,
    name: '習慣の大陸',
    cells: 100,
    areas: [
      {
        id: 'sougen', no: 1, range: [1, 10],
        name: '草　原', terrain: 'grassland',
        emoji: '🌿', accent: '#86efac', rgb: '134,239,172',
        theme: '踏み出す',
        palette: { base: '#2c5b3c', accent: '#3f8a55', sky: '#1b3a2c' },
        otomonAttr: 'beast',
        landmark: { id: 'ishibashi', name: '石橋' },
        intensity: 2,
        map: { x: 95, y: 350 },
      },
      {
        id: 'mori', no: 2, range: [11, 20],
        name: '深い森', terrain: 'forest',
        emoji: '🌲', accent: '#4ade80', rgb: '74,222,128',
        theme: '続かない不安',
        palette: { base: '#20452f', accent: '#2f7a45', sky: '#16301f' },
        otomonAttr: 'plant',
        landmark: { id: 'michishirube', name: '苔むした道標' },
        intensity: 2,
        map: { x: 185, y: 375 },
      },
      {
        id: 'shitsugen', no: 3, range: [21, 30],
        name: '洞　窟', terrain: 'cave',
        emoji: '💎', accent: '#a78bfa', rgb: '167,139,250',
        theme: '重い時期',
        palette: { base: '#3a4f52', accent: '#6b8f92', sky: '#2a3a3d' },
        otomonAttr: 'mist',
        landmark: { id: 'sandou', name: '朽ちた桟道' },
        intensity: 2,
        map: { x: 280, y: 345 },
      },
      {
        id: 'iseki', no: 4, range: [31, 40],
        name: '古代遺跡', terrain: 'ruins',
        emoji: '🏛', accent: '#fb923c', rgb: '251,146,60',
        theme: '先人を知る',
        palette: { base: '#4a4433', accent: '#8c7f5e', sky: '#332f24' },
        otomonAttr: 'ancient',
        landmark: { id: 'mon', name: '遺跡の門' },
        intensity: 3,
        map: { x: 370, y: 375 },
      },
      {
        id: 'sunahara', no: 5, range: [41, 50],
        name: '砂　漠', terrain: 'desert',
        emoji: '🌵', accent: '#fbbf24', rgb: '251,191,36',
        theme: '単調さ',
        palette: { base: '#6b5a34', accent: '#b8973f', sky: '#4a3f24' },
        otomonAttr: 'mineral',
        landmark: { id: 'kareido', name: '涸れた井戸' },
        intensity: 2,
        map: { x: 465, y: 345 },
      },
      {
        id: 'mizuumi', no: 6, range: [51, 60],
        name: '大海原', terrain: 'ocean',
        emoji: '🌊', accent: '#38bdf8', rgb: '56,189,248',
        theme: '振り返り',
        palette: { base: '#22485f', accent: '#3f86ad', sky: '#16303f' },
        otomonAttr: 'aqua',
        landmark: { id: 'sanbashi', name: '桟橋' },
        intensity: 3,
        map: { x: 555, y: 375 },
        // 中間地点。記録の振り返りを出す。
        // ⚠️ 原案の checkpoint から改名（§6.4）。BOARD_CELL_TYPES の
        //    checkpoint（10刻みの休憩マス）とは別物のため。
        review: true,
      },
      {
        id: 'setsuzan', no: 7, range: [61, 70],
        name: '凍る雪山', terrain: 'snow',
        emoji: '❄️', accent: '#bae6fd', rgb: '186,230,253',
        theme: '本気の負荷',
        palette: { base: '#5d738a', accent: '#e8f0f7', sky: '#3f4f60' },
        otomonAttr: 'ice',
        landmark: { id: 'sekisho', name: '雪の関所' },
        intensity: 3,
        map: { x: 600, y: 265 },
      },
      {
        id: 'touge', no: 8, range: [71, 80],
        name: '天空の城', terrain: 'sky',
        emoji: '☁️', accent: '#c4b5fd', rgb: '196,181,253',
        theme: '最大の試練',
        palette: { base: '#3c4a5e', accent: '#8fa3c0', sky: '#252f3d' },
        otomonAttr: 'thunder',
        landmark: { id: 'tsuribashi', name: '吊り橋' },
        intensity: 5, // ステージ1のクライマックス。演出はここに寄せる
        map: { x: 505, y: 205 },
      },
      {
        id: 'okibi', no: 9, range: [81, 90],
        name: '火　山', terrain: 'volcano',
        emoji: '🔥', accent: '#f87171', rgb: '248,113,113',
        theme: '静かに燃え続ける',
        palette: { base: '#2a221e', accent: '#c25a34', sky: '#1a1512' },
        otomonAttr: 'ember',
        landmark: { id: 'haiwatari', name: '灰の渡り' },
        intensity: 1, // 抑えるほど効く。峠の直後の静けさ
        map: { x: 370, y: 175 },
      },
      {
        id: 'itadaki', no: 10, range: [91, 100],
        name: '龍の城', terrain: 'dragon',
        emoji: '🐉', accent: '#fbbf24', rgb: '220,38,38',
        theme: '到達',
        palette: { base: '#4a5a72', accent: '#e0c86a', sky: '#5a6b85' },
        otomonAttr: 'light',
        landmark: { id: 'unkai', name: '雲海の階段' },
        intensity: 4,
        map: { x: 230, y: 155 },
        goal: true,
      },
    ],
  },
];

// ---- localStorage キー（gq_ 接頭辞の規約に従う） ----
//
// 到達した最大マスは保存しない。gq_sugoroku の pos が既に持っており、
// 2か所に分けると「片方だけ更新される日」が必ず来るため（掟5・§6.2）。

const KEYS = {
  // 大陸図を最後に開いたときの到達マス。雲が晴れる差分アニメだけに使う。
  seenCell: 'gq_world_seen_cell',
};

// ---- 保存領域アクセス（必ずこの2つを経由する） ----
//
// 保存領域に触るだけで例外が飛ぶ環境がある（Safariの file://・プライベート
// ブラウズ・Cookie全ブロック）。裸で触ると、そこでファイルの評価が止まり
// 以降の宣言が未初期化のまま残る＝ロゴ画面フリーズ（c5a0b9d と同型）。

function lsGet(key, fallback = null) {
  try { return localStorage.getItem(key); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 記録できなくても動作は続ける */ }
}

// ---- 参照ヘルパ ----

function getStage(stageId = 'stage1') {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0];
}

/**
 * マス番号からエリアを引く。
 * ⚠️ 引数は 1〜100 のマス番号。gq_sugoroku の pos はステージをまたぐと
 *    100を超え続けるので、必ず sgGetCellNum(pos) を通してから渡すこと。
 */
function areaOf(cell, stageId = 'stage1') {
  const areas = getStage(stageId).areas;
  return areas.find((a) => cell >= a.range[0] && cell <= a.range[1]) ?? areas[0];
}

/** エリア内での進み具合（0〜1）。上部バーの「5 / 10」表示などに使う */
function progressInArea(cell, area) {
  const [from, to] = area.range;
  const span = to - from + 1;
  const done = Math.min(Math.max(cell - from + 1, 0), span);
  return { done, span, ratio: done / span };
}

/** そのマスがエリア境界（ランドマーク通過）かどうか */
function isBoundary(cell, stageId = 'stage1') {
  return getStage(stageId).areas.some((a) => a.range[1] === cell);
}

// ---- 大陸図の雲（Phase 3 で使う。Phase 1〜2 では誰も呼ばない） ----

/**
 * エリアを覆う雲の不透明度（0〜1）。
 * エリアに入ってから徐々に薄くなり、最終マスで完全に晴れる。
 * 一度晴れた雲は戻らない — maxCell は単調増加なので自然に担保される。
 */
function cloudOpacity(area, maxCell) {
  const [from, to] = area.range;
  const remaining = (to - maxCell) / (to - from + 1);
  return Math.min(Math.max(remaining, 0), 1);
}

/**
 * 大陸図を開いたときの差分。前回見たときから今回までに晴れるエリアを返す。
 * @param {number} maxCell 到達済み最大マス（1〜100）。呼ぶ側が
 *        sgGetCellNum(sugorokuData.pos) を渡す。
 */
function revealDiff(maxCell, stageId = 'stage1') {
  const to = maxCell;
  const from = Number(lsGet(KEYS.seenCell) ?? 0);
  const areas = getStage(stageId).areas.filter(
    (a) => cloudOpacity(a, from) > 0 && cloudOpacity(a, to) < cloudOpacity(a, from)
  );
  return { from, to, areas };
}

/** 差分アニメの再生後に呼ぶ。引数は revealDiff に渡したのと同じ maxCell */
function markSeen(maxCell) {
  lsSet(KEYS.seenCell, String(maxCell));
}

// ---- 公開窓口（otomon.js と同じ流儀。export は使わない） ----

window.Areas = {
  STAGES, KEYS,
  getStage, areaOf, progressInArea, isBoundary,
  cloudOpacity, revealDiff, markSeen,
};
```

### 付録Aについての注意

- **`otomonAttr` はデータとして置いてあるだけ**。§7 が決着するまで、
  どのコードからも読まないこと
- **`commitMaxCell` は原案から意図的に削除**した（§6.2）。到達マスは
  `gq_sugoroku.pos` から出すため、保存を二重に持たない
- `cloudOpacity` は原案の分母 `area.range[1] - area.range[0] + 1` を
  `to - from + 1` と書き換えてあるが、**同じ式**（可読性のためだけの変更）
- Phase 1 では `KEYS` / `lsGet` / `lsSet` / 雲の3関数は**一度も呼ばれない**。
  それで正しい。Phase 3 で初めて使う

---

## 12. レビュー記録

### ✅ Phase 1 合格（2026-07-31 クロ）

Codex実装1コミット（`66d6154`）を静的検査＋jsc＋ブラウザ実機で検証し合格。`?v=guild-119`。

**成果物**
- `scripts/areas.js` 新規（248行）— **§11 付録Aとバイト単位で完全一致**（`diff` で差分ゼロ）
- `index.html` — areas.js を core.js より前に追加、全10本を `guild-118` → `guild-119`
- `core.js:1488` — `SG_ZONES` の配列リテラル（12行）を areas.js からの導出（4行）に置換

**Phase 1 のゴール「見た目が1ピクセルも変わらないこと」の検証**

目視では見落とすため、機械的に突き合わせた。旧定義は `b32faa6:scripts/core.js` から
そのまま抜き出し、新しい導出式の結果と比較（jsc）。

| 検証 | 結果 |
|---|---|
| `SG_ZONES` 10ゾーン × 7項目 = 70値の一致 | ✅ 全一致 |
| 絵文字のコードポイント単位の一致 | ✅ `❄️`=U+2744+FE0F / `☁️`=U+2601+FE0F の異体字セレクタも保持 |
| 全角スペース（`草　原` `洞　窟` `砂　漠` `火　山`） | ✅ 保持 |
| オブジェクトのキー数 | ✅ 余分なキーの混入なし |

**実機検証（`http://localhost:8123/index.html`）**

- 全10ゾーンの `terrain` が **3点セット（CSS `.zt-*` / `SPOT_ICONS` / `ZONE_PARTICLES`）に
  すべて存在**することをDOMから確認 → フォールバックに落ちるゾーンはゼロ
- 世界地図SVGに**10ゾーンの名前・絵文字が全部描画**されている（`凍る雪山 ❄️` 含む）
- エリアビューを3ゾーンで抜き取り確認：
  - マス32 → `zt-ruins` / 古代遺跡 / 🏛 / 粒 `✦·✦·✦` / 背景 `rgba(251,146,60,.12)`
  - マス65 → `zt-snow` / 凍る雪山 / ❄️(U+FE0F保持) / 粒 `❄❄✦❄❄` / スポット ❄🧊💫🏔 が正しく解決
  - マス95 → `zt-dragon` / 龍の城 / 🐉 / 粒 `⚡✦⚡✦🔥` / マス100に 🏆GOAL
- **新規ユーザー**（`localStorage.clear()` → リロード）で起動完了・ロゴ画面は消える・
  すごろくは未解放（🎲？？？）表示・コンソールエラーゼロ
- **保存領域が例外を投げる環境**を再現（jsc で `localStorage` が必ず throw する状態）→
  areas.js は最後まで評価されて `window.Areas` が生え、`SG_ZONES` も作れる＝**起動フリーズしない**

**掟の遵守**
- 掟1 バージョン一括+1 ✅ / 掟2 読み込み時参照 ✅（areas.js は他ファイル非参照の一方通行）
- 掟3 Overlay ✅（変更なし）/ 掟4 新規localStorageキー ✅（Phase 1 では増やしていない）

**指摘（軽微・実装の修正は不要）**

- コミットメッセージが英語1行（`Add canonical world area definitions`）。CLAUDE.md の
  「コミットメッセージは日本語で変更内容を簡潔に」から外れている。Phase 2 以降は日本語で。
  今回は履歴を書き換えず、このレビュー記録で補う

**Phase 2 へ進む前の待ち**
- 新しい世界名と、`marsh`/`lake`/`storm`/`ember`/`summit` の絵文字案（§5.2）のヨージ確認
- `otomonAttr` の採否（§7）は Phase 3 まで不要

### ✅ Phase 2 完了（2026-07-31 クロが実装・検証）

ヨージの「実行して」を受けて、§5.1 の差し替え表と §5.2 の絵文字案のまま実装。`?v=guild-120`。
Codexではなくクロが直接実装した（データ値の差し替えが中心で、掟の「小さな修正」の範囲）。

**変更したファイル**
- `scripts/areas.js` — 10エリアの `name`、5エリアの `terrain`、4エリアの `emoji`
- `scripts/core.js` — `SPOT_ICONS` / `ZONE_PARTICLES` の5キーを新terrain名で置き換え
- `styles/app.css` — `.zt-*` の5クラスを新terrain名にリネーム
- `index.html` — `#ba-zone-label` の静的プレースホルダー（`草　原` → `はじまりの草原`）

**仕様書に書いていなかった判断3つ**（ヨージが後から変えられるように記録）

1. **ゾーンの絵文字**（§5.2はマスの絵文字だけ決めていて、ヘッダーの絵文字は未定だった）
   💎→🌫（霧雨の湿原）／🌊→💧（鏡面の湖）／☁️→⚡（雷鳴の峠）／🐉→🌅（暁の頂）。
   🔥（熾火の谷）は火山から据え置き
2. **accent / rgb は変更しない**（上の §5.2 の📌に理由）
3. **古い5キーは残さず削除**（`cave` / `ocean` / `sky` / `volcano` / `dragon`）。
   受け入れ基準が「`Object.keys(SPOT_ICONS)` と全 terrain 値が一致」なので、
   使われないキーを残すとこの基準を満たせない

**検証**

| 検証 | 結果 |
|---|---|
| `SPOT_ICONS` / `ZONE_PARTICLES` / `terrain` の**キー集合が3つとも完全一致** | ✅ 過不足ゼロ＝フォールバックに落ちない |
| 全10地形で CSS `.zt-*` が当たっている（グラデーション＋枠線が既定色でない） | ✅ 10/10 |
| 実機レンダリング（マス25 霧雨の湿原／マス95 暁の頂） | ✅ ヘッダー・粒・スポット絵文字・🏆GOAL すべて正しい |
| 世界地図SVGに新しい10ゾーン名が描画される | ✅ 10/10 |
| 新規ユーザー（`localStorage.clear()`→リロード）で起動 | ✅ エラーゼロ |

> ⚠️ **検証のときにハマった落とし穴**: `#ba-zone-header` には
> `transition: background .6s, border-color .6s` が付いている。開いた直後に
> `getComputedStyle` で色を読むと**アニメーション途中の値**が返り、枠線も文字色も
> 「既定の白のまま＝CSSが当たっていない」ように見える。
> **`element.style.transition = 'none'` を入れてから読むこと**。
> 変更していない `zt-ruins` でも同じ症状が出たので、退行ではないと切り分けられた。

**ヨージへの申し送り（Phase 2.5 の候補・急がない）**

新しい名前に対して、色が前の世界のまま残っているところがある。気になったら教えてください。

| ゾーン | いまの色 | ちぐはぐ度 |
|---|---|---|
| 霧雨の湿原 | 洞窟の紫 `#a78bfa` | 🔴 霧の湿原に紫は遠い |
| 暁の頂 | 龍の城の赤背景＋金文字 | 🟡 暁なら金〜橙に寄せたい |
| 雷鳴の峠 | 天空の城の淡紫 `#c4b5fd` | 🟢 雷雲と読めるので許容 |
| 鏡面の湖 / 熾火の谷 | 水色 / 赤 | 🟢 そのままで合う |

---

## 13. 付録B：Phase 3 の実装骨組み

Codexはこれを土台にする。**SVGの座標や関数の形を考える必要はない。**
色・サイズ・文言の微調整は自由だが、**§6.2 の `worldMaxCell()` と §6.5 の
OverlayManager 3点セットだけは形を変えないこと**（ここが壊れると仕様を満たせない）。

> ✅ **B-2 のロジックは動作確認済み**（2026-07-31 クロ、jsc で実行）。
> DOMとすごろく側を差し替えて、実際の `scripts/areas.js` と組み合わせて9項目を検証した。
> **書きっぱなしの疑似コードではない。**
>
> 1. `worldMaxCell()` が pos=103/250 でも 100 を返す（雲が戻らない）
> 2. 新規ユーザー（pos=0）で全10エリアが雲
> 3. pos=37 で雲が `[0,0,0,0.3,1,1,1,1,1,1]`・現在地=忘れられた遺跡・あと3マス
> 4. 現在地マーカー ▲ がちょうど1つ
> 5. 前回15→今回37 で、森が 0.5→0・湿原が 1→0 に動き、完了後に `gq_world_seen_cell=37`
> 6. 同じ位置で開き直すとアニメが走らない
> 7. アニメ途中で閉じると `markSeen` されない
> 8. pos=100 で全エリアが晴れ、🏆（暁の頂）と🪞（鏡面の湖）が出る
> 9. pos=103 の見え方が pos=100 と完全に一致
>
> ⚠️ 検証されたのは**ロジックだけ**。見た目（SVGの座標バランス・雲の質感・
> 375px幅での収まり）は**Codexが実機で確認すること**。

### B-1 `index.html` — オーバーレイ本体

他のオーバーレイと並ぶ位置（`board-overlay` の直後あたり）に置く。

```html
<!-- 🗺 大陸図（旅の全体が見える地図。雲が晴れると進んだことが分かる） -->
<div id="world-map-overlay">
  <div id="wm-panel">
    <div class="wm-head">
      <div>
        <div class="wm-title">🗺 大陸図</div>
        <div class="wm-sub" id="wm-sub">習慣の大陸</div>
      </div>
      <button class="icon-btn" id="wm-close-btn" aria-label="閉じる">✕</button>
    </div>
    <div class="wm-body">
      <svg id="wm-svg" viewBox="0 0 680 460" role="img" aria-label="大陸図"></svg>
    </div>
    <div class="wm-foot" id="wm-foot"></div>
  </div>
</div>
```

すごろく内の入口ボタン（§6.1 でヨージの確認を取った文言にする）:

```html
<!-- index.html:447 付近、board-map-section の中 -->
<button id="wm-open-btn">🗺 大陸図をひらく</button>
```

### B-2 `scripts/core.js` — 描画ロジック

`buildAreaView` の近く（すごろく描画のかたまりの中）に置く。

```javascript
// ── 🗺 大陸図（Phase 3）──────────────────────────────
// 情報源は areas.js。ここは描画だけを担当する。

const WM_REVEAL_MS = 900;      // 雲が晴れるアニメの長さ
let _wmTimer = null;

// 大陸図が使う「到達マス」。
// ⚠️ sgGetCellNum は100で折り返すので、そのまま使うとステージ2で雲が全部戻る。
//    ステージ1をクリア済みなら100で頭打ちにして、単調増加を保証する。
function worldMaxCell() {
  const pos = sugorokuData.pos;
  if (pos <= 0) return 0;
  return sgGetStage(pos) > 1 ? 100 : sgGetCellNum(pos);
}

function openWorldMap() {
  buildWorldMap();
  Overlay.open('world-map-overlay');
}
function closeWorldMap() {
  // アニメ途中で閉じられたら markSeen は呼ばない（次に開いたときにもう一度晴れる）
  if (_wmTimer) { clearTimeout(_wmTimer); _wmTimer = null; }
  Overlay.close('world-map-overlay');
}

function buildWorldMap() {
  const A = window.Areas;
  const svg = document.getElementById('wm-svg');
  if (!A || !svg) return;

  const areas = A.getStage('stage1').areas;
  const to    = worldMaxCell();
  const from  = A.revealDiff(to).from;   // 前回この画面を見たときの到達マス
  const animate = to > from;             // 進んでいるときだけアニメを出す

  // ① 道：10エリアを map 座標の順につなぐ。通った区間だけ明るい線を重ねる
  const all    = areas.map(a => `${a.map.x},${a.map.y}`).join(' ');
  const walked = areas.filter(a => to >= a.range[0])
                      .map(a => `${a.map.x},${a.map.y}`).join(' ');

  // ② エリアごとのノード
  //    data-op = アニメ後の最終opacity。style.opacity = アニメ前の値。
  //    この2つを次フレームで入れ替えることで CSS transition が走る。
  const nodes = areas.map(a => {
    const cloudFrom = animate ? A.cloudOpacity(a, from) : A.cloudOpacity(a, to);
    const cloudTo   = A.cloudOpacity(a, to);
    const here = to > 0 && to >= a.range[0] && to <= a.range[1];
    const badge = a.goal ? '🏆' : a.review ? '🪞' : '';
    return `
      <g class="wm-area">
        <circle cx="${a.map.x}" cy="${a.map.y}" r="26"
                fill="${a.palette.base}" stroke="${a.accent}" stroke-width="2"/>
        <text class="wm-emoji" x="${a.map.x}" y="${a.map.y + 8}">${a.emoji}</text>
        <g class="wm-label" data-op="${1 - cloudTo}" style="opacity:${1 - cloudFrom}">
          <text class="wm-name" x="${a.map.x}" y="${a.map.y + 48}"
                style="fill:${a.accent}">${a.name}</text>
          <text class="wm-mark" x="${a.map.x}" y="${a.map.y + 64}">${badge} ${a.landmark.name}</text>
        </g>
        ${here ? `<text class="wm-here" x="${a.map.x}" y="${a.map.y - 36}">▲</text>` : ''}
        <ellipse class="wm-cloud" cx="${a.map.x}" cy="${a.map.y}" rx="52" ry="40"
                 data-op="${cloudTo}" style="opacity:${cloudFrom}"/>
      </g>`;
  }).join('');

  svg.innerHTML = `
    <defs>
      <radialGradient id="wm-cloud-grad">
        <stop offset="0%"   stop-color="#e9edf6" stop-opacity=".95"/>
        <stop offset="70%"  stop-color="#c7cfe0" stop-opacity=".75"/>
        <stop offset="100%" stop-color="#aab4c8" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <polyline class="wm-road" points="${all}"/>
    ${walked.split(' ').length > 1 ? `<polyline class="wm-road-walked" points="${walked}"/>` : ''}
    ${nodes}`;

  // ③ 見出しと足元の情報
  const sub = document.getElementById('wm-sub');
  if (sub) sub.textContent = `習慣の大陸 ・ マス ${to} / 100`;

  const foot = document.getElementById('wm-foot');
  if (foot) {
    const cur = to > 0 ? A.areaOf(to) : null;
    if (!cur) {
      foot.innerHTML = `<div class="wm-foot-next">サイコロを振ると、地図が広がっていきます。</div>`;
    } else {
      const p    = A.progressInArea(to, cur);
      const rest = cur.range[1] - to;
      foot.innerHTML = `
        <div class="wm-foot-area" style="color:${cur.accent}">
          ${cur.emoji} ${cur.name}<span class="wm-foot-prog">${p.done} / ${p.span}</span>
        </div>
        <div class="wm-foot-next">${rest > 0
          ? `次のランドマーク　${cur.landmark.name}（あと ${rest} マス）`
          : `${cur.landmark.name} に到達！`}</div>`;
    }
  }

  // ④ 差分アニメ。次フレームで最終値に入れ替えると transition が走る
  if (animate) {
    requestAnimationFrame(() => {
      svg.querySelectorAll('[data-op]').forEach(el => { el.style.opacity = el.dataset.op; });
    });
    _wmTimer = setTimeout(() => { A.markSeen(to); _wmTimer = null; }, WM_REVEAL_MS + 120);
  } else {
    A.markSeen(to);
  }
}
```

ファイル末尾の公開窓口に**必ず追加**する（IIFE化済みなので、書かないと boot.js から呼べない）:

```javascript
window.openWorldMap  = openWorldMap;
window.closeWorldMap = closeWorldMap;
window.buildWorldMap = buildWorldMap;
```

### B-3 `scripts/boot.js` — 配線

すごろくのイベント登録のかたまり（boot.js の先頭付近、`board-map-toggle` の隣）に置く。

```javascript
document.getElementById('wm-open-btn')?.addEventListener('click', () => openWorldMap());
document.getElementById('wm-close-btn')?.addEventListener('click', () => closeWorldMap());
document.getElementById('world-map-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('world-map-overlay')) closeWorldMap();
});
```

> ⚠️ **掟2**: `addEventListener('click', openWorldMap)` と裸で渡さず、
> 必ず `() => openWorldMap()` で包むこと。core.js と boot.js はファイルが違うため、
> 読み込み時に関数の実体を掴みにいくと過去2回の起動フリーズと同じ形になる。

### B-4 `styles/app.css`

```css
/* ═══ 🗺 大陸図 ═══ */
#world-map-overlay {
  position: fixed; inset: 0; z-index: 94;   /* board-overlay(93) の上に重ねる */
  background: rgba(0,0,0,.86); backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none; transition: opacity .3s;
}
#world-map-overlay.open { opacity: 1; pointer-events: auto; }

#wm-panel {
  width: min(560px, calc(100vw - 20px));
  background: #0e0e1c; border: 1px solid rgba(6,182,212,.22);
  border-radius: 24px; max-height: 92vh; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,.9);
}
.wm-head {
  padding: 16px 22px 14px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
  display: flex; align-items: center; justify-content: space-between;
}
.wm-title { font-size: .98rem; font-weight: 700; }
.wm-sub   { font-size: .68rem; color: var(--text-dim); margin-top: 2px; }

.wm-body { flex: 1; overflow: auto; padding: 12px; }
#wm-svg  { width: 100%; height: auto; display: block; }   /* 375px幅でもはみ出さない */

.wm-road        { fill: none; stroke: rgba(255,255,255,.10); stroke-width: 3;
                  stroke-linecap: round; stroke-linejoin: round; }
.wm-road-walked { fill: none; stroke: rgba(6,182,212,.55);   stroke-width: 3;
                  stroke-linecap: round; stroke-linejoin: round; }

.wm-emoji { font-size: 24px; text-anchor: middle; }
.wm-name  { font-size: 15px; font-weight: 700; text-anchor: middle; }
.wm-mark  { font-size: 11px; text-anchor: middle; fill: var(--text-dim); }
.wm-here  { font-size: 18px; text-anchor: middle; fill: #fbbf24; }

.wm-cloud { fill: url(#wm-cloud-grad); }

/* 雲とラベルは同じ長さでフェードさせる。
   prefers-reduced-motion では app.css 末尾の全体ルールが 0.01ms に潰すので個別対応は不要 */
.wm-cloud, .wm-label { transition: opacity .9s ease; }

.wm-foot {
  flex-shrink: 0; padding: 12px 18px 16px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.wm-foot-area { font-size: .92rem; font-weight: 700; display: flex;
                align-items: center; gap: 8px; }
.wm-foot-prog { font-size: .72rem; color: var(--text-dim); font-weight: 400; }
.wm-foot-next { font-size: .72rem; color: var(--text-dim); margin-top: 4px; }
```

**忘れずに**: [app.css:5236](../styles/app.css:5236) と [5247](../styles/app.css:5247) の
共通 visibility セレクタ2本に `#world-map-overlay` / `#world-map-overlay.open` を追加する（§6.5）。

---

## 14. Codexへの依頼文（Phase 3・ヨージがコピペする）

```text
docs/spec_world_map.md の Phase 3（大陸図）を実装してください。

§13 付録B に HTML・JS・CSS の骨組みが全部あります。これを土台にしてください。
色やサイズの微調整は自由ですが、次の2つだけは形を変えないでください:
  - §6.2 の worldMaxCell()（ステージ2で雲が全部戻る罠を防ぐ要）
  - §6.5 の OverlayManager 3点セット（DEFS登録・CSS共通セレクタ2本・open/close）

§6.1 の入口ボタンの文言はヨージが決定済みです（A案）。既存の「🗺 世界地図を見る」を
「🎲 マス目を見る」に改名し、🗺 は大陸図に譲ります。**この文言は index.html と core.js の
計3か所にある**ので、§6.1 の表のとおり全部直してください。1つでも漏れると、
一度開いて閉じた瞬間に古い名前へ戻ります。

§6.4 のとおり architecture_review.md §6 の台帳に gq_world_seen_cell を追記します
（exportAllData は自動で拾うので触らないでください）。

§6.7 の受け入れ基準を全部満たしてから、§8 と §6.8 のテスト手順で検証し、
bash tools/bump_version.sh を実行して、日本語のコミットメッセージでコミットしてください。
§9 に当たったら、進めずに報告してください。
```

### ✅ Phase 3 合格（2026-07-31 クロ）

Codex実装1コミット（`b596d63`）をコード精査＋jsc＋ブラウザ実機で検証し合格。
クロが1点だけ修正を追加して `?v=guild-122`。

**仕様の遵守**

| 項目 | 結果 |
|---|---|
| §6.2 `worldMaxCell()`（ステージ2で雲が戻る罠） | ✅ 付録Bどおり。pos=103 の見え方が pos=100 と一致 |
| §6.5 OverlayManager 3点セット | ✅ DEFS登録・CSS共通セレクタ2本・open/close すべて |
| §6.1 ボタン改名（3か所） | ✅ index.html:448 と core.js の2か所すべて |
| §6.4 台帳への追記 | ✅ architecture_review.md §6 に `gq_world_seen_cell` |
| 掟2 コールバックの遅延化 | ✅ boot.js は `() => openWorldMap()` で包んである |
| 掟1 バージョン一括+1 | ✅ |

**Codexが仕様書より良くした点**

`Overlay.open('world-map-overlay', { onClose: cancelWorldMapReveal })` を足していた。
付録Bには無かったが、これが**正しい**。`closeWorldMap()` を通らない閉じ方
（ESC・背景タップ）でもアニメの予約を止める必要がある。`onClose` は
OverlayManager に元からある機能（[core.js:116](../scripts/core.js:116)、board-overlay でも使用）。

**クロが追加した修正1件**

付録B（＝クロが書いた骨組み）に、**演出を永久に取り逃がす穴**があった。

```text
【修正前】
  requestAnimationFrame(雲を動かす)      ← ページが裏に回ると発火しない
  setTimeout(markSeen, 1020)             ← こちらは発火する
        ↓
  雲は動いていないのに「見た」ことにされる → その回の演出は二度と出ない

【修正後】
  requestAnimationFrame(() => {
    雲を動かす
    setTimeout(markSeen, 1020)           ← 雲が動いた後にだけ予約する
  })
```

`_wmRevealing` フラグを1つ足し、rAF が回る前に閉じられた場合も予約が走らないようにした。
jsc で6項目を検証（正常系／rAF が止まる環境／rAF 前に閉じる／アニメ途中で閉じる／
アニメ無しの回帰／見え方の回帰）。

> 💡 **この穴に気づけた理由**: 検証に使ったブラウザが `document.visibilityState === 'hidden'`
> で、**rAF が一度も発火しない環境だった**。そのおかげで
> 「雲が動かないまま `gq_world_seen_cell` が 37 に進む」現象を実際に踏めた。
> 修正後は同じ環境で `15` のまま据え置かれることを確認している。

**実機検証（`http://localhost:8123`）**

- pos=0 → 全10エリアが雲・現在地なし・「サイコロを振ると、地図が広がっていきます。」
- pos=37（前回15）→ 雲が `[0,0.5,1,…]` から `[0,0,0,0.3,1,…]` へ動く。
  現在地=忘れられた遺跡・7 / 10・「遺跡の門（あと 3 マス）」
- pos=100 → 全エリア晴れ・🏆（暁の頂）🪞（鏡面の湖）・通過済みの道が明るい
- pos=103 → pos=100 と完全に同じ見え方（§6.2 の罠を回避できている）
- ESC で大陸図だけ閉じ、下のすごろくは開いたまま残る。開いている間 `board-overlay.inert = true`
- 375px 幅で横スクロールなし・パネルが画面内に収まる
- コンソールエラーゼロ

**ヨージへの申し送り（急がない・見た目の話）**

1. **地図の上に大きな余白がある**。`viewBox="0 0 680 460"` に対して中身は
   y≈119〜439 にしかないため、上に約26%の空きができている。
   `viewBox="0 100 680 360"` に変えると地図が一回り大きく見える（CSS/JS 1か所）
2. **375px でラベルがやや窮屈**。エリア名とランドマーク名が隣のエリアと近い。
   潰れてはいないが、狭い端末では文字を1段小さくしてもよい

どちらも機能には影響しない。実機で見て気になったら教えてください。
