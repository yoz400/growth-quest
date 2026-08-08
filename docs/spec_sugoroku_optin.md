# 仕様書：すごろくを「自分で振りに行く」形にする

作成: 2026-08-06 ／ 著者: クロ（Opus 5）
対象: `scripts/timer.js` `scripts/core.js` `index.html` `styles/app.css`
関連: `docs/team/roadmap.md`（機能判断の4基準） `docs/spec_world_map.md`

---

## 1. 背景（なぜやるか）

### 判断基準3に抵触している

ロードマップに確定記載した4基準のうち、3番目はこうです。

> **集中直後の余韻を奪わないか。** 報酬演出の渋滞は楽しさではなく騒音になる。

いま、25分の集中を終えた**直後に、頼んでいないのにサイコロが自動で振られます**。
一番集中の余韻が残っている瞬間を、盤面の演出が奪っています。

```text
【いま】
  集中を終える
      ↓ 0秒
  告（達成の演出）が開く
      ↓ その中で
  🎲 サイコロが勝手に回り始める → マスのイベント → 報酬
      ↑ ユーザーは何も選んでいない
```

### すごろく自体は「悪」ではない（重要）

監査レポート `docs/team/review_devil.md` は「すごろくは学習と因果ゼロ」と断じていますが、
**コードを読むとこれは誤りです。** 出目は学習のしかたで変わります。

| モード | 出目 |
|--------|------|
| 🍅 ポモドーロ | 1〜3 |
| 🔵 ディープ | 2〜5 |
| 🌊 フロー | 1〜(集中分数÷10、最大10) |
| 途中でやめた | 分数に応じて控えめ（完走時の最大より必ず1少ない） |

**努力の量はちゃんと反映されています**（`rollDice()` core.js）。
したがって**すごろくは残します。** 直すのは「勝手に始まる」ことだけです。

---

## 2. 変更後の姿

```text
【これから】
  集中を終える
      ↓
  告は集中の余韻だけ（サイコロは回らない）
  静かに1行だけ:「🎲 すごろくを1回振れる（あと 3 回）」
      ↓ ユーザーが好きなときに
  🎲すごろくを開く → [ 🎲 振る（あと3回）] を押す
      ↓
  サイコロ → コマが歩く → マスのイベント → 報酬
```

**要点は「報酬を減らさない。タイミングをユーザーに返すだけ」**です。

---

## 3. 設計

### 3.1 データ：振れる権利（チケット）

`sugorokuData`（localStorage キー `gq_sugoroku`）に **`tickets` 配列**を追加します。

```js
// 追加後の形
{ pos: 0, stage: 1, items: [], initialized: false,
  tickets: [ { mode: 'pomodoro', mins: 25, partial: false, at: 1754400000000 } ] }
```

- **新しい localStorage キーは作りません。** `gq_sugoroku` は既に台帳（§6）にあり
  エクスポート対象なので、掟5の3点セットは追加作業なしで満たされます
- `mode` `mins` `partial` を保存する理由：出目の範囲がこの3つで決まるため
  （後で振っても「そのとき何をしたか」が正しく反映される）
- **上限は10枚**。超えたら古いものから捨てる。
  20回ぶん溜まると消化が作業になり、判断基準3に逆戻りするため

```js
const SG_TICKET_MAX = 10;
```

### 3.2 `timer.js`：自動で振るのをやめる

現在3か所で `doSugorokuRoll()` を呼んでいます。**すべてチケット付与に置き換え**ます。

| 行 | 現在 | 変更後 |
|----|------|--------|
| 306 | `doSugorokuRoll(currentMode, mins)`（フロー完了） | `grantSugorokuTicket(currentMode, mins, false)` |
| 314 | `doSugorokuRoll(currentMode, mins, true)`（途中停止） | `grantSugorokuTicket(currentMode, mins, true)` |
| 432 | `doSugorokuRoll(currentMode, mins)`（完走） | `grantSugorokuTicket(currentMode, mins, false)` |

あわせて、3か所の直後にある次の2行を**削除**します。

```js
pendingSugorokuRoll = _sgResult;   // ← 削除
addBonusXP(_sgResult.bonusXP);     // ← 削除（XPは振ったときに入る）
```

さらに `timer.js:611-613` の**告へのサイコロ差し込みを削除**します。

```js
if (pendingSugorokuRoll) {          // ← このブロックごと削除
  showSugorokuInKoku(pendingSugorokuRoll);
  pendingSugorokuRoll = null;
}
```

> ⚠️ `pendingSugorokuRoll`（core.js:12 の宣言、556 の初期化）と
> `showSugorokuInKoku()`（core.js:2442〜）は**削除しないで残してください**。
> 参照が0になりますが、告の中でサイコロを見せたくなったとき戻せるようにするためです。
> 削除の判断はヨージが行います。**勝手に消さないこと。**

### 3.3 `core.js`：チケットの付与と消化

```js
// 振れる権利を1枚渡す（セッション完了時に呼ばれる）
function grantSugorokuTicket(mode, mins, partial) {
  if (!Array.isArray(sugorokuData.tickets)) sugorokuData.tickets = [];
  sugorokuData.tickets.push({ mode, mins, partial: !!partial, at: Date.now() });
  // 溜まりすぎると消化が作業になる。古いものから捨てる
  while (sugorokuData.tickets.length > SG_TICKET_MAX) sugorokuData.tickets.shift();
  saveSugorokuData();
  renderSugorokuTicketBadge();
  return sugorokuData.tickets.length;
}

// 残り枚数
function getSugorokuTicketCount() {
  return Array.isArray(sugorokuData.tickets) ? sugorokuData.tickets.length : 0;
}

// 1枚使って振る（盤面の「振る」ボタンから呼ばれる）
function rollSugorokuFromTicket() {
  if (!Array.isArray(sugorokuData.tickets) || !sugorokuData.tickets.length) return null;
  const t = sugorokuData.tickets.shift();
  saveSugorokuData();
  const result = doSugorokuRoll(t.mode, t.mins, t.partial);
  addBonusXP(result.bonusXP);      // XPはここで入る
  renderSugorokuTicketBadge();
  return result;
}
```

**`doSugorokuRoll()` の中身は一切変更しません。** 既に
`sgPendingWalk = { fromPos, rollTime }`（core.js:1256）を立てるので、
`renderBoard()` がコマの歩行アニメを再生します。**その仕組みをそのまま使います。**

### 3.4 盤面UI：「振る」ボタン

`index.html` の `#board-body`（437行〜）の**いちばん上**、
`<!-- ① RPG冒険マップ エリアビュー -->` の**直前**に差し込みます。

```html
      <!-- ⓪ 振れる権利（集中を終えるたびに1枚たまる） -->
      <div id="board-roll-section">
        <button id="board-roll-btn" class="board-roll-btn">
          <span class="brb-dice">🎲</span>
          <span class="brb-label">振る</span>
          <span class="brb-count" id="board-roll-count">0</span>
        </button>
        <div class="board-roll-hint" id="board-roll-hint">
          集中を1回終えるごとに1回振れます
        </div>
      </div>
```

挙動：

- チケット0枚のときはボタンを `disabled` にし、文言を
  **「集中を終えると振れます」**にする（隠さない。何をすれば振れるか伝えるため）
- 押すと `rollSugorokuFromTicket()` → `renderBoard()`。
  歩行アニメ中（`sgAnimating === true`）は**押せないようにする**（多重発火の防止）
- 振った結果のメッセージは、**既存のエリアビューの下**に1行で出す
  （告の中の派手な演出は移設しません。盤面では静かに）

### 3.5 ヘッダーの🎲ボタンに枚数バッジ

**ボタンは増やしません。** 既存の `#board-btn` の右上に小さな数字を出すだけです。

```html
<!-- #board-btn の中、既存の span 2つの後ろに追加 -->
<span class="icon-btn-badge" id="board-ticket-badge" style="display:none">0</span>
```

`renderSugorokuTicketBadge()` が枚数を反映し、0枚なら `display:none`。

> **なぜバッジを付けるか**: ロードマップの目的「毎日開きたくなる」に効くため。
> ただし**ヘッダーのボタン数は増やさない**（ヨージの明示的な要望）。

### 3.6 告に出す1行

`showKoku()`（timer.js）の結果表示に、既存の `firstLine` と同じ形式で1行足します。

```js
const ticketLine = getSugorokuTicketCount() > 0
  ? `<span class="koku-ticket">🎲 すごろくを振れます（あと ${getSugorokuTicketCount()} 回）</span><br>`
  : '';
```

**押せるボタンにはしません。** 告は集中の余韻の場所であり、
ここから次の操作へ誘導すると、結局いまと同じ「余韻を奪う」形になるためです。

### 3.7 CSS

`styles/app.css` に追加（既存の `.board-*` の並びに置く）。

- `.board-roll-btn` … 盤面の主役ボタン。`#start-btn` に準じた存在感
- `.board-roll-btn:disabled` … 彩度を落とす。押せないことが見て分かる
- `.brb-count` … 丸い数字バッジ
- `.icon-btn-badge` … ヘッダーボタンの右上に絶対配置（`#board-btn` に `position:relative` が要る）
- `.koku-ticket` … 告の1行。`.koku-first-bonus` と同じ控えめさ

---

## 4. やらないこと（スコープ外）

- `showSugorokuInKoku()` と `pendingSugorokuRoll` の**削除**（残す。§3.2の警告参照）
- マスの中身・出目の確率・報酬額の変更（別件）
- すごろく自体の廃止（**しません**。§1参照）
- 40マスの「順調に進んでいます」の文言（次の仕様書で扱う）

---

## 5. 受け入れ基準

- [x] 集中を終えても**サイコロが自動で回らない**。告にサイコロの演出が出ない
- [x] 告に「🎲 すごろくを振れます（あと N 回）」が1行出る（0枚のときは出ない）
- [x] すごろくを開くと最上部に「🎲 振る」ボタンがあり、残り枚数が出ている
- [x] 押すと1枚減り、サイコロ→コマの歩行→マスのイベント→報酬が**従来どおり**動く
      ※歩行アニメはマス目を開いているときのみ（既定は畳んだ状態）。§9-B 参照
- [x] XPは**振ったときに**入る（セッション完了時には入らない）
- [x] 0枚のときボタンは押せず、「集中を終えると振れます」と出る
- [x] 歩行アニメ中は押せない（連打しても二重に進まない）※3連打で消費1枚を実測
- [x] チケットは11枚目から古いものが捨てられ、最大10枚で頭打ち ※15回付与→10枚を実測
- [x] ヘッダーの🎲ボタンに枚数バッジが出る（0枚なら消える）。**ボタンは増えていない**
- [x] `python3 tools/check_load_order.py` が通る
- [x] コンソールエラーゼロ
- [x] `bash tools/bump_version.sh` を実行した（guild-153・12か所すべて一致）

---

## 6. テスト手順

1. `python3 -m http.server 8123` を立て、`http://localhost:8123/index.html` を開く
2. DevToolsで `localStorage.clear()` → リロード → 召喚をスキップ
3. フローモードで **1分以上**集中 → 停止
   - 告にサイコロが**出ない**こと
   - 告に「🎲 すごろくを振れます（あと 1 回）」が出ること
   - ヘッダー🎲に「1」のバッジが出ること
4. 🎲すごろくを開く → 「振る 1」ボタンを押す
   - サイコロが回り、コマが歩き、マスのイベントが出ること
   - XPが増えること（ヘッダーのXPゲージで確認）
   - ボタンが「0」になり押せなくなること
5. 連打テスト：チケットを2枚以上ためて、**歩行アニメ中に連打**しても
   二重に進まないこと
6. 上限テスト：DevToolsで
   `sugorokuData.tickets.length` が11以上にならないことを確認
7. リロードしてもチケット枚数が保持されていること（`gq_sugoroku` に入っている）
8. 設定 → エクスポート → JSON内の `gq_sugoroku` に `tickets` が含まれること

---

## 7. 迷ったら止まって報告

- `doSugorokuRoll()` の中身を変えないと実装できないと感じたら、**手を止めて報告**。
  ここは大陸図・アイテム・オトモンの卵まで繋がっている中枢で、
  過去に「1つの変数を2つの用途に兼用していた」バグ（`a13cacd`）が出ている
- 告のレイアウトが崩れる場合も報告（`showKoku` は5引数に増えた経緯がある）
- チケットが古いデータに無い場合（`tickets` が `undefined`）の初期化漏れに注意。
  **必ず `Array.isArray()` で確認してから触ること**

---

## 8. Codex への依頼文（コピペ用）

```text
Growth Quest（~/Desktop/claude-practice）で、すごろくを「自分で振りに行く」形に変えてください。

まず docs/spec_sugoroku_optin.md を読んでください。仕様はすべてそこに書いてあります。
チャットの履歴は見えなくてよいように、必要な情報は全部その1枚に入っています。

背景だけ先に伝えます。いまは集中を終えた直後にサイコロが自動で回り、
一番余韻が残っている瞬間を演出が奪っています。すごろく自体は残します
（出目は学習のしかたで変わるので、努力とちゃんと繋がっています）。
変えるのは「勝手に始まる」ことだけです。

作業は §3 の順（データ → timer.js → core.js → UI → CSS）で進め、
§5 の受け入れ基準を全部満たしてから報告してください。
§4「やらないこと」と §7「迷ったら止まって報告」を必ず守ってください。
特に、参照が0になる showSugorokuInKoku() と pendingSugorokuRoll は
削除せず残してください（戻せるようにしておきたいため）。

終わったら bash tools/bump_version.sh を実行し、
python3 tools/check_load_order.py が通ることを確認してください。
```

---

## 9. レビュー記録

**2026-08-07 クロ（Opus 5）／判定：合格（受け入れ基準12項目すべて実測で確認）**

プレビュー（`localhost:8123`・375×812 と 1280×720 の両方）で §6 のテスト手順を実行。
§3 の設計どおりに実装され、§4「やらないこと」も守られている
（`pendingSugorokuRoll`・`showSugorokuInKoku()` は削除されず残っている）。

仕様書に無い改善が1点入っており、これは**良い判断**として採用する。
出目メッセージに含まれる `<br>` を ` ／ ` に置換して1行に畳んでいる
（`quietMessage`, core.js の click ハンドラ）。§3.4「1行で出す」を守るために必要だった。

### 以下は不合格ではない。次に触るときの申し送り

**A. `#board-roll-result` が閉じて開き直しても前回の結果を出し続ける**
盤面を閉じて再度開いても、前回振った結果の1行がそのまま残っている（次に振るまで消えない）。
リロードでは消える。`openBoardModal()` の先頭で空にするのが素直。

**B. 既定状態（マス目を畳んだまま）では、コマの歩行アニメが再生されない**
`#board-map-content` は既定で畳まれており、畳んでいる間は盤面SVGが組まれない。
`getWalkerCellPos()` が `null` を返し、`startWalkAnimation()` が静かに抜ける
（`sgAnimating` は戻り、現在地表示も更新されるので**壊れてはいない**）。
受け入れ基準の「コマの歩行」はマス目を開いているときだけ満たされる。
自動ロールだった頃は告の中でサイコロ演出が出ていたので、
「振ったのに何も動かない」と感じる人がいるかもしれない。
対処するなら「振ったら自動でマス目を開く」か「畳んでいるときはエリアビュー側で1マス動かす」。
**判断はヨージに委ねる**（演出を増やすと判断基準3に逆戻りするため、あえて何もしないのも正解）。

**C. `board-roll-btn` の click リスナーだけ core.js にある**
他の盤面リスナー（`board-btn` `board-close-btn` `board-map-toggle`）は
すべて boot.js の「SUGOROKU — EVENT LISTENERS」に集めてある。ここに寄せると一貫する。

**D. `_sgJustRolled` が完全な死に変数になった**
`doSugorokuRoll()` で `true` になるが、読んでいる箇所が1つも無い。
さらに `false` に戻すのは `handleKokuClose()`（timer.js）だけで、
手動ロール後は告が出ないため戻らなくなった。害は無い。
**撤去はヨージの判断**（§4 の方針にならい、勝手に消さない）。

### 2026-08-07 追記：§3.6 をヨージの判断で変更（告に選択肢を置いた）

§3.6 は「告に押せるボタンは置かない」としていたが、**ヨージの指示で変更**した。

> 自動で回るのと、選んでから回るのは別物。余韻を奪うのは「頼んでいないのに始まる」ことなので、
> 選択肢にするなら §1 の趣旨と矛盾しない。

告の中に `#koku-ticket-choice` を出す（チケット0枚のときは出さない）。

```text
🎲 すごろくを振れます（あと N 回）
  [ 🎲 いま振る ]  [ あとで ]
       ↓ いま振る            ↓ あとで
  告の中で3Dサイコロが転がる   チケットは減らない。
  → 冒険レーン → 報酬        「すごろくから、好きなときに振れます」に変わるだけ
```

**サイコロは桃鉄風の3D立方体**（`buildDieHTML()` / `sgRollDice3D()` core.js）。
跳ねながら回転 → 目的の面を正面へ向けて着地 → つぶれて戻る。
出目が7以上のときは**2個**に割って振る（1個では6までしか出せないため。`sgSplitDice()`）。

> ⚠️ **目（ピップ）は子要素ではなくCSSの背景で描いている。**
> `backface-visibility:hidden` の面に子要素を置くと、跳ねるアニメで合成レイヤーに
> なった瞬間に**子要素だけ描画から落ち、真っ白なサイコロになる**（実機で再現・修正済み）。
> 面に子要素を戻さないこと。
> あわせて `.sgd-wrap` の `transform-style: preserve-3d` も必須（外すと立方体が潰れる）。

盤面の「振る」ボタン側は**変更していない**（従来どおり1行だけの静かな表示）。
サイコロ演出は告のときだけ。

**E. 10枚を超えたチケットが黙って捨てられる**
§3.1 の仕様どおりで実装は正しい。ただしユーザーには何も伝わらない。
ロードマップの基準に照らすと「した努力が黙って消える」形にはなる。
枚数が上限に達したときだけ盤面に一言出す等、**次の仕様書で扱うか要判断**。
