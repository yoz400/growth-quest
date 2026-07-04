# 仕様書：アクセシビリティ底上げ（STEP3-b / P1-2）

作成: 2026-07-04 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親: [ux_ui_improvement_plan.md](ux_ui_improvement_plan.md) P1-2
⚠️ 着手条件: STEP2 のマージ後（同じ CSS/JS を触るため）。STEP3-a と同時進行は不可。

> **アクセシビリティ** とは：視力・色覚・操作環境が違う人でも使えるようにする配慮。
> 「誰でも使える」は「愛されるアプリ」の土台。

---

## 1. 対象と設計（4点だけ・全て低リスク）

### 1.1 薄いグレー文字のコントラスト改善

計測結果: `--text-dim: #6b6b80` は暗い背景(#0a0a0f)に対して**約3.8:1**しかなく、
WCAG（Webアクセシビリティ基準）の合格ライン **4.5:1** を下回る。

- 対策: `:root` の `--text-dim` を `#8a8aa0`（約5.5:1）に変更する。**1行の変更**で
  全画面に効く（変数だから）。
- 変更後、主要画面をスクリーンショットで見比べて「雰囲気が壊れていない」ことを確認。
  微調整するなら `#82829a` まで暗くしてよい（4.5:1は死守）。

### 1.2 キーボードフォーカスの可視化

Tabキーで操作する人のために、いま選ばれているボタンに光る枠を出す:

```css
:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 2px;
  border-radius: 6px;
}
```

- `:focus`（マウスクリックでも出る）ではなく `:focus-visible`（キーボード時だけ出る）
  を使うこと。マウス操作の見た目は変わらない。

### 1.3 ドラッグハンドル「⠿」の適正化

- 全 `.widget-grip` に `aria-hidden="true"` を付与（読み上げで「⠿」と読まれるのを防ぐ）
- `title="ドラッグして並べ替え"` は既にあるので維持

### 1.4 アニメーション酔い対策（prefers-reduced-motion）

OSで「視覚効果を減らす」を設定している人向けに、動きを控えめにする:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

⚠️ 例外: タイマーの進行表示など「動きが情報そのもの」の要素が壊れないか確認。
壊れる場合はその要素だけ除外セレクタで残す。

## 2. 受け入れ基準

- [x] --text-dim のコントラストが4.5:1以上（DevToolsのカラーピッカーで確認可）
- [x] Tabキーでボタンを移動すると光る枠が見える／マウスクリックでは出ない
- [x] ⠿ が読み上げから除外されている
- [x] reduced-motion 設定時にアニメーションが止まり、かつタイマーは正常に動く
- [x] 見た目の世界観（ダーク×シアン）が維持されている

> ✅ **レビュー完了（2026-07-04 クロ）**：Codex実装（4コミット）を検証し合格。
> コントラストは独立計算でも 5.85:1、グリップ7/7に aria-hidden、:focus-visible と
> reduced-motion ルールの存在をCSSOMで確認。Codexが確認しきれなかった
> 「reduced-motion中の完了演出」は、JSに animationend/transitionend 依存が
> 一切ないことをコード検査で確認し問題なしと判定。
> **レビュー中に別件バグを発見しクロが修正**：ログインボーナスと導きの妖精ガイドが
> 同時に開いて重なる（ガイドの光る枠がボーナスを指す）。openGuideTutorial に
> 「他のオーバーレイが開いている間は待機し、閉じてから登場」する処理を追加して解消
> （?v=guild-56、ボーナス受け取り→ガイド登場の順次表示を実機確認）。**STEP3-b完了。**

## 3. テスト手順

1. DevTools → 要素検査 → color picker で --text-dim のコントラスト比を確認
2. Tabキー巡回で focus リングを確認（マウスでは出ないこと）
3. DevTools → Rendering → Emulate CSS prefers-reduced-motion で動作確認
4. タイマーSTART→完了まで一通り動かす

## 4. Codexへの依頼文（コピペ用）

```text
docs/spec_a11y_polish.md に従って実装してください。4項目を1コミットずつ。
app.css編集時は index.html の ?v=guild-N を +1。
§3のテスト手順で確認し、reduced-motionでタイマー表示が壊れないかは必ず報告してください。
```
