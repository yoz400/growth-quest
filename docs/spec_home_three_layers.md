# 仕様書：ホームの三層化（H-3 / ロードマップ フェーズ4の本題）

作成: 2026-08-05 ／ 設計: クロ（Opus 5）
実装担当: L-1 = クロ（完了）／ L-2 以降 = Codex（依頼文は §8-2）
親: [spec_home_layers.md](spec_home_layers.md) §3 ／ [team/roadmap.md](team/roadmap.md) フェーズ4
掟: [architecture_review.md](architecture_review.md) §4
⚠️ 他のJS作業と同時進行しない。**L-1 → L-2 → L-3 の順**。各段階でコミットを分ける。

---

## 0. なぜやるか（一行で）

ホームは最大14枚のカードが**全部フラットに縦積み**で、**どれが大事かが視覚的にゼロ**。
14枚あることが問題なのではなく、**14枚が横一線に見えている**ことが問題。

---

## 1. ヨージが決めたこと（2026-08-05）

親仕様書 §3 で「ヨージにしか決められない」としていた3点の答え。**この3つが以降の設計の土台**。

| # | 決めたこと | 答え |
|---|---|---|
| 1 | 「きょう」タブに何を畳むか | **クエスト／予定／打刻の3つだけ** |
| 2 | タブの開閉状態を覚えるか | **その日だけ覚える**（日付が変わったらクエストへ戻る） |
| 3 | 並べ替え（⠿ドラッグ）をどうするか | **廃止する** |

**1の含意**（ここが設計を決めている）:

- **使命カードはタブに入れない。**「いま」層に残す。毎日目に入ることに意味があるため
- **オトモン3枚もタブに入れない。**「きょう」層のタブの**外**、層の下端に常設。
  タブの裏に隠すと、卵の孵化やふれあいが忘れられる

**3の含意**: 三層化の目的は「優先度の差を作る」こと。自由な並べ替えは**その目的と正面から矛盾する**。
また、H-1 で作った複雑な仕組み（席・コメントノードの目印・`data-follows` 追従）が**まるごと消せる**。

---

## 2. 完成形

```text
【いま：フラット14枚】             【三層化のあと】

  ジャンル                          ┌─ 🎯 いま ─────────────────┐
  ⏱ タイマー ★本命                 │  ジャンル                   │
  はじめの一歩（新規のみ）           │  ⏱ タイマー ★本命           │
  今日のクエスト                     │  はじめの一歩（新規のみ）      │
  🥚 卵                             │  ⚔ 使命                     │
  ⚡ オトモンクエスト                └───────────────────────────┘
  🤝 お供                           ┌─ 📋 きょう ───────────────┐
  ⚔ 使命                            │ [クエスト][予定][打刻]  ←タブ │
  今日の予定                         │  ┌─────────────────────┐  │
  統計                              │  │ 選ばれたタブの中身だけ  │  │
  打刻                              │  └─────────────────────┘  │
  カレンダー                         │  🥚 卵 / ⚡ / 🤝  ←タブの外  │
                                    └───────────────────────────┘
  ぜんぶ同じ重さに見える              ┌─ 📚 ふりかえり ───────────┐
  ⠿ で自由に並べ替えできる           │  統計                       │
                                    │  カレンダー                  │
                                    └───────────────────────────┘
                                     層の順番は固定。並べ替えは無し
```

### DOM の形（目標）

```html
<div id="app">
  <header class="glass">…</header>

  <section class="home-layer" id="layer-now">
    <h2 class="layer-title">🎯 いま</h2>
    <!-- genre-card / timer-card / break-banner / onboard-card / mission-card -->
  </section>

  <section class="home-layer" id="layer-today">
    <h2 class="layer-title">📋 きょう</h2>
    <div class="layer-tabs" role="tablist">
      <button class="layer-tab" role="tab" data-tab="quest">クエスト</button>
      <button class="layer-tab" role="tab" data-tab="plan">予定</button>
      <button class="layer-tab" role="tab" data-tab="punch">打刻</button>
    </div>
    <div class="layer-panes">
      <div class="layer-pane" data-pane="quest"><!-- daily-quest-card --></div>
      <div class="layer-pane" data-pane="plan"><!-- today-plan-card --></div>
      <div class="layer-pane" data-pane="punch"><!-- punch-card --></div>
    </div>
    <div id="layer-today-always"><!-- オトモン3枚がここに入る（タブの外） --></div>
  </section>

  <section class="home-layer" id="layer-review">
    <h2 class="layer-title">📚 ふりかえり</h2>
    <!-- stats-strip / calendar-panel -->
  </section>
</div>
```

> ⚠️ **カードのDOMは動かすが、カードの中身とidは1文字も変えない。**
> `#daily-quest-card` などのidを他のJSが大量に参照している（`renderQuests` など）。
> **移動させるだけ。作り直さない。**

---

## 3. L-1：並べ替えの廃止（最初にやる・削除だけ）

**なぜ最初か**: 削除だけなので単独で成立し、壊れたら戻しやすい。
また、L-2 で層に分ける前に消しておかないと、**並べ替えのコードが層をまたいでカードを飛ばす**。

### 消すもの一覧

| 場所 | 消すもの |
|---|---|
| [boot.js:1222-1427](../scripts/boot.js:1222) | `initWidgetReorder()` の IIFE まるごと（コメント帯 1222行目から） |
| [index.html](../index.html) | `<div class="widget-grip" …>⠿</div>` 全7枚（genre / timer / daily-quest / mission / stats / punch / calendar） |
| [index.html:776-790](../index.html:776) | 設定モーダルの「ウィジェット並び順」`setting-group` まるごと（リセットボタン含む） |
| [app.css:60-89](../styles/app.css:60) | `/* ── ウィジェット ドラッグ並べ替え ── */` から `.widget.drop-hint` まで |
| [otomon.js](../scripts/otomon.js) 3か所 | `card.dataset.follows = 'daily-quest-card';`（1228 / 1466 / 1533 付近） |
| localStorage | `gq_widget_order` を起動時に一度だけ `removeItem`（残しても無害だが掃除する） |

### `class="widget"` はどうするか

**HTMLからも消す**（7枚）。並べ替え以外に使っていないことは確認済み
（`.widget` を見ているJSは `initWidgetReorder` の中だけ）。

### ⚠️ ここが唯一の罠：`#app .widget { padding-top: 30px }`

このCSSは「つまみ帯（⠿）の場所」を空けるためのもの。**消すと7枚の上余白が減る**。
ただし**7枚とも自前の padding を持っている**ので、中身が枠線に貼り付くことはない。

```text
カード          自前のpadding-top   30px を消した後
genre-card          12px      →  12px
timer-card          28px      →  28px
daily-quest-card    14px      →  14px
mission-card        14px      →  14px   (app.css:4519)
stats-strip         14px      →  14px
punch-card          14px      →  14px   (app.css:4519)
calendar-panel      14px      →  14px
```

むしろ**7枚 × 約16px ＝ 110px ほど縦が縮む**（＝ ロードマップ「STARTを画面内へ」に有利）。
[app.css:4516](../styles/app.css:4516) に「上端は #app .widget の padding-top:30px が優先される」という
**コメントが残っているので、これも同時に直すこと**（消したあとは嘘になる）。

### L-1 の受け入れ基準

- [x] ⠿ のつまみがホームから1つも見えない
- [x] 設定モーダルに「ウィジェット並び順」の行が無い
- [x] コンソールエラーゼロ（`reset-widget-order-btn` の `addEventListener` が消えていること）
- [x] 7枚のカードの中身が枠線に貼り付いていない（上余白がある）
- [x] **既に並べ替えて保存している人**が開いても、デフォルト順（index.html の記述順）で表示される
- [x] `localStorage.getItem('gq_widget_order')` が `null` になっている
- [x] オトモン3枚が「今日のクエスト」の直後にいる（`data-follows` を消しても、
      otomon.js は元々アンカーの `afterend` に注入しているので位置は変わらない）
- [x] `python3 tools/check_load_order.py` が通る ／ `bash tools/bump_version.sh` 実行済み

---

## 4. L-2：三層の骨組み（タブはまだ作らない）

`<section>` で囲んで見出しを付けるだけ。**この段階で「優先度の差」は既に出る。**

### 各層に入れるもの（index.html の記述順で）

```text
🎯 いま        genre-card, timer-card, break-banner, onboard-card, mission-card
📋 きょう      daily-quest-card, today-plan-card, punch-card
              （オトモン3枚は otomon.js が daily-quest-card の直後に注入する）
📚 ふりかえり  stats-strip, calendar-panel
```

> 💡 **使命カードを「いま」層の最後に置く理由**: 使命はタイマーより上に来てはいけない
> （STARTが画面外に押し出される）。かつ毎日目に入ってほしい。だから「いま」層の末尾。

### 見出しのCSS（軽く。層そのものは装飾しない）

```css
.home-layer { margin-bottom: 22px; }
.layer-title {
  font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  color: var(--text-dim); margin: 0 0 8px 4px;
}
```

> ⚠️ **層に `.glass` を付けて「箱の中に箱」にしないこと。** 二重の枠線で圧迫感が出る。
> 層は「見出し＋余白」だけで区切る。カード自体の見た目は今のまま変えない。

### 🚨 最大の罠：`#app` は flex。層で囲むとカード同士の隙間が消える（2026-08-05 レビューで実際に発生）

カード同士の 10px の隙間は、**カード自身の margin ではなく `#app` の flex gap** が作っている。

```css
#app { display: flex; flex-direction: column; gap: 10px; }   /* ← ここが隙間の正体 */
```

`.glass` の margin は **0px**。つまり `<section>` で囲むと、**gap は層と層の間にしか効かなくなり、
層の中のカードはピッタリくっつく**。

```text
【囲む前】                    【素朴に囲んだ後】
  統計                          統計
   ↕ 10px（#app の gap）        ↕ 0px      ← 枠線どうしが接触する
  カレンダー                    カレンダー
```

**層にも同じ flex を与えること。**

```css
.home-layer {
  display: flex; flex-direction: column; gap: 10px;   /* ← #app と同じ隙間を層の中にも */
  margin-bottom: 22px;
}
.layer-title {
  font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  color: var(--text-dim); margin: 0 0 0 4px;          /* 下余白は gap が作るので0 */
}
```

> 💡 **学び**: 「囲むだけだから安全」は成り立たない。**親が flex/grid のとき、
> 子を囲む行為はレイアウトの担い手を切り替える**。囲む前に親の `display` を見ること。

### ⚠️ 実在する副作用：`#app > .glass` のホバーが切れる

[app.css:2373-2374](../styles/app.css:2373) に**直下セレクタ**がある。

```css
#app > .glass { transition: border-color .25s, box-shadow .25s; }
#app > .glass:hover { border-color: rgba(255,255,255,.14); }
```

カードを `<section>` の中へ入れると **`#app` の直下ではなくなり、この2行が当たらなくなる**
（マウスを載せても枠線が光らない）。セレクタを次のように広げること:

```css
#app > .glass, #app .home-layer > .glass { transition: border-color .25s, box-shadow .25s; }
#app > .glass:hover, #app .home-layer > .glass:hover { border-color: rgba(255,255,255,.14); }
```

> 💡 直下セレクタ（`>`）は「箱で囲む」変更に弱い。**囲む前に `#app >` を全部grepすること。**
> 他に当たったのは `#app > header`（[boot.js:2670](../scripts/boot.js:2670) と
> [app.css:5280](../styles/app.css:5280)）だけで、**ヘッダーは層に入れないので影響なし**。

### ✅ 「層が空になったら隠す」は不要（2026-08-05 検算した）

初版では「表示カードが0枚の層は見出しごと隠す」と書いたが、**そのケースは起きない**。
どの層にも「常に表示されるカード」が最低1枚ある:

```text
🎯 いま        genre-card ✅常時 / timer-card ✅常時
📋 きょう      daily-quest-card ✅常時
📚 ふりかえり  stats-strip ✅常時 / calendar-panel ✅常時

条件付き表示なのは4枚だけ:
  onboard-card / mission-card / today-plan-card / punch-card
  （index.html に style="display:none" が付いているのはこの4枚だけ）
```

**この結果、L-2 は HTML と CSS だけで完結し、JSは1行も書かない。**

### L-2 の受け入れ基準

- [x] 3つの見出し「🎯 いま」「📋 きょう」「📚 ふりかえり」が出る
- [x] カードの順番が上の表のとおり
- [x] **層の中のカード同士に 10px の隙間がある**（枠線が接触していない）。**数値を報告すること**
      ```javascript
      const r=id=>document.getElementById(id).getBoundingClientRect();
      Math.round(r('calendar-panel').top - r('stats-strip').bottom)   // → 10 であること
      ```
- [x] **JSファイルを1つも変更していない**（変更が要ると思ったら §7 のとおり止まって報告）
- [x] カードにマウスを載せると枠線が光る（`#app > .glass` の修正ができている）
- [x] 375px で START が初回表示の画面内（上端 812px 以内）に収まる。**数値を報告すること**
- [x] 二重枠線になっていない（層に `.glass` を付けていない）
- [x] 設定モーダルなどを開いたとき、背後のホームが操作できない
      （`core.js` の `syncPageInert` が `#app` の子を見ている。層に変わっても効くはずだが、要確認）
- [x] コンソールエラーゼロ ／ `check_load_order.py` 通過 ／ `bump_version.sh` 実行済み

---

## 5. L-3：「きょう」層のタブ化 ＋ その日だけ記憶

### 5-1. どのファイルに書くか（⚠️ 掟2に直結）

**新規ファイル `scripts/home-layers.js` を作り、`core.js` の直後に読み込む。**

```text
areas → core → home-layers ← ここ → progression → quests → timer
  → settings-genre → calendar-review → features → boot → otomon
```

**理由**: タブの出し分けを **calendar-review.js（予定）と boot.js（打刻）の両方から呼ぶ**。
呼ばれる側が先に読まれていないと、掟2（ファイルをまたぐ読み込み時参照の禁止）に触れる。
起動フリーズ事故3回と同じ形なので、**ここは横着しないこと**。

### 🚨 5-1b. ファイルを1本増やすと sw.js も直す（忘れるとオフラインで起動しない）

[sw.js:8](../sw.js:8) の `PRECACHE_URLS` に**スクリプト10本が名指しで並んでいる**。
ここに載っていないファイルは事前キャッシュされない。sw.js のコメント自身が

> areas.js は core.js より前に読む土台。**ここに無いとオフラインで起動しない。**

と警告している。**2か所を直すこと。**

```javascript
const CACHE_NAME = 'gq-cache-v14';   // → 'gq-cache-v15' へ（古いキャッシュを捨てるため）

const PRECACHE_URLS = [
  ...
  './scripts/core.js',
  './scripts/home-layers.js',   // ← 追加（index.html の <script> と同じ並びで）
  './scripts/progression.js',
  ...
];
```

`index.html` の `<script>` にも、**`?v=guild-N` を付けて**追加する
（付け忘れると `bump_version.sh` の対象から漏れ、そのファイルだけ永遠に古いまま配られる。
かつて otomon.js が別系列の `?v=otomon-N` で置き去りになった事故と同じ形）。

公開するのは1つだけ:

```javascript
window.HomeTabs = { refresh };   // タブの表示可否を計算し直す
```

呼び出し側は必ず**オプショナル呼び出し**にする（未定義でも落とさない）:

```javascript
window.HomeTabs?.refresh();
```

### 5-2. タブの出し分け（⚠️ 表示のスイッチを2系統に分ける）

タブは**カードの表示状態に追従**する。カードが `display:none` ならタブも出さない。

| タブ | 出す条件 | 誰が display を触っているか |
|---|---|---|
| クエスト | 常に出す | （常時表示） |
| 予定 | `#today-plan-card` が表示中 | [calendar-review.js:196](../scripts/calendar-review.js:196) `renderHomePlanner()` |
| 打刻 | `#punch-card` が表示中 | [boot.js:729](../scripts/boot.js:729) `renderPunchBar()` |

**この2つの関数の末尾に `window.HomeTabs?.refresh();` を1行足す。**

**ここが L-3 でいちばん壊しやすい所**: カードの `style.display` は**既存のJSの持ち物**で、
「そもそもこのカードを出す資格があるか」を表している。タブの切り替えでこれを触ると、
`renderHomePlanner()` が次に走った瞬間に上書きされ、**タブが勝手に戻る**。

```text
系統①  style.display   … 既存JSの担当。「出す資格があるか」
        （手帳OFFなら none、予定が0件でも none、打刻が未解放なら none）
                ↑ home-layers.js は読むだけ。絶対に書かない

系統②  hidden 属性     … home-layers.js の担当。「いま選ばれているタブか」
        card.hidden = !(資格あり && そのタブが選択中)
```

2系統に分けておけば、どちらが後から走っても結果は同じになる。
判定は `card.style.display !== 'none'` で行う（`getComputedStyle` は
層ごと隠れたときに巻き込まれるので使わない）。

**タブが1つしか無いときは、タブバーごと出さない**（クエストだけの新規ユーザーで、
押せないボタンが1個だけ並ぶのは意味がない）。

### 5-2b. オトモン3枚の置き場所（設計判断・2026-08-06 クロが決定）

§1 の決定どおり**タブの外**に置く。ただし L-2 のあと、オトモン3枚は
`daily-quest-card` の直後（＝クエストタブの位置）に注入されている。このままだと
「予定」タブを開いたとき **オトモン3枚がタブの中身より上に居座る**。

**入れ物を1つ用意して、そこへ注入先を変える。**

```html
<!-- #layer-today の最後（打刻カードの後ろ）に置く -->
<div id="layer-today-always"></div>
```

```javascript
// otomon.js の3か所（injectHomeCard / injectQuestCard / injectBuddyCard）
const holder = document.getElementById('layer-today-always');
if (holder) holder.prepend(card);            // ← appendChild ではない。理由は下
else if (anchor) anchor.insertAdjacentElement('afterend', card);   // 既存の退避先
else (document.querySelector('main') || document.body).appendChild(card);
```

> ⚠️ **`prepend` でなければ、いまの並びが逆になる。**
> 注入は 卵 → クエスト → お供 の順に走るが（[otomon.js:1256](../scripts/otomon.js:1256) `injectAll`）、
> 現在は毎回「クエストカードの直後」に差し込むので、**後から入れたものが上に来る**。
> 結果、画面上は 🤝お供 → ⚡クエスト → 🥚卵 の順になっている。
> `prepend` はこれと同じ結果になるが、`appendChild` だと**上下が丸ごと逆になる**。

CSSも要る（層と同じ隙間を中にも作る。空のときは消す）:

```css
#layer-today-always { display: flex; flex-direction: column; gap: 10px; }
#layer-today-always:empty { display: none; }   /* 未解放の人に10pxの空白が残らないように */
```

### 5-3. 「その日だけ覚える」の作り方

新キー **`gq_home_tab`** に `{"date":"2026-08-05","tab":"plan"}` を保存。

```javascript
// 読むとき：日付が違えばクエストへ戻す
function loadTab() {
  try {
    const s = JSON.parse(localStorage.getItem('gq_home_tab'));
    if (s && s.date === todayKeyLocal() && s.tab) return s.tab;
  } catch {}
  return 'quest';
}
```

⚠️ **日付は端末ローカルで出すこと**（`toISOString()` はUTCなので、日本時間の朝9時前に
前日扱いになる）。既存の `todayKey()` と同じ作り方に揃える。
`todayKey()` は calendar-review.js 側にあり **home-layers.js より後に読まれる**ので、
**呼ばずに home-layers.js 内で自前に同じ計算を書く**（掟2）。

保存したタブが**今は出せない**（例：昨日は打刻を見ていたが今日は未解放）場合は、
**黙ってクエストへフォールバック**する。

### 5-4. 台帳と書き出し

- `gq_home_tab` を [architecture_review.md](architecture_review.md) §6 の台帳へ追記
  （分類は「その他」でよい）
- `exportAllData()` は `gq_` 接頭辞を自動で拾う（[settings-genre.js:106](../scripts/settings-genre.js:106)
  `isBackupKey`）ので**コード変更は不要**。台帳への追記だけ行う
- ついでに、**台帳から漏れていた `gq_widget_order` の行は追加せず**、
  L-1 で廃止した旨を台帳の下に1行残す

### 5-5. タブの見た目とアクセシビリティ

既存の `.genre-tabs`（[app.css:433](../styles/app.css:433) 付近）と揃える。新しい見た目を発明しない。

- `role="tablist"` / `role="tab"` / `aria-selected` / 選択中に `aria-controls`
- パネル側は `role="tabpanel"`、非選択は `hidden` 属性で消す（`display:none` を直に書かない）
- タップ領域は **24 x 24px 以上**（WCAG 2.5.8 AA。H-2 の訂正どおり 44px は要求しない）
- 文字は **10px 以上**、コントラスト **4.5 : 1 以上**

### L-3 の受け入れ基準

- [ ] 「きょう」層にタブが出て、押すと中身が切り替わる
- [ ] 手帳OFFの人に「予定」タブが出ない／打刻未解放の人に「打刻」タブが出ない
- [ ] タブが1つだけになる人（新規ユーザー）には**タブバーごと出ない**
- [ ] 予定を1件追加すると「予定」タブが**その場で**出る（リロード不要）
- [ ] 「予定」タブを開いてリロード → **予定タブのまま**
- [ ] 日付をまたぐと**クエストタブに戻る**（検証は §6 の手順4で日付を偽装する）
- [ ] 昨日見ていたタブが今日は出せない場合、クエストにフォールバックし、**エラーを出さない**
- [ ] タブのコントラストと文字サイズを**測って数値を報告**（4.5:1 以上 / 10px 以上）
- [ ] **オトモン3枚がタブの外・「きょう」層の下端**にあり、どのタブを開いても見える
- [ ] **オトモンの並びが 🤝お供 → ⚡クエスト → 🥚卵 のまま**（逆になっていない）
- [ ] オトモン未解放の人に、余分な空白が残っていない
- [ ] **タブを切り替えたあとに予定を1件足しても、開いていたタブが戻らない**
      （系統①と②の分離ができているか。§5-2 の最頻出バグ）
- [ ] `gq_home_tab` が台帳に載っている
- [ ] **`sw.js` の `PRECACHE_URLS` に `home-layers.js` が入り、`CACHE_NAME` が上がっている**
- [ ] **オフラインで起動する**（DevTools の Network を Offline にしてリロード）
- [ ] `index.html` の新しい `<script>` に `?v=guild-N` が付いている
- [ ] STARTの上端を 375px / 320px で測って報告（L-2 は 573px / 567px。**縮むはず**）
- [ ] `python3 tools/check_load_order.py` 通過（**新ファイルを足すので必ず実行**）
- [ ] コンソールエラーゼロ ／ `bash tools/bump_version.sh` 実行済み

---

## 6. テスト手順

1. `python3 -m http.server 8123` を run_in_background で立て、
   `http://localhost:8123/index.html` を開く
   （`preview_start` のサーバーはサンドボックス制約で全404）
2. **既存ユーザーの再現**（L-1 の検証に必須）
   ```javascript
   // 「並べ替えを保存済みの人」を作ってからリロードする
   localStorage.setItem('gq_widget_order', JSON.stringify(
     ['calendar-panel','stats-strip','timer-card','genre-card',
      'daily-quest-card','mission-card','punch-card']));
   ```
   → リロード後、**デフォルト順**（ジャンル→タイマー→…）で出ること
3. **普段隠れているカードを強制表示してから測る**
   ```javascript
   ['onboard-card','today-plan-card','mission-card','punch-card',
    'otomon-egg-card','otomon-quest-card','otomon-buddy-card']
     .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = ''; });
   ```
   隠れたままだと**症状が出ない**（H-1 のときに一度これで見落としている）
4. **日付またぎの検証**（L-3）
   ```javascript
   // 「昨日 打刻タブを見ていた人」を作る
   const y = new Date(Date.now() - 864e5);
   const k = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
   localStorage.setItem('gq_home_tab', JSON.stringify({ date: k, tab: 'punch' }));
   ```
   → リロードで**クエストタブ**が開いていること
5. **STARTの位置を測る**（ロードマップ フェーズ1-1 を壊していないか）
   ```javascript
   document.getElementById('start-btn').getBoundingClientRect().top  // 812 未満であること
   ```
   375px / 320px の両方で測り、**数値をそのまま報告する**
6. **新規ユーザー**: `localStorage.clear()` → リロード。起動すること・空の層の見出しが出ないこと
7. **条件付きの経路を必ず踏む**（⚠️ guild-141 の教訓）
   `localStorage.clear()` から始めるプレビューでは**踏めない経路がある**。
   最低でも「手帳ON」「打刻解放済み」「オトモン解放済み」「使命あり」の4条件を
   手で作ってから確認する
8. コンソールエラーがゼロであること
9. `python3 tools/check_load_order.py` → `bash tools/bump_version.sh`
   → push後 `curl -s https://yoz400.github.io/growth-quest/ | grep v=guild-`

---

## 7. 迷ったら止まって報告すること

- **カードを層へ移したら、そのカードを描く関数が動かなくなった**
  （どこかが `#app` の直下を前提にしている可能性がある。特に `insertAdjacentElement` 系）
- **otomon.js の3枚が「きょう」層の外に出てしまう / タブの中に入ってしまう**
  （otomon.js は `daily-quest-card` の `afterend` に注入する。クエストがタブの中に入ると
  **オトモンもタブの中に入る**。§1 の決定は「タブの外」なので、注入先の変更が要る。
  ここは設計判断なので、勝手に決めずに報告すること）
- **層で囲んだらCSSが崩れた**（`#app > .glass` のような直下セレクタが効かなくなる）
- 新規ユーザーで「きょう」層が空になり、見出しだけが残る
- タブの切り替えでカードの中身が消える・二重に描画される
- `check_load_order.py` が新ファイルで警告を出した（**絶対に無視しない**。
  起動フリーズ事故3回はすべてこの形）

---

## 8-2. Codexへの依頼文（L-2・ヨージがコピペする）

```text
docs/spec_home_three_layers.md の L-2（三層の骨組み）を実装してください。
§4 だけです。L-3（タブ化）には着手しないでください。

L-1（並べ替えの廃止）は完了済みです（?v=guild-146）。触らないでください。

■ やること
index.html の #app の中にあるホームのカードを、3つの <section> で囲みます。
いまは #app の直下にカードが平らに並んでいます。これを次の3つに分けます。
（行番号は現在の index.html。囲むだけで、カードの中身・id・class は1文字も変えません）

  <section class="home-layer" id="layer-now">      🎯 いま
      114行  genre-card
      120行  timer-card
      157行  break-banner
      166行  onboard-card
      186行  mission-card        ← いまは daily-quest-card の後にあるので、ここへ移動する

  <section class="home-layer" id="layer-today">    📋 きょう
      179行  daily-quest-card
      192行  today-plan-card
      218行  punch-card

  <section class="home-layer" id="layer-review">   📚 ふりかえり
      201行  stats-strip
      225行  calendar-panel

各 <section> の先頭に見出しを入れてください。

  <h2 class="layer-title">🎯 いま</h2>
  <h2 class="layer-title">📋 きょう</h2>
  <h2 class="layer-title">📚 ふりかえり</h2>

CSS（styles/app.css に追加）は §4 のとおりです。

  .home-layer { margin-bottom: 22px; }
  .layer-title {
    font-size: .72rem; font-weight: 700; letter-spacing: .08em;
    color: var(--text-dim); margin: 0 0 8px 4px;
  }

■ 注意点（ここが今回の肝です）

1. ヘッダー（<header class="glass">）と #login-bonus-overlay は層に入れません。
   #app の直下のままにしてください。boot.js と app.css に
   「#app > header」という直下セレクタがあり、囲むと壊れます。

2. app.css の 2373-2374行に「#app > .glass」の直下セレクタがあります。
   カードを section の中に入れると、この2行が当たらなくなり
   マウスを載せても枠線が光らなくなります。次のように広げてください。

     #app > .glass, #app .home-layer > .glass { transition: border-color .25s, box-shadow .25s; }
     #app > .glass:hover, #app .home-layer > .glass:hover { border-color: rgba(255,255,255,.14); }

3. section に .glass を付けないでください。カードも .glass なので、
   枠線の中に枠線ができて圧迫感が出ます。層は「見出し＋余白」だけで区切ります。

4. mission-card（使命）は「いま」層の最後に置きます。タイマーより上には
   絶対に置かないでください（STARTが画面外に沈みます）。

5. この作業で JavaScript は1行も変更しません。JSの変更が要ると思ったら、
   何かを読み違えている可能性が高いので、進めずに報告してください。

■ 検証（§6 の手順。数値をそのまま報告してください）

  python3 -m http.server 8123 を立て、http://localhost:8123/index.html を開く
  （preview_start のサーバーはサンドボックス制約で全404になります）

  ・375px と 320px で、START ボタンの上端が画面内（812px / 800px 未満）にあること
      document.getElementById('start-btn').getBoundingClientRect().top
  ・localStorage.clear() → リロードで、新規ユーザーとして起動すること
  ・設定モーダルを開いたとき、背後のホームが操作できないこと
    （core.js の syncPageInert が #app の子を見ています。層に変わっても
      効くはずですが、必ず目で確認してください）
  ・カードにマウスを載せると枠線が光ること
  ・コンソールエラーがゼロであること

■ 仕上げ

  python3 tools/check_load_order.py を実行（✅が出ること）
  bash tools/bump_version.sh を実行（?v=guild-N を一括+1。忘れると
  Service Worker が古いファイルを配り「直したのに直ってない」状態になります）
  日本語のコミットメッセージでコミットしてください。

§7 に当たったら、進めずに報告してください。特に
「カードを層へ移したら、そのカードを描く関数が動かなくなった」は
起こりうるので、無理に直そうとせず、そこで一度止めてください。
```

---

## 8-4. Codexへの依頼文（L-3・ヨージがコピペする）

```text
docs/spec_home_three_layers.md の L-3（「きょう」層のタブ化）を実装してください。
§5 です。三層化の最終段階で、L-1・L-2 は完了済みです（?v=guild-147）。

これまでの2段階と違い、今回は JavaScript を書きます。新しいファイルを1本足し、
新しい保存キーを1つ作ります。掟2（読み込み順）に直接触るので、
下の順番どおりに進めてください。

═══ 1. 新しいファイルを作る（掟2）

  scripts/home-layers.js を新規作成し、index.html で core.js の直後に読み込みます。

    areas → core → home-layers ← ここ → progression → quests → timer
      → settings-genre → calendar-review → features → boot → otomon

  なぜ core.js の直後かというと、この中の関数を calendar-review.js と boot.js
  （どちらも後から読まれる）から呼ぶからです。逆順にすると、GQで3回起きている
  起動フリーズと同じ形になります。

  公開するのは1つだけです。

    window.HomeTabs = { refresh };

  呼ぶ側は必ずオプショナル呼び出しにしてください（未定義でも落ちないように）。

    window.HomeTabs?.refresh();

  ⚠️ index.html の <script> には ?v=guild-N を必ず付けてください。
     付け忘れると bump_version.sh の対象から漏れ、そのファイルだけ
     永遠に古いまま配られます（otomon.js で実際に起きた事故です）。

═══ 2. sw.js も直す（忘れるとオフラインで起動しなくなる）

  sw.js の PRECACHE_URLS にスクリプトが名指しで10本並んでいます。
  ここに無いファイルは事前キャッシュされません。

    const CACHE_NAME = 'gq-cache-v14';   → 'gq-cache-v15' に上げる
    PRECACHE_URLS の './scripts/core.js' の直後に
    './scripts/home-layers.js' を追加する

═══ 3. タブを作る

  #layer-today（📋 きょう）の見出しの直後にタブバーを置きます。

    <div class="layer-tabs" id="today-tabs" role="tablist" aria-label="きょう">
      <button class="layer-tab" role="tab" data-tab="quest">📜 クエスト</button>
      <button class="layer-tab" role="tab" data-tab="plan">🗒 予定</button>
      <button class="layer-tab" role="tab" data-tab="punch">⏱ 打刻</button>
    </div>

  タブと中身の対応は次の3つです。
    quest → #daily-quest-card
    plan  → #today-plan-card
    punch → #punch-card

  見た目は既存の .genre-tabs（app.css の433行目付近）に揃えてください。
  新しいデザインを発明しないでください。
  文字は10px以上、コントラスト4.5:1以上、タップ領域24x24px以上です。
  aria-selected / role="tabpanel" / aria-labelledby も付けてください。

═══ 4. ⚠️ ここが今回いちばん壊しやすい所です

  カードの style.display は既存JSの持ち物で、「そもそもこのカードを出す
  資格があるか」を表しています（手帳OFF・予定0件・打刻未解放なら none）。
  タブの切り替えでこれを触ると、renderHomePlanner() が次に走った瞬間に
  上書きされ、タブが勝手に戻ります。

  スイッチを2系統に分けてください。

    系統① style.display … 既存JSの担当。home-layers.js は読むだけ、書かない
    系統② hidden 属性   … home-layers.js の担当

    card.hidden = !(資格あり && そのタブが選択中)
    資格あり = (card.style.display !== 'none')

  getComputedStyle は使わないでください（層ごと隠れたときに巻き込まれます）。

  タブの出し分けも同じ判定です。
    クエスト … 常に出す
    予定     … #today-plan-card に資格があるときだけ
    打刻     … #punch-card に資格があるときだけ
  出せるタブが1つだけのときは、タブバーごと出さないでください
  （新規ユーザーに、押せないボタンが1個だけ並ぶのは無意味です）。

  再計算のきっかけとして、次の2か所の末尾に1行ずつ足してください。
    scripts/calendar-review.js の renderHomePlanner()（196行目付近）
    scripts/boot.js の renderPunchBar()（729行目付近）
      → window.HomeTabs?.refresh();

═══ 5. その日だけ覚える

  新しいキー gq_home_tab に {"date":"2026-08-06","tab":"plan"} を保存します。
  読むときに日付が今日と違えば、クエストタブに戻します。

  ⚠️ 日付は端末ローカルで作ってください。toISOString() はUTCなので、
     日本時間の朝9時前に前日扱いになります。
  ⚠️ calendar-review.js の todayKey() は home-layers.js より後に読まれるので、
     呼ばずに home-layers.js の中で同じ計算を自前で書いてください（掟2）。

  保存されたタブが今日は出せない場合（昨日は打刻を見ていたが今日は未解放など）は、
  黙ってクエストにフォールバックしてください。エラーにしないでください。

  docs/architecture_review.md §6 の台帳（119行目付近の「その他」の行）に
  gq_home_tab を追記してください。exportAllData() は gq_ 接頭辞を自動で拾うので、
  コードの変更は不要です。

═══ 6. オトモン3枚の置き場所

  オトモン3枚はタブの外に置きます（タブの裏に隠すと卵の孵化が忘れられるため、
  ヨージの決定です）。いまは daily-quest-card の直後＝クエストタブの位置に
  注入されているので、「予定」タブを開くとオトモンが中身より上に居座ります。

  入れ物を1つ作って、注入先を変えてください。

    index.html … #layer-today の最後（打刻カードの後ろ）に
                 <div id="layer-today-always"></div>

    otomon.js の3か所（injectHomeCard / injectQuestCard / injectBuddyCard）

      const holder = document.getElementById('layer-today-always');
      if (holder) holder.prepend(card);
      else if (anchor) anchor.insertAdjacentElement('afterend', card);
      else (document.querySelector('main') || document.body).appendChild(card);

  ⚠️ prepend です。appendChild にすると3枚の上下が丸ごと逆になります。
     注入は 卵 → クエスト → お供 の順に走りますが、現在は毎回
     「クエストカードの直後」に差し込むため、後から入れたものが上に来ます。
     画面上は 🤝お供 → ⚡クエスト → 🥚卵 の順です。prepend はこれと
     同じ結果になります。実装後、この並びを目で確認してください。

    app.css …
      #layer-today-always { display: flex; flex-direction: column; gap: 10px; }
      #layer-today-always:empty { display: none; }

  :empty が無いと、オトモン未解放の人に10pxの空白が残ります。

═══ 7. 検証（§6 の手順。数値をそのまま報告してください）

  python3 -m http.server 8123 を立て、http://localhost:8123/index.html を開く
  （preview_start のサーバーはサンドボックス制約で全404になります）

  ⚠️ 測る前に、必ず ?v= が上がった状態で確認してください。バージョンが
     古いままだと Service Worker が古いファイルを配り、測定値が
     合否どちらの証拠にもなりません（L-2 のレビューで実際に起きました）。

  ・タブを押すと中身が切り替わる
  ・新規ユーザー（localStorage.clear() → リロード）でタブバーが出ない
  ・予定を1件追加すると「予定」タブがリロード無しでその場に出る
  ・「予定」タブを開いてリロード → 予定タブのまま
  ・タブを切り替えたあとに予定を1件足しても、開いていたタブが戻らない
    （§4 の2系統分離ができているかの確認。ここが最頻出バグです）
  ・日付をまたぐとクエストタブに戻る。次のコードで昨日の状態を作れます

      const y = new Date(Date.now() - 864e5);
      const k = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
      localStorage.setItem('gq_home_tab', JSON.stringify({ date: k, tab: 'punch' }));

  ・オトモン3枚がどのタブでも見え、並びが 🤝 → ⚡ → 🥚 のまま
  ・オフラインで起動する（DevToolsのNetworkをOfflineにしてリロード）
  ・STARTの上端を375pxと320pxで測る（L-2は573px / 567px。縮むはずです）
  ・タブのコントラストと文字サイズを測る（4.5:1以上 / 10px以上）
  ・コンソールエラーがゼロ

═══ 8. 仕上げ

  python3 tools/check_load_order.py（新ファイルを足すので必ず実行。✅が出ること）
  bash tools/bump_version.sh
  日本語のコミットメッセージでコミット

§7 に当たったら、進めずに報告してください。特に
「タブを切り替えたらカードの中身が消えた／二重に描画された」は
起こりやすいので、無理に直そうとせず、そこで一度止めてください。
```

---

## 8-3. Codexへの依頼文（L-2 の差し戻し・ヨージがコピペする）

```text
docs/spec_home_three_layers.md の L-2 をレビューしました。
構造は仕様どおりで正しいです。直すのは2点だけです。作り直す必要はありません。

【1】層の中のカード同士の隙間が 0px になっています（実害あり）

カード同士の 10px の隙間は、カード自身の margin ではなく
#app の flex gap が作っていました。

  #app { display: flex; flex-direction: column; gap: 10px; }
  .glass の margin は 0px

section で囲んだことで、gap が「層と層の間」にしか効かなくなり、
層の中のカードは枠線どうしが接触しています（統計とカレンダーで確認）。

styles/app.css の .home-layer と .layer-title を次のようにしてください。

  .home-layer {
    display: flex; flex-direction: column; gap: 10px;
    margin-bottom: 22px;
  }
  .layer-title {
    font-size: .72rem; font-weight: 700; letter-spacing: .08em;
    color: var(--text-dim); margin: 0 0 0 4px;
  }

layer-title の下余白を 8px から 0 にしているのは、gap:10px が
その役目をするようになるためです（8px を残すと18px空きます）。

確認は次のコードで、10 が出ることを報告してください。

  const r=id=>document.getElementById(id).getBoundingClientRect();
  Math.round(r('calendar-panel').top - r('stats-strip').bottom)   // → 10

【2】bash tools/bump_version.sh が実行されていません

index.html は ?v=guild-146 のままです。CSSとHTMLを変えたのに
バージョンが上がっていないので、既存ユーザーには Service Worker が
古い app.css を配り続けます。

これは実際に起きました。レビュー中、私の環境では

  見出しの文字サイズ  24px（本来 11.5px）
  .home-layer の余白  0px（本来 22px）

となり、新しいCSSがまったく効いていませんでした。原因は
キャッシュで、Service Worker を手で消したら正しく表示されました。
実ユーザーにも同じことが起きます。

【3】そのあと

  python3 tools/check_load_order.py（✅が出ること）
  bash tools/bump_version.sh
  日本語のコミットメッセージでコミット

なお、今回の変更はまだコミットされていません（作業ツリーに未コミットの
まま残っています）。上の2点を直してから、まとめて1つのコミットにしてください。

■ レビューで合格している項目（触らないでください）

  ・3つの section の構造とカードの割り当て（仕様どおり）
  ・mission-card が「いま」層の末尾、punch-card が「きょう」層
  ・オトモン3枚が「きょう」層のクエスト直後に入っている
  ・ヘッダーと #login-bonus-overlay が #app 直下のまま
  ・#app > .glass のホバー修正
  ・JSの変更ゼロ
  ・設定モーダルを開くと層に inert が付き、背後が操作できない
  ・START の上端  375px で 522px / 320px で 555px（画面内）
  ・見出し 11.52px・コントラスト 5.85 : 1
  ・横スクロールなし・コンソールエラーゼロ・check_load_order.py ✅
```

---

## 8. Codexへの依頼文（L-1・完了済み。記録として残す）

```text
docs/spec_home_three_layers.md の L-1（並べ替えの廃止）を実装してください。
§3 だけです。L-2 と L-3 には着手しないでください。

やることは削除だけです。消すものは §3 の表に全部書いてあります。
scripts/boot.js の initWidgetReorder（1222〜1427行）をまるごと、
index.html の ⠿ グリップ7枚と設定モーダルの「ウィジェット並び順」グループ、
styles/app.css の並べ替え用CSS（60〜89行）、
scripts/otomon.js の dataset.follows 3か所です。
class="widget" も HTML から消してください（並べ替え以外で使っていないことは確認済みです）。

⚠️ 罠が1つあります。#app .widget { padding-top: 30px } を消すと7枚の上余白が
減りますが、7枚とも自前の padding を持っているので中身が枠線に貼り付くことは
ありません（§3 の表）。app.css の 4516行目付近に「上端は #app .widget の
padding-top:30px が優先される」というコメントが残っているので、
そこも同時に直してください（消した後は嘘になります）。

起動時に localStorage の gq_widget_order を一度だけ removeItem してください。

検証は §6 の手順2が肝です。「既に並べ替えを保存している人」を作ってから
リロードし、デフォルト順で表示されることを確認してください。
手順3でオトモン3枚を強制表示し、今日のクエストの直後にいることも見てください。

§3 の受け入れ基準を全部満たしたら python3 tools/check_load_order.py を実行し、
bash tools/bump_version.sh を実行して、日本語のコミットメッセージでコミットしてください。
§7 に当たったら、進めずに報告してください。
```

---

## 9. 実装記録

### ✅ L-2 完了（2026-08-05 Codexが実装・クロがレビュー）`?v=guild-147`

差し戻し2件をCodexが修正し、再レビューで合格した。

| 再レビュー項目 | 結果 |
|---|---|
| 層の中のカード同士の隙間 | ✅ **10px**（統計↔カレンダー・ジャンル↔タイマーとも） |
| 見出しと最初のカードの間 | ✅ 10px（`gap` が担当。`margin-bottom` は 0 に） |
| 層と層の間 | ✅ 32px（`gap:10px` ＋ `margin-bottom:22px`） |
| `?v=guild-147` | ✅ 更新済み（`app.css?v=guild-147` が届いていることを確認） |
| 3層の構造・カードの割り当て | ✅ 修正前から変わっていない |
| モーダル背後の `inert` | ✅ 3層とも付く |
| STARTの上端（375 / 320px） | ✅ **573px / 567px**（画面内） |
| 新規ユーザー（`localStorage.clear()`） | ✅ 起動する・3層とも生成される |
| 横スクロール・コンソールエラー・`check_load_order.py` | ✅ なし / ゼロ / 通過 |

**STARTは L-1 の 513px から 573px へ 60px 下がった**（見出し3本と層の余白のぶん）。
画面の高さ 812px には収まっており、ロードマップ フェーズ1-1 は維持できている。
ただし**L-3 でタブに畳めば「きょう」層が縮む**ので、そこで取り返せる見込み。

---

#### レビュー1回目の記録（差し戻し2件）

Codex の実装は**構造としては仕様どおり**。差し戻したのは仕上げの2点で、作り直しは不要。

| 項目 | 結果 |
|---|---|
| 3層の構造・カードの割り当て | ✅ 仕様どおり |
| mission が「いま」層末尾／punch が「きょう」層 | ✅ |
| オトモン3枚が「きょう」層のクエスト直後 | ✅ |
| ヘッダーと login-bonus-overlay が `#app` 直下 | ✅ |
| `#app > .glass` ホバーの修正 | ✅ |
| JS変更ゼロ | ✅ |
| モーダルを開くと層に `inert` が付く | ✅ |
| START上端（375 / 320px） | ✅ 522px / 555px |
| 見出し 11.52px・コントラスト 5.85 : 1 | ✅ |
| 横スクロール・コンソールエラー・`check_load_order.py` | ✅ なし / ゼロ / 通過 |
| **層の中のカード同士の隙間** | ❌ **0px**（本来10px。枠線が接触） |
| **`bump_version.sh`** | ❌ **未実行**（`?v=guild-146` のまま） |

**差し戻し①は仕様書の落ち度**。`#app` が `display:flex; gap:10px` で隙間を作っていることを
仕様に書いていなかった。§4 に「最大の罠」として追記した（依頼文は §8-3）。

**差し戻し②は掟1**。レビュー中に私自身が踏み、見出しが 24px・層の余白 0px と表示された。
Service Worker を手で消して初めて正しい値が出た。**実ユーザーに起きる症状そのもの**。

> 💡 **学び: レビューは「新しいファイルが本当に届いているか」から始める。**
> 最初の測定値（24px / 0px）は実装の失敗に見えたが、実際は**キャッシュ越しに
> 古いCSSを測っていた**。バージョンが上がっていない状態での測定値は、
> 合否どちらの証拠にもならない。**測る前に `?v=` を確認する。**

### ✅ L-1 完了（2026-08-05 クロが実装・検証）`?v=guild-146`

削除だけなので、仕様どおりに進んで詰まる所は無かった。**283行減って33行増えた。**

| 消したもの | 場所 |
|---|---|
| `initWidgetReorder()` 約200行 | scripts/boot.js |
| ⠿ グリップ 7枚 ＋ `class="widget"` 7か所 ＋ 設定の「ウィジェット並び順」 | index.html |
| `.widget` / `.widget-grip` / `.dragging` / `.drop-hint` | styles/app.css |
| `dataset.follows` 3か所 | scripts/otomon.js |

**測った結果**

| 検証 | 結果 |
|---|---|
| 並べ替えを保存済みの人が開く | デフォルト順。`gq_widget_order` は `null` に掃除された |
| オトモン3枚の位置 | 「今日のクエスト」の直後（`afterend` 注入なので `data-follows` 無しでも変わらない） |
| カードの上余白 | 12〜28px。枠線に貼り付いたカードは無し |
| STARTの上端（新規・375px） | **561px → 513px**（つまみ帯の30pxが7枚ぶん消えたため） |
| 320px | 横スクロールなし・START 508px |
| コンソールエラー | ゼロ（新規ユーザー・既存ユーザーの両方） |
| `check_load_order.py` | ✅ 問題なし |

> 💡 **学び: 掟1（bump_version）を踏んだ。**
> 検証の途中で「`gq_widget_order` が消えない」という結果が出た。原因は
> **Service Worker が旧 boot.js を配っていた**こと。HTMLは新しいのにJSだけ古い、
> という混ざった状態だった。`bash tools/bump_version.sh` を先に実行してから
> 検証すれば起きない。**「直したのに直ってない」は、まずバージョンを疑う。**
