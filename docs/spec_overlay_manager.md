# 仕様書：オーバーレイ排他制御（OverlayManager）

作成: 2026-07-03 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親ドキュメント: [ux_ui_improvement_plan.md](ux_ui_improvement_plan.md) の P0-1・P0-2

---

## 1. 背景（なぜやるか）

Growth Quest には現在 **20個のオーバーレイ**（画面に重なるモーダル・ガイド類）があり、
それぞれが独立に `classList.add('open')` / `remove('open')` で開閉している。

> **オーバーレイ／モーダル** とは：画面の上にかぶさる小窓のこと。
> 設定画面・召喚画面・バッジ一覧などが該当。

### 現状の仕組みと問題

```text
非表示のとき: opacity: 0 (透明) + pointer-events: none (クリック無効)
表示のとき:   .open クラスで opacity: 1 + pointer-events: auto

問題: 「透明なだけ」で DOM 上は生きている
      ┌─────────────────────────────┐
      │ 見えている召喚画面           │ ← ユーザーにはこれしか見えない
      ├─────────────────────────────┤
      │ 透明なほめモーダル(生きてる) │ ← Tabキーでフォーカスが入る！
      │ 透明なチュートリアル(〃)     │ ← スクリーンリーダーが読む！
      └─────────────────────────────┘
```

具体的な害:
1. **Tabキー**で「見えないボタン」にフォーカスが移り、Enterで押せてしまう
2. **スクリーンリーダー**（音声読み上げ）が非表示の画面まで全部読む
3. 排他制御がないので、コード次第で**2つ同時に開けてしまう**
4. ESCキーの処理が各モーダルにバラバラに書かれている（実装漏れ・競合の温床）

### 調査で確定した数値（2026-07-03 時点）

| 項目 | 値 |
|------|-----|
| オーバーレイ総数 | 20個（下の §4 に全リスト） |
| `classList.add('open')` の呼び出し箇所 | 20か所 |
| `classList.remove('open')` の呼び出し箇所 | 34か所 |
| ESC用の `keydown` リスナー | 複数バラバラ（praise / fairy / koku など個別） |
| `aria-hidden` が付いている overlay | 1個だけ（guide-tutorial-overlay、しかも固定値） |

---

## 2. ゴール（受け入れ基準）

実装完了の定義。**全部満たしたら完了**：

- [x] どの瞬間も「操作できるオーバーレイ」は最前面の1つだけ
- [x] 非表示のオーバーレイは Tabキーでフォーカスできない
- [x] 非表示のオーバーレイはスクリーンリーダーに読まれない（`aria-hidden` が正しく切り替わる）
- [x] ESCキーは「最前面のオーバーレイ」だけを閉じる（1か所の共通処理）
- [x] オーバーレイを閉じたら、開く前にフォーカスしていた要素にフォーカスが戻る
- [x] 既存の見た目・アニメーション（フェードイン等）は変わらない
- [x] オンボーディング（召喚→妖精ガイド）の流れが今まで通り動く
- [x] すごろく中の「装備ゲット」のような **重ね表示** も動く（§3.2 スタック方式）

> ✅ **レビュー完了（2026-07-04 クロ）**：Codex実装（21コミット、全20オーバーレイ移行）を
> ブラウザ実機で全項目検証し合格。フォーカストラップ（Tabが最前面から出ない仕組み）も
> 仕様以上の品質で実装されていた。ESC不可指定（summon / guide-tutorial / login-bonus）、
> スタックのinert切り替え、フォーカス復帰、コンソールエラーゼロを確認。
> 死にCSS（#timelog-overlay / #timelog-panel）はレビュー時にクロが削除（?v=guild-46）。
> **STEP1はこれで完了。**

---

## 3. 設計

### 3.1 Phase A: CSS だけの即効修正（✅ 2026-07-03 クロが実装・検証済み）

> **実装済み**：`styles/app.css` 末尾の「overlay共通（Phase A）」ブロック。`?v=guild-45` で配信。
> ブラウザ検証済み：非表示overlay全てが `visibility:hidden`＋フォーカス不可、
> 表示・フェードイン/アウトは従来どおり、召喚画面のボタンは正常にフォーカス可。
> **補足**：`#timelog-overlay` はCSSにだけ残った死にコード（実体は review-overlay に
> 統合済みでHTML/JSに存在しない）ため対象から除外した。Phase B のついでに
> app.css の `#timelog-overlay` 関連ルールを削除してよい。
> **Codex は Phase B から着手すること。**

`visibility: hidden` を足すだけで「フォーカス漏れ」「読み上げ漏れ」の大半が直る。

> **visibility: hidden** とは：`opacity: 0`（透明だが存在する）と違い、
> フォーカスも読み上げも効かなくなる「本当の非表示」。

`styles/app.css` に共通ルールを1つ追加する（各オーバーレイの個別ルールは触らない）：

```css
/* ===== overlay共通: 非表示時はフォーカス・読み上げからも消す ===== */
#login-bonus-overlay, #koku-overlay, #genre-overlay, #badges-overlay,
#equipment-overlay, #equipment-get-overlay, #board-overlay, #skill-overlay,
#review-overlay, #avatar-overlay, #words-overlay, #settings-overlay,
#praise-overlay, #guide-tutorial-overlay, #guild-overlay,
#vow-blessing-overlay, #fairy-overlay, #fairy-guide-overlay,
#tutorial-overlay, #summon-overlay, #timelog-overlay {
  visibility: hidden;
  transition-property: opacity, visibility;
}
#login-bonus-overlay.open, #koku-overlay.active, #genre-overlay.open,
#badges-overlay.open, #equipment-overlay.open, #equipment-get-overlay.open,
#board-overlay.open, #skill-overlay.open, #review-overlay.open,
#avatar-overlay.open, #words-overlay.open, #settings-overlay.open,
#praise-overlay.open, #guide-tutorial-overlay.open, #guild-overlay.open,
#vow-blessing-overlay.open, #fairy-overlay.open, #fairy-guide-overlay.open,
#tutorial-overlay.open, #summon-overlay.open, #timelog-overlay.open {
  visibility: visible;
}
```

注意:
- `#koku-overlay` だけ `.active` クラスで開閉している（他は `.open`）。要確認のうえ合わせる。
- 各オーバーレイの既存 `transition: opacity ...` がある場合、`visibility` も
  transition に含めないとフェードアウトが切れて見える。上の共通ルールで補う。
- **`index.html` の `?v=guild-N` を必ず +1 すること**（キャッシュ対策。忘れると反映されない）。

### 3.2 Phase B: OverlayManager（JS の一元管理）

`scripts/app.js` の先頭付近に以下のモジュールを追加し、
既存54か所の開閉コードをすべてこの関数経由に置き換える。

```text
状態のイメージ（スタック＝重ね置きの塔）:

  open('board')          open('equipment-get')      close()
  ┌──────────┐           ┌──────────────┐           ┌──────────┐
  │ board    │  ──────▶  │ equipment-get│ ──────▶   │ board    │
  └──────────┘           │ board(inert) │           └──────────┘
                         └──────────────┘
  ESC・closeは常に「一番上」だけに効く。下の階は inert（操作不能）になる。
```

> **inert** とは：HTML属性のひとつ。付けるとその要素の中身が
> クリックもフォーカスも読み上げもされなくなる（モダンブラウザ対応済み）。

```javascript
/* ===== OverlayManager: オーバーレイの交通整理（同時に操作できるのは1つ） ===== */
const Overlay = (() => {
  const stack = [];            // 開いている順の配列。末尾が最前面
  const lastFocus = new Map(); // overlay id → 開く直前にフォーカスしていた要素

  // id ごとの設定。openClass: 開閉に使うクラス名 / dismissible: ESCで閉じてよいか
  const DEFS = {
    'koku-overlay':          { openClass: 'active', dismissible: true },
    'summon-overlay':        { openClass: 'open',   dismissible: false }, // スキップボタンで閉じる
    'guide-tutorial-overlay':{ openClass: 'open',   dismissible: false }, // 「あとで/閉じる」で閉じる
    'login-bonus-overlay':   { openClass: 'open',   dismissible: false }, // 受け取りボタンで閉じる
    // 上記以外は { openClass: 'open', dismissible: true } を既定とする
  };
  const def = id => ({ openClass: 'open', dismissible: true, ...(DEFS[id] || {}) });

  function el(id) { return document.getElementById(id); }

  function syncInert() {
    // 最前面だけ操作可能。それ以外の開いているoverlayと本体(main)は inert
    const top = stack[stack.length - 1];
    stack.forEach(id => {
      const o = el(id);
      o.inert = (id !== top);
      o.setAttribute('aria-hidden', id === top ? 'false' : 'true');
    });
    const main = document.querySelector('main') || document.body.firstElementChild;
    if (main) main.inert = stack.length > 0;
  }

  function open(id, { onClose } = {}) {
    const o = el(id); if (!o) return;
    if (stack.includes(id)) return;             // 二重openを無視（排他制御）
    lastFocus.set(id, document.activeElement);
    stack.push(id);
    o.classList.add(def(id).openClass);
    o.dataset.onCloseId = '';                   // onCloseはMapで持つ（下記）
    if (onClose) closeHooks.set(id, onClose);
    syncInert();
    // 最初のフォーカス可能要素にフォーカスを移す
    const f = o.querySelector('button, [href], input, select, textarea, [tabindex]');
    if (f) f.focus();
  }
  const closeHooks = new Map();

  function close(id) {
    const targetId = id || stack[stack.length - 1];
    if (!targetId) return;
    const i = stack.indexOf(targetId); if (i === -1) return;
    stack.splice(i, 1);
    const o = el(targetId);
    o.classList.remove(def(targetId).openClass);
    o.setAttribute('aria-hidden', 'true');
    o.inert = false;
    syncInert();
    const back = lastFocus.get(targetId);
    if (back && back.focus) back.focus();       // フォーカスを元の場所へ返す
    lastFocus.delete(targetId);
    const hook = closeHooks.get(targetId);
    if (hook) { closeHooks.delete(targetId); hook(); }
  }

  function closeAll() { while (stack.length) close(); }
  function topId() { return stack[stack.length - 1] || null; }

  // ESCは共通1か所: 最前面が dismissible のときだけ閉じる
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const top = topId(); if (!top) return;
    if (def(top).dismissible) { e.preventDefault(); close(top); }
  });

  return { open, close, closeAll, topId };
})();
```

### 3.3 Phase B の置き換えルール（機械的作業）

| 置き換え前 | 置き換え後 |
|-----------|-----------|
| `document.getElementById('X-overlay').classList.add('open')` | `Overlay.open('X-overlay')` |
| `document.getElementById('X-overlay').classList.remove('open')` | `Overlay.close('X-overlay')` |
| koku-overlay の `.active` 付け外し | 同上（openClass は DEFS が吸収） |
| 各モーダル個別の `keydown`/`Escape` リスナー | **削除**（共通ESCに一本化）。ただしESC以外のキー処理は残す |

対象オーバーレイ全20個:
`login-bonus / koku / genre / badges / equipment / equipment-get / board /
skill / review / avatar / words / settings / praise / guide-tutorial /
guild / vow-blessing / fairy / fairy-guide / tutorial / summon`
（＋ `timelog-overlay` があれば同様に。`cal-day-popup` は `.hidden` 方式の
ポップアップなので **今回は対象外**）

注意点:
- `praise-overlay` のように「閉じたあとに次の処理をする」箇所は
  `Overlay.open('praise-overlay', { onClose: () => {...} })` を使う
- 順番に見せたい画面（召喚→妖精ガイド）は「前のcloseの後に次のopen」を守る
- 置き換えは**1オーバーレイずつコミット**し、都度ブラウザで動作確認する

---

## 4. テスト手順（受け入れ確認のやり方）

1. `localStorage` を消して新規ユーザー状態にする（DevTools → Application → Clear site data）
2. 召喚画面で **Tabキーを20回以上押す** → フォーカスが召喚画面の外に出ないこと
3. 召喚を最後まで進める → 妖精ガイドが順に出て、二重表示にならないこと
4. 設定を開いて ESC → 設定だけ閉じ、フォーカスが⚙ボタンに戻ること
5. 1セッション完了 → ほめモーダル → ESCで閉じられること（dismissible: true）
6. すごろくで装備ゲット → board の上に equipment-get が重なり、
   閉じたら board が再び操作できること
7. 見た目のフェードイン/アウトが以前と同じであること

---

## 5. Codex への依頼文（コピペ用）

```text
docs/spec_overlay_manager.md の仕様書に従って実装してください。

- Phase A（CSSのvisibility共通ルール追加）を先に1コミットで。
  index.html の ?v=guild-N を +1 するのを忘れずに。
- Phase B（OverlayManager追加と54か所の置き換え）は
  1オーバーレイずつコミットを分けて進めてください。
- 仕様書 §4 のテスト手順で動作確認し、結果を報告してください。
- 判断に迷う箇所（onCloseが必要か等）は勝手に決めず、リストにして報告してください。
```

実装後のレビューはクロ（Fable 5）が行う。
