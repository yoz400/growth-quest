# 仕様書：ホームの三層化（H-3 / ロードマップ フェーズ4の本題）

作成: 2026-08-05 ／ 設計: クロ（Opus 5）／ 実装担当: 未定（Codex or クロ）
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

- [ ] ⠿ のつまみがホームから1つも見えない
- [ ] 設定モーダルに「ウィジェット並び順」の行が無い
- [ ] コンソールエラーゼロ（`reset-widget-order-btn` の `addEventListener` が消えていること）
- [ ] 7枚のカードの中身が枠線に貼り付いていない（上余白がある）
- [ ] **既に並べ替えて保存している人**が開いても、デフォルト順（index.html の記述順）で表示される
- [ ] `localStorage.getItem('gq_widget_order')` が `null` になっている
- [ ] オトモン3枚が「今日のクエスト」の直後にいる（`data-follows` を消しても、
      otomon.js は元々アンカーの `afterend` に注入しているので位置は変わらない）
- [ ] `python3 tools/check_load_order.py` が通る ／ `bash tools/bump_version.sh` 実行済み

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

### ⚠️ 罠：カード全体が非表示のときに見出しだけ残る

「きょう」層は、新規ユーザーだと**クエストしか無い**（予定＝手帳OFF、打刻＝未解放）。
「ふりかえり」層は常に2枚あるので問題ない。
**層の中に表示中のカードが1枚も無ければ、層ごと隠す**こと（見出しだけが浮くのは事故に見える）。

### L-2 の受け入れ基準

- [ ] 3つの見出し「🎯 いま」「📋 きょう」「📚 ふりかえり」が出る
- [ ] カードの順番が上の表のとおり
- [ ] 375px で START が初回表示の画面内（上端 812px 以内）に収まる。**数値を報告すること**
- [ ] 新規ユーザー（`localStorage.clear()` → リロード）で、中身が空の層の見出しが出ていない
- [ ] 二重枠線になっていない
- [ ] コンソールエラーゼロ ／ `check_load_order.py` 通過 ／ `bump_version.sh` 実行済み

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

公開するのは1つだけ:

```javascript
window.HomeTabs = { refresh };   // タブの表示可否を計算し直す
```

呼び出し側は必ず**オプショナル呼び出し**にする（未定義でも落とさない）:

```javascript
window.HomeTabs?.refresh();
```

### 5-2. タブの出し分け

タブは**カードの表示状態に追従**する。カードが `display:none` ならタブも出さない。

| タブ | 出す条件 | 誰が display を触っているか |
|---|---|---|
| クエスト | 常に出す | （常時表示） |
| 予定 | `#today-plan-card` が表示中 | [calendar-review.js:196](../scripts/calendar-review.js:196) `renderHomePlanner()` |
| 打刻 | `#punch-card` が表示中 | [boot.js:729](../scripts/boot.js:729) `renderPunchBar()` |

**この2つの関数の末尾に `window.HomeTabs?.refresh();` を1行足す。**

判定は「そのカードの `style.display` が `'none'` でないか」で行う。
`getComputedStyle` は層ごと隠したときに巻き込まれるので使わない。

**タブが1つしか無いときは、タブバーごと出さない**（クエストだけの新規ユーザーで、
押せないボタンが1個だけ並ぶのは意味がない）。

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
- [ ] `gq_home_tab` が台帳に載っている
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

## 8. Codexへの依頼文（L-1・ヨージがコピペする）

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

（ここに各段階の完了記録を追記する）
