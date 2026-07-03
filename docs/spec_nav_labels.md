# 仕様書：ナビゲーション改善（ラベル表示＋ロック中の❓演出）

作成: 2026-07-04 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親ドキュメント: [ux_ui_improvement_plan.md](ux_ui_improvement_plan.md) の P1-1（STEP2）
前提: STEP1（OverlayManager）は完了済み。本件はヘッダーまわりのみで競合しない。

---

## 1. 背景（なぜやるか）

### 問題1: 謎アイコン
ヘッダーのボタンが絵文字だけ（🧚📚🥚⚙）で、初見では何のボタンか分からない。
`title` 属性のツールチップはPCのマウスホバー限定で、**スマホでは一切見えない**。

### 問題2: ロック中の機能が「空白」
未解放の機能（🏰ギルド・🎲すごろく・🌳スキル・📊レビュー）は
`.feat-locked { display: none !important; }`（app.css 3847行付近）で完全に消えるため、
ヘッダーに不自然なすき間ができ、壊れて見える。しかも
**「何かが解放される」というワクワクがゼロ**（存在自体が見えないので）。

```text
現状:  [🧚] [📚] [🥚] [⚙]  ←ロック中4つは存在ごと消える

改善:  [🧚] [🔒] [🔒] [🔒] [🔒] [📚] [🥚] [⚙]
        妖精  ???  ???  ???  ???  ジャンル 図鑑 設定
              ↑タップすると「あと◯◯で解放」のヒントが出る
```

### 問題3: 読み上げ非対応
どのボタンにも `aria-label`（スクリーンリーダー用の名前）がなく、
音声読み上げでは「ボタン」としか読まれない。

---

## 2. 受け入れ基準（全部満たしたら完了）

- [ ] 全ヘッダーボタンの絵文字の下に小さなラベルが常時表示される（スマホ含む）
- [ ] ロック中の機能はシルエット＋「？？？」で見え、空白のすき間がない
- [ ] ロック中ボタンをタップすると機能は開かず、解放条件のヒントトーストが出る
- [ ] 解放済みになるとラベル・見た目・タップ動作が通常に戻る（既存の🔓トースト＆光る演出はそのまま動く）
- [ ] 全ヘッダーボタンに `aria-label` が付き、ロック中は「ロック中」と分かる読み上げになる
- [ ] 画面幅320pxでもヘッダーが折り返し・はみ出ししない
- [ ] オトモン🥚ボタン（otomon.js が後から注入）にもラベルが付く
- [ ] 既存機能（各ボタンで開く画面、導きの妖精のハイライト等）が壊れていない

---

## 3. 設計

### 3.1 HTML: ボタン構造の変更（index.html 58〜66行）

絵文字とラベルを `<span>` で分離し、`data-nav-label`（解放後に表示する短い名前）を持たせる。

```html
<div class="header-right" data-guide="top-actions">
  <button class="icon-btn" id="fairy-guide-btn" title="導きの妖精（迷ったら押す）" aria-label="導きの妖精">
    <span class="icon-btn-emoji">🧚</span><span class="icon-btn-label">妖精</span>
  </button>
  <button class="icon-btn feat-locked" id="guild-btn" data-unlock="guild" data-nav-label="ギルド" title="冒険者ギルド">
    <span class="icon-btn-emoji">🏰</span><span class="icon-btn-label">ギルド</span>
  </button>
  <button class="icon-btn feat-locked" id="board-btn" data-unlock="board" data-nav-label="すごろく" title="すごろく">
    <span class="icon-btn-emoji">🎲</span><span class="icon-btn-label">すごろく</span>
  </button>
  <button class="icon-btn feat-locked" id="skill-btn" data-unlock="skill" data-nav-label="スキル" title="スキルツリー">
    <span class="icon-btn-emoji">🌳</span><span class="icon-btn-label">スキル</span>
  </button>
  <button class="icon-btn feat-locked" id="review-btn" data-unlock="review" data-nav-label="レビュー" title="週次レビュー">
    <span class="icon-btn-emoji">📊</span><span class="icon-btn-label">レビュー</span>
  </button>
  <button class="icon-btn" id="genre-btn" title="ジャンル管理" aria-label="ジャンル管理">
    <span class="icon-btn-emoji">📚</span><span class="icon-btn-label">ジャンル</span>
  </button>
  <button class="icon-btn" id="settings-btn" title="設定" aria-label="設定">
    <span class="icon-btn-emoji">⚙</span><span class="icon-btn-label">設定</span>
  </button>
</div>
```

**otomon.js 側**（1201行付近の `otomon-btn` 注入処理）も同じ構造にする:
`<span class="icon-btn-emoji">🥚</span><span class="icon-btn-label">オトモン</span>`
＋ `aria-label="オトモン図鑑"`。

⚠️ 注意: 既存JSに `btn.textContent = '🧚'` のようにボタンの**中身を丸ごと書き換える**
処理があればラベルが消える。`icon-btn-emoji` の span だけを書き換えるよう直すこと
（実装前に `grep` で各ボタンidへの textContent/innerHTML 代入を確認）。

### 3.2 CSS: ラベルとロック中スタイル

```css
/* ボタンを縦積み（絵文字＋ラベル）に */
.icon-btn {
  display: inline-flex; flex-direction: column;
  align-items: center; gap: 2px; line-height: 1;
}
.icon-btn-label {
  font-size: .5rem; font-weight: 700;
  color: var(--text-dim); letter-spacing: .02em;
}

/* ロック中: 消さない。シルエット＋？？？で「まだ見ぬ機能」を演出 */
.feat-locked { display: inline-flex !important; opacity: .5; }
.feat-locked .icon-btn-emoji { filter: grayscale(1) brightness(.4); }
```

- 既存の `.feat-locked { display: none !important; }`（3847行付近）は**削除**する。
- 既存のモバイル用 media query（app.css 2218 / 2222 / 2228 / 2238 行付近の
  `.icon-btn` 調整）にラベルサイズの調整を追加し、320px幅で収まることを確認する。
- 解放時の `feat-unlocked-glow`（光る演出）は既存のまま使う。

### 3.3 JS: ラベル切り替え＋ロック中クリックのガード

**(1) UNLOCK_DEFS にヒント文を追加**（app.js 8856行付近）:

```javascript
const UNLOCK_DEFS = [
  { key:'guild',  emoji:'🏰', label:'冒険者ギルド', hint:'はじめての集中を1回終えると解放', cond:() => (data.sessions||0) >= 1 },
  { key:'board',  emoji:'🎲', label:'すごろく',     hint:'はじめての集中を1回終えると解放', cond:() => (data.sessions||0) >= 1 },
  { key:'badges', emoji:'🏅', label:'バッジ',       hint:'はじめてのバッジを獲得すると解放', cond:() => ... },
  { key:'equipment', emoji:'🎒', label:'装備',      hint:'アイテムを1つ手に入れると解放',   cond:() => ... },
  { key:'skill',  emoji:'🌳', label:'スキルツリー', hint:'成長の実を1つ実らせると解放',     cond:() => ... },
  { key:'timelog',emoji:'⏱',  label:'1日のタイムログ', hint:'2日分の学習記録がつくと解放',   cond:() => ... },
  { key:'review', emoji:'📊', label:'週次レビュー', hint:'集中セッションを4回終えると解放', cond:() => ... },
];
```
（cond は既存のまま。hint だけ追加。timelog の hint は「2日分の学習記録がつくと解放」）

**(2) applyFeatureVisibility を拡張**（ラベルと aria-label の切り替え）:

```javascript
function applyFeatureVisibility() {
  UNLOCK_DEFS.forEach(def => {
    const btn = document.querySelector(`[data-unlock="${def.key}"]`);
    if (!btn) return;
    const unlocked = featUnlocks.has(def.key);
    btn.classList.toggle('feat-locked', !unlocked);
    const lbl = btn.querySelector('.icon-btn-label');
    if (lbl) lbl.textContent = unlocked ? (btn.dataset.navLabel || def.label) : '？？？';
    btn.setAttribute('aria-label', unlocked ? def.label : `ロック中の機能（タップで解放条件を表示）`);
  });
}
```
※ 既存は「解放時に remove するだけ」だが、`classList.toggle` に変えることで
将来のリセット機能にも耐える。

**(3) ロック中クリックのガード**（キャプチャ段階＝他のリスナーより先に横取り）:

```javascript
// ロック中ボタン: 機能を開かずヒントを出す
document.addEventListener('click', e => {
  const btn = e.target.closest('.feat-locked[data-unlock]');
  if (!btn) return;
  e.stopPropagation(); e.preventDefault();
  const def = UNLOCK_DEFS.find(d => d.key === btn.dataset.unlock);
  if (def) showLockedHintToast(def);
}, true);  // ← true（キャプチャ）が重要。ボタン本来のクリック処理より先に走る

function showLockedHintToast(def) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🔒 まだ見ぬ機能<br><span style="opacity:.9;font-weight:700">${def.hint}</span>`;
  t.classList.add('multiline');
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.remove('multiline'), 400); }, 3000);
}
```
（トーストは既存の `showUnlockToast` と同じ `confidence-toast` を流用）

> **キャプチャ段階** とは：クリックイベントは「外側→ボタン→外側」の順に伝わる。
> 第3引数 `true` で「外側→ボタン」の行き（キャプチャ）で捕まえられるため、
> ボタン自身のクリック処理（ギルドを開く等）が動く前に止められる。

### 3.4 やらないこと（スコープ外）

- badges / equipment / timelog はヘッダーボタンが無いので❓表示の対象外（hint追加のみ）
- ボトムナビへの全面改装（将来のSTEPで検討）
- 冒険者A/B/C の改善（P1-3、別仕様書）

---

## 4. テスト手順

1. localStorage を消して新規ユーザーにする → ヘッダーに 🔒4つ（？？？）が並び、空白がない
2. ロック中の ？？？ をタップ → 機能は開かず「🔒 まだ見ぬ機能…」トーストが出る
3. 集中を1回完了 → 🏰🎲 が光ってラベルが「ギルド」「すごろく」になり、タップで開く
4. DevTools のデバイスモードで幅320px → ヘッダーが折り返し・はみ出ししない
5. 全ボタンに aria-label が付いている（DevTools の Accessibility タブで確認）
6. オンボーディング（召喚→妖精ガイド）が今まで通り動く
7. 🥚オトモンボタンにもラベル「オトモン」が付いている

---

## 5. Codex への依頼文（コピペ用）

```text
docs/spec_nav_labels.md の仕様書に従って実装してください。

- コミットは「HTML+CSS（ラベル表示）」「ロック中❓化+クリックガード」
  「otomon.jsボタン対応」の3つ程度に分けてください。
- app.css / app.js を編集したら index.html の ?v=guild-N を必ず +1。
- §3.1 の⚠️注意（ボタン中身を書き換える既存処理の確認）を必ず実施。
  見つけた場合は icon-btn-emoji のみ書き換えるよう修正してください。
- §4 のテスト手順で動作確認し、結果を報告してください。
- 判断に迷う点は勝手に決めず、リストにして報告してください。
```

実装後のレビューはクロ（Fable 5）が行う。
