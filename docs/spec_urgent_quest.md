# 仕様書：⚠ 緊急依頼（すごろくのイベントマス）

作成: 2026-10-24 / 作成者: クロ / 実装: Codex

## 0. これは何か

すごろくの**イベントマス（15マス）に止まったとき、まれに「緊急依頼」が発生する**。
いまイベントマスで起きているのは「オトモンの卵をもらう」か「+20XP」だけで、
「✨ イベントマス！特別な学びの場」と名乗っているのに中身が無い。ここを埋める。

ヨージの要望は2つ。

1. **課題のチャレンジ提案**（普段より少し背伸びした行動を提示する）
2. **クリア報酬の設計**
3. 演出は「**モンハンのような特別感**」

### 守るべき判断基準（GQの正典。迷ったらここへ戻る）

1. **その機能は「本当の努力」を要求するか。** 要求しないものに大きな報酬を与えない
2. **STARTを押すまでの秒数を伸ばさないか。** 伸ばすなら入れない
3. **集中直後の余韻を奪わないか。** 報酬演出の渋滞は楽しさではなく騒音になる
4. **サボった人を迎えるか、責めるか。** 責める設計は目的に反する

> ⚠️ 「緊急」「制限時間」はモンハンの語感だが、**焦らせる・責める作りにはしない**。
> 特別感は**演出**で出し、**プレッシャーでは出さない**。
> 断れること・失っても何も減らないことが、この機能の生命線。

---

## 1. 全体の流れ

```
すごろくでイベントマスに止まる
        ↓   1/3 の確率（残り2/3は従来どおり卵をもらう）
⚠ 緊急依頼 発生演出（全画面オーバーレイ）
        ↓
  [ 受ける ]  /  [ 今回は見送る ]
        ↓受ける              ↓見送る
ホームにカードが出る        何も減らない。静かに閉じる
        ↓
  [ ✓ 達成した ] を押す（または条件を満たすと自動達成）
        ↓
完了演出 ＋ 報酬（XP ＋ 目覚めアイテム）
```

**期限**: 受注から3日。切れたら**静かに取り下げる**（ペナルティ無し・責める文言を出さない）。

---

## 2. データ

### 2.1 localStorage（新キー1つ）

```
gq_urgent_quest   … 受注中の緊急依頼。1件だけ。無いときはキーごと削除する
```

```jsonc
{
  "id": "uq_deep45",          // URGENT_QUESTS の id
  "acceptedAt": 1792800000000, // 受注した時刻（期限判定に使う）
  "dueDate": "2026-10-27",     // 期限（この日を過ぎたら取り下げ）
  "done": false
}
```

- `gq_` 接頭辞なので `isBackupKey()` によりバックアップ対象に自動で入る（追加作業は不要）
- **`docs/architecture_review.md` §6 の台帳に1行追記すること**（オトモンの行ではなく
  「すごろく/装備」の行の末尾に `gq_urgent_quest` を足す）

### 2.2 クエスト定義（boot.js に定数で持つ）

```js
// ⚠ 緊急依頼。「普段より少し背伸びした1回」を提案する。
//    ・達成できなくても何も失わない。だから少しだけ高くてよい
//    ・所要が長いものほど★が高く、報酬も大きい
//    ・kind は自動達成の判定に使う（§4.3）。null は手動のみ
const URGENT_QUESTS = [
  { id:'uq_deep45',   star:3, kind:'session_mins', need:45,
    title:'長考の試練',     desc:'45分の集中を1本やりきる',        flavor:'腰を据えるほど、見える景色が変わる。' },
  { id:'uq_deep30',   star:2, kind:'session_mins', need:30,
    title:'静寂の狩り',     desc:'30分の集中を1本やりきる',        flavor:'音のない時間が、いちばん濃い。' },
  { id:'uq_twice',    star:2, kind:'session_count', need:2,
    title:'二度の挑戦',     desc:'今日のうちに2回学習する',        flavor:'一度で終わらせない日が、力になる。' },
  { id:'uq_morning',  star:2, kind:null,
    title:'暁の出立',       desc:'朝10時までに学習を始める',        flavor:'朝の一歩は、一日ぶんの重さがある。' },
  { id:'uq_weak',     star:3, kind:null,
    title:'苦手との対峙',   desc:'いちばん手がのびないジャンルを15分',flavor:'逃げ続けたものほど、倒したとき大きい。' },
  { id:'uq_teach',    star:3, kind:null,
    title:'継承の儀',       desc:'学んだことを誰かに一言説明する',   flavor:'人に渡せた知識だけが、自分のものになる。' },
  { id:'uq_tidy',     star:1, kind:null,
    title:'拠点の整備',     desc:'机の上を60秒で片づける',          flavor:'狩りの前に、拠点を整える。' },
  { id:'uq_plan',     star:1, kind:null,
    title:'進路の見定め',   desc:'明日やることを1つだけ決める',      flavor:'決めておくと、明日の自分が速い。' },
  { id:'uq_review',   star:2, kind:null,
    title:'記録の読み返し', desc:'先週の自分の記録を見返す',         flavor:'積み上げは、振り返って初めて見える。' },
  { id:'uq_restart',  star:1, kind:null,
    title:'再起の狼煙',     desc:'まず1分だけ机に向かう',           flavor:'小さく始めた者が、遠くまで行く。' },
];
```

### 2.3 報酬（★に対応）

| ★ | XP | 目覚めアイテム |
|---|---|---|
| ★1 | +30 | なし |
| ★2 | +50 | ×1 |
| ★3 | +80 | ×2 |

```js
const URGENT_REWARD = { 1:{ xp:30, wake:0 }, 2:{ xp:50, wake:1 }, 3:{ xp:80, wake:2 } };
```

- XPは既存の `addBonusXP(n)` を使う
- 目覚めアイテムは `window.Otomon && window.Otomon.grantRandomWakeItem()` を n 回。
  **必ず存在確認してから呼ぶ**（otomon.js は boot.js より後に読まれる＝掟2）

---

## 3. 発生（core.js のイベントマス処理に差し込む）

`scripts/core.js` の着地処理、`} else if (cellType === 'event') {` のブロック。
現状はこうなっている。

```js
  } else if (cellType === 'event') {
    bonusXP = 20;
    evClass = 'ev-event';
    const eggReward = window.Otomon ? window.Otomon.maybeDropEgg(sugorokuData.stage) : null;
    if (eggReward) { … 卵の演出 … } else { … }
```

ここを次のようにする。

```js
  } else if (cellType === 'event') {
    bonusXP = 20;
    evClass = 'ev-event';
    // ⚠ 緊急依頼（1/3）。受注中の依頼があるときは出さない＝常に1件だけ
    const urgent = (typeof maybeStartUrgentQuest === 'function') ? maybeStartUrgentQuest() : null;
    if (urgent) {
      message = `⚠ 緊急依頼が発生した！ ボーナス +${bonusXP} XP`;
    } else {
      const eggReward = … // 既存のまま
    }
```

- `maybeStartUrgentQuest()` は boot.js に置く。**core.js から裸で呼ばない**
  （core.js は boot.js より先に読まれる）。上記のとおり `typeof` で存在確認…**ではなく**、
  **`window.maybeStartUrgentQuest && window.maybeStartUrgentQuest()` の形にすること**。
  `typeof` は宣言前の let に対して無力で、過去に起動フリーズを3回起こしている（掟2）
- 確率は定数 `URGENT_RATE = 1/3` にして、1か所で変えられるようにする
- 受注中（`gq_urgent_quest` がある）なら発生させない。必ず `null` を返す

> 卵の出現が減る点について: イベントマスの2/3が卵になるので、卵は約4.3個/周→2.9個/周に減る。
> 一方で緊急依頼が目覚めアイテムを配るので、**孵化の収支はむしろ釣り合う方向**に動く。意図的。

---

## 4. 画面

### 4.1 発生演出オーバーレイ `#urgent-overlay`

**index.html に追加**（既存のオーバーレイ群の並びに置く）。

```html
<!-- ─── URGENT QUEST ─── -->
<div id="urgent-overlay">
  <div id="urgent-panel" class="gq-panel">
    <div class="uq-alertbar"><span>⚠</span> 緊急依頼 <span>⚠</span></div>
    <div class="uq-star" id="uq-star"></div>
    <div class="uq-title" id="uq-title"></div>
    <div class="uq-desc" id="uq-desc"></div>
    <div class="uq-flavor" id="uq-flavor"></div>
    <div class="uq-reward" id="uq-reward"></div>
    <div class="uq-actions">
      <button class="uq-accept" id="uq-accept-btn">受ける</button>
      <button class="uq-decline" id="uq-decline-btn">今回は見送る</button>
    </div>
    <div class="uq-note">見送っても失うものはありません</div>
  </div>
</div>
```

- `core.js` の `DEFS` に
  `'urgent-overlay': { openClass: 'open', dismissible: true },` を追加（掟3）
- 開閉は `Overlay.open('urgent-overlay')` / `Overlay.close('urgent-overlay')` のみ。
  `classList.add('open')` を直接書かない

**演出（モンハン風の特別感。CSSのみで作る。画像は追加しない）**

| 要素 | 見せ方 |
|---|---|
| 背景 | 暗転 ＋ `backdrop-filter: blur(10px)` |
| 警告バー | 上下から赤い帯がスライドイン（`transform: scaleX()` 0→1、0.35s） |
| パネル | 少し遅れて拡大しながら出る（`scale(.88)` → `1`、`cubic-bezier(.2,1.3,.5,1)`） |
| ★ | ★の数だけ金色、残りは灰。1つずつ0.08s遅れて光る |
| 色 | 赤（`--red`）を主役にする。**GQで赤が主役になる唯一の画面**＝特別感の源 |

- `prefers-reduced-motion: reduce` のときはアニメを止めて即表示にする（a11y。既存CSSに前例あり）

### 4.2 ホームのカード `#urgent-quest-card`

オトモンクエストカードと**同じ作り方**にする（boot.js で生成して注入）。

```js
card.className = 'glass';
card.id = 'urgent-quest-card';
card.innerHTML = '<div class="quest-header">⚠ 緊急依頼</div><div id="urgent-quest-body"></div>';
const holder = document.getElementById('layer-today-always');
if (holder) holder.prepend(card);
```

中身は「★／依頼名／内容／あと◯日／[ ✓ 達成した ]」。
受注していないときは `display:none`。

> 基準2（STARTまでの秒数）: このカードは「きょう」層の常設枠であって、
> タイマーより上には置かない。**`#layer-now` には入れない**こと。

### 4.3 達成

- **手動**: カードの「✓ 達成した」ボタン → `completeUrgentQuest()`
- **自動**: `GQ.on('session:complete', …)` を購読して判定する
  - `kind:'session_mins'` … `payload.mins >= need` なら達成
  - `kind:'session_count'` … その日の完了回数が `need` 以上なら達成
  - `kind:null` … 自動判定しない（手動のみ）
- 購読の登録は boot.js の読み込み時でよい（`GQ.on` は DEFERRED 扱いで掟2に触れない）

### 4.4 完了演出

- Toast で出す（**新しい全画面モーダルは作らない**）。理由＝基準3。
  セッション直後はバッジ・なつき度・連続記録の祝福が重なるため、
  緊急依頼だけ全画面を奪うと余韻が壊れる
- 文言例:

```
⚔ 緊急依頼 達成！
<依頼名>
+80 XP ／ 🔆 目覚めアイテム ×2
```

- `Toast.show(html, { kind:'multiline', ms:3600, priority:70 })`

### 4.5 期限切れ

- 起動時と `GQ.on('day:changed')` で判定する
- `dueDate` を過ぎていたら `gq_urgent_quest` を削除し、カードを隠す
- Toast は**静かな文言**にする。責めない。例:

```
依頼は取り下げられました。また声がかかります。
```

- ❌ 「失敗しました」「達成できませんでした」は**使わない**（基準4）

---

## 5. 受け入れ基準

- [ ] イベントマスに止まると、約1/3で緊急依頼の演出が出る。残りは従来どおり卵がもらえる
- [ ] すでに受注中のときは、イベントマスに止まっても緊急依頼は発生しない（常に1件）
- [ ] 「受ける」でホームにカードが出る。リロードしても残る
- [ ] 「今回は見送る」で何も減らない（XP・アイテム・連続記録のいずれも変化しない）
- [ ] 「✓ 達成した」で ★に応じた XP と目覚めアイテムが入り、カードが消える
- [ ] ★2で目覚めアイテムが1個、★3で2個増える
- [ ] `kind:'session_mins'` の依頼を受注中に、必要分数以上のセッションを完了すると自動達成する
- [ ] 期限を過ぎると静かに取り下げられ、責める文言が出ない
- [ ] `prefers-reduced-motion: reduce` でアニメが止まり、内容は読める
- [ ] `python3 tools/check_load_order.py` が ✅ のまま
- [ ] `bash tools/bump_version.sh` を実行し、`index.html` と `version.json` の番号が揃っている
- [ ] 320px / 375px / 1024px で、オーバーレイもカードもはみ出さない

## 6. テスト手順

1. `python3 -m http.server 8123` を立てて `http://localhost:8123/index.html` を開く
2. コンソールで受注状態を作る: `localStorage.setItem('gq_urgent_quest', JSON.stringify({id:'uq_deep45',acceptedAt:Date.now(),dueDate:'2099-01-01',done:false}))` → リロード → ホームにカードが出るか
3. 「✓ 達成した」で XP とアイテムが増えるか（`localStorage.gq_wake_items` を前後で見る）
4. 期限切れ: `dueDate` を過去日にしてリロード → 静かに消えるか
5. 自動達成: `uq_deep45` を受注した状態で、コンソールから `GQ.emit('session:complete',{mins:50,mode:'deep'})` → 達成するか
6. 発生確率: イベントマスの着地を20回ほど試し、だいたい1/3で出るか（卵も出ることを確認）

## 7. 迷ったら止まって報告

次に当たったら、**実装を進めずにその場で報告**すること。

- イベントマスの既存処理（卵の配布）を壊さずに差し込めない場合
- `#layer-today-always` が見つからない場合（カードの置き場所が変わっている）
- 新しい localStorage キーを `gq_urgent_quest` 以外にも足したくなった場合
- 既存のオーバーレイ／Toast の仕組みを変えないと実現できない演出がある場合
- 受け入れ基準のどれかが満たせないと分かった場合

## 8. Codexへの依頼文（コピペ用）

```
Growth Quest（/Users/hapiyopi/Desktop/claude-practice）に「⚠ 緊急依頼」を実装してください。
仕様書は docs/spec_urgent_quest.md です。全文を読んでから着手してください。

守ること:
- 仕様書の §5 受け入れ基準をすべて満たす
- 掟2（ファイルをまたぐ読み込み時参照の禁止）を厳守。core.js から boot.js の関数を呼ぶときは
  window.foo && window.foo() の形にする。typeof による存在確認は使わない
- 掟3（モーダルは OverlayManager の DEFS 登録 + Overlay.open/close のみ）
- 編集後に `python3 tools/check_load_order.py` と `bash tools/bump_version.sh` を実行する
- docs/architecture_review.md §6 の台帳に gq_urgent_quest を追記する
- **git commit / push はしない**
- 終わったら、変更したファイルと受け入れ基準の結果を報告する
- 仕様書 §7 に当たったら、進めずに報告する
```


---

## 9. 実装記録（2026-10-24・guild-202）

**実装者はCodexではなくクロ。** Codex に発注したが、**呼ぶCLIを間違えていて**着手できなかった。
（2026-10-24 追記: 当初「環境が壊れている」と書いたが誤り。詳細は FAILURES.md 同日）

```
failed to spawn code-mode host /Users/hapiyopi/.local/bin/codex-code-mode-host:
No such file or directory
```

原因は `~/.local/bin/codex`（実行ホストが同梱されていない方）を呼んだこと。
**アプリ同梱の `/Applications/ChatGPT.app/.../codex-cli/bin/codex` は正常に動く**
（後日ファイルを読ませて確認済み）。ヨージが実機確認中で待たせられないため、
このときは仕様書どおりクロが実装した。次の発注からは正しいパスで Codex に出せる。

### 受け入れ基準の結果

- [x] イベントマスで約1/3で発生（実測 **32.2%**／600回）。残りは従来どおり卵
- [x] 受注中は発生しない（40回試して0回）
- [x] 「受ける」でカードが出る。**リロードしても残る**
- [x] 「見送る」で XP・アイテムとも増減ゼロ、受注も残らない
- [x] 「✓ 達成した」で ★3=+80XP/アイテム×2、★1=+30XP/アイテム0
- [x] `session_mins` の自動達成（45分の依頼に50分で達成／20分では未達成）
- [x] 期限切れは「依頼は取り下げられました。また声がかかります。」＝責める語を含まない
- [x] `prefers-reduced-motion` でアニメ停止（CSSで対応）
- [x] `check_load_order.py` ✅ ／ jsc 構文 ✅ ／ bump_version 実行（guild-202）
- [x] 320px／1024px ではみ出さない。カードはタイマーより下（基準2）

### 実装中に気づいた落とし穴

**すごろくの着地処理で早期 return してはいけない。**
`doSugorokuRoll` の戻り値は
`{ roll, prevPos, newPos, cellNum, cellType, bonusXP, message, evClass, usedBuff, baseDice }`
で、移動アニメ側がこれを使う。最初 `return { message, bonusXP, ... }` と書いて
`roll`/`prevPos` を落としかけた。**message を差し替えるだけ**にすること。
