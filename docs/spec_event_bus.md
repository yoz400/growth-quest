# 仕様書：GQイベント通知（Phase B / 「100機能に耐える」ための本丸）

作成: 2026-07-05 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親: [architecture_review.md](architecture_review.md) §5 Phase B
⚠️ 着手条件: 他のJS作業と同時進行しない。**次の大型機能を作る前**に入れるのが最も効率的。

---

## 1. 何を解決するか

現在、セッション完了時の処理（timer.js の stopTimer / completeSession）は
「XP加算→保存→統計描画→バッジ→スキル→装備→タイムログ→自信→すごろく→クエスト…」
と**十数個の処理を手で列挙**している。新機能を足すたびここに1行増え、
呼び忘れ＝更新漏れバグになる。機能が100になったらこの方式は破綻する。

```text
Before（現在）                     After（イベント方式）
timer.js が全員を名指しで呼ぶ       timer.js は「完了したよ」と叫ぶだけ
  stopTimer() {                      stopTimer() {
    addXP(); checkBadges();            GQ.emit('session:complete',
    renderStats(); ...12行...            { mins, mode, genreId });
  }                                  }
新機能追加 = timer.js を改造        新機能追加 = 自分のファイルで
（事故リスク）                        GQ.on('session:complete', fn) するだけ
```

## 2. 実装（core.js の OverlayManager の直後に追加）

```javascript
/* ===== GQ EventBus: 機能同士を疎結合にする通知係 ===== */
const GQ = (() => {
  const handlers = new Map();   // event名 → Set<fn>
  function on(ev, fn) {
    if (!handlers.has(ev)) handlers.set(ev, new Set());
    handlers.get(ev).add(fn);
    return () => handlers.get(ev)?.delete(fn);   // 解除関数を返す
  }
  function emit(ev, payload) {
    (handlers.get(ev) || []).forEach(fn => {
      try { fn(payload); }
      catch (e) { console.error(`[GQ] ${ev} の購読処理でエラー:`, e); }
    });
  }
  return { on, emit };
})();
```

**設計判断のポイント**: 購読側の例外を try/catch で握りつぶす（console.errorのみ）。
1機能のバグが他の全機能を巻き込んで死ぬ事故を構造的に防ぐ。これが本仕様の核心。

## 3. 導入方針（ビッグバン移行はしない）

1. **Phase B-1**: GQ本体を追加し、`session:complete` の1イベントだけ導入。
   completeSession / stopTimer の末尾に emit を追加（既存の直接呼び出しは残す）
2. **Phase B-2**: 呼ばれている側を1つずつ購読方式へ移行（1コミット=1機能）。
   移行したら timer.js 側の直接呼び出しを消す
3. 以後の新機能は最初から GQ.on で参加する

### 最初に定義するイベント（増やしすぎない）

| イベント名 | payload | 発火タイミング |
|-----------|---------|---------------|
| `session:complete` | { mins, mode, genreId } | セッション完了・手動停止(1分以上)時 |
| `data:changed` | { reason } | saveData(data) 実行時 |
| `day:changed` | { today } | 日付が変わったのを検知した時 |

## 4. 受け入れ基準

- [ ] GQ.on / GQ.emit が動き、購読側の例外が他の購読者と発火元を巻き込まない
- [ ] session:complete 移行後、セッション完了時の挙動が移行前と完全に同一
  （XP・バッジ・統計・すごろく・褒めログ・自信ゲージ・タイムログ）
- [ ] スモークテスト合格・コンソールエラーゼロ
- [ ] 移行は1コミット=1機能で、いつでも途中で止められる状態を保つ

## 5. Codexへの依頼文（コピペ用）

```text
docs/spec_event_bus.md に従って実装してください。
- Phase B-1（GQ本体+emit追加のみ・既存呼び出しは残す）を最初の1コミットに。
- Phase B-2 は1コミット=1機能の移行。各コミット後にスモークテスト。
- 挙動が1つでも変わったら、作り変えずに報告して止まってください。
```
