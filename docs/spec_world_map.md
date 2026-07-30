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

Codexは、貼られた `areas.js` の原案を**そのままファイルにしないこと**。
以下2つを必ず直してから着手する。

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

原案の各エリアに、**いま `SG_ZONES` が持っている表示値をそのまま**追加する。
新設計の意味情報（`theme` / `landmark` / `intensity` / `map`）は原案どおり残す。

```javascript
{
  id: 'sougen', no: 1, range: [1, 10],
  // ── 表示情報：Phase 1 では既存 SG_ZONES の値をそのまま写す ──
  name: '草　原',            // ← 原案の 'はじまりの草原' ではなく、いまの値
  terrain: 'grassland',
  emoji: '🌿', accent: '#86efac', rgb: '134,239,172',
  // ── 意味情報：原案どおり（Phase 1 ではまだ誰も読まない）──
  theme: '踏み出す',
  palette: { base:'#2c5b3c', accent:'#3f8a55', sky:'#1b3a2c' },
  otomonAttr: 'beast',
  landmark: { id:'ishibashi', name:'石橋' },
  intensity: 2,
  map: { x: 95, y: 350 },
}
```

10エリア分の**写し元は [core.js:1488-1499](../scripts/core.js:1488) の `SG_ZONES`**。
`name` の全角スペース（`草　原`）まで**1文字も変えずに写すこと**。

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

- [ ] `areas.js` に `export` / `import` が1つも無い
- [ ] すごろくを開いて、**10ゾーンすべての名前・絵文字・色が変更前と完全に同一**
- [ ] 冒険ビュー（🗺トグル）のヘッダー背景・舞う粒が変更前と同一（全ゾーン目視）
- [ ] ゾーン突入バナー（`○○ へ突入！`）が出る
- [ ] コンソールエラーゼロ
- [ ] `bash tools/bump_version.sh` 実行済み

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
   （色は areas.js の `palette` を使う）
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

- [ ] 10ゾーンすべてで、名前・ヘッダー背景・スポット絵文字・粒が**素の見た目に転んでいない**
- [ ] `SPOT_ICONS[terrain] || SPOT_ICONS.grassland` のフォールバックに**一度も落ちない**
      （検証：`Object.keys(SPOT_ICONS)` と全 `terrain` 値が一致すること）
- [ ] コンソールエラーゼロ／`bump_version.sh` 実行済み

---

## 6. Phase 3：大陸図（雲が晴れる地図）

### 6.1 名前の衝突に注意

「🗺 世界地図を見る」というボタンが**すでにある**（[core.js:2064](../scripts/core.js:2064) `toggleBoardMap`）。
これは盤面SVGの開閉であり、別物。新画面は **「大陸図」**と呼び、既存ボタンの文言は変えない。

### 6.2 進捗は保存を増やさず `pos` から出す

原案の `gq_world_max_cell` は**追加しない**。到達マスは `gq_sugoroku.pos` が既に持っており、
2か所に分けると「片方だけ更新される日」が必ず来る（掟5）。

```text
gq_sugoroku.pos = 137      ← 本物。サイコロで進む。ステージをまたぐと100を超え続ける
      ↓ sgGetCellNum()     ← 必ずこれを通す。areas.js は 1〜100 前提
盤面のマス = 37
      ↓ Areas.areaOf(37)
忘れられた遺跡
```

そのため原案の `commitMaxCell()` は**削除**し、`KEYS` は `seenCell` だけ残す。

```javascript
const KEYS = {
  // 大陸図を最後に開いたときの到達マス。雲が晴れる差分アニメだけに使う。
  seenCell: 'gq_world_seen_cell',
};
```

`cloudOpacity` / `revealDiff` / `markSeen` は原案のロジックで正しい。ただし
`revealDiff` は `localStorage` から `maxCell` を読む形になっているので、
**引数で受け取る形に変える**（areas.js が他ファイルに依存しないため）。

```javascript
function revealDiff(maxCell, stageId = 'stage1') {
  const from = Number(lsGet(KEYS.seenCell) ?? 0);
  const to   = maxCell;
  …
}
// 呼ぶ側（core.js）
Areas.revealDiff(sgGetCellNum(sugorokuData.pos));
```

### 6.3 保存キーの手続き（掟4）

- [ ] `docs/architecture_review.md` §6 の台帳「すごろく/装備」の行に `gq_world_seen_cell` を追記
- [ ] `exportAllData()` は **追記不要**。`gq_` で始まるキーを自動で拾う作り
      （[settings-genre.js:106](../scripts/settings-genre.js:106)）。ここは確認だけして触らない

### 6.4 `checkpoint` の意味がぶつかっている

`BOARD_CELL_TYPES` は **10・20・30…90 の全部**を `checkpoint`（休憩マス）にしている
（[core.js:413](../scripts/core.js:413)）。原案は60番だけに `checkpoint: true`（中間の振り返り）
を置いている。同じ言葉で別物なので、areas.js 側は **`review: true` に改名**する。

### 6.5 受け入れ基準

- [ ] 大陸図を開くと、到達済みエリアの雲が晴れ、未到達エリアは雲で隠れている
- [ ] 前回見たときより進んでいる場合だけ、差分のエリアで雲が晴れるアニメが再生される
- [ ] アニメ後に `gq_world_seen_cell` が更新され、閉じて開き直すとアニメは再生されない
- [ ] `localStorage.clear()` → リロード（新規ユーザー）で、全エリアが雲に覆われた状態から始まる
- [ ] 保存領域が使えない環境（Safari file://）でも起動でき、大陸図が開ける（雲は毎回アニメでよい）

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
scripts/areas.js を新規作成し、core.js の SG_ZONES（1488行目）を
areas.js から導出する形に置き換えます。

特に §2（export禁止・localStorage を try で包む）と §3（読み込み順）は
起動フリーズに直結するので必ず守ってください。
§4.1 の「表示値は現在の SG_ZONES から1文字も変えずに写す」も厳守です。

§4.3 の受け入れ基準を全部満たしてから、§8 のテスト手順で検証し、
bash tools/bump_version.sh を実行してコミットしてください。
§9 に当たったら、進めずに報告してください。
```
