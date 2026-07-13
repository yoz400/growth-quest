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

- [x] GQ.on / GQ.emit が動き、購読側の例外が他の購読者と発火元を巻き込まない
- [x] session:complete 移行後、セッション完了時の挙動が移行前と完全に同一
  （XP・バッジ・統計・すごろく・褒めログ・自信ゲージ・タイムログ）
- [x] スモークテスト合格・コンソールエラーゼロ
- [x] 移行は1コミット=1機能で、いつでも途中で止められる状態を保つ

> ✅ **レビュー完了（2026-07-12 クロ）**: Codex実装4コミット（89ba4ff〜4e24f99）を
> コード精査＋ブラウザ実機で検証し合格。?v=guild-70。
> - **B-1**: GQ本体はcore.jsのOverlayManager直後に仕様どおり設置。emitは
>   stopTimer（mins>0ガード内）とcompleteSessionの2箇所
> - **B-2移行済み3機能**: タイムログ(autoLogStudyBlock→boot.js購読)／
>   アイテム思い出(addCompanionMinutes→core.js購読)／
>   デイリークエスト(completeQuest('complete_session')→quests.js購読)。
>   grepで直接呼び出しの残存ゼロ＝二重実行なしを確認
> - **実機検証**: 例外隔離（わざと落ちる購読者→他の購読者と発火元は無傷、
>   console.errorのみ）／購読解除関数／30秒停止でemitなし／5分セッション停止で
>   XP+20・クエスト達成・タイムログ23:06-23:11自動記録＝移行前と同一挙動／
>   新規ユーザー起動・召喚表示・設定/ギルド開閉・カレンダー描画・図鑑OK／
>   アプリ由来のコンソールエラーゼロ
> - **残作業（次回のB-2継続候補）**: stopTimer/completeSession内にはまだ
>   バッジ・統計描画・自信ゲージ・すごろく等の直接呼び出しが残る（仕様どおり
>   段階移行中。いつでも再開できる状態）。data:changed / day:changed イベントは未導入

> ✅ **レビュー完了（2026-07-13 クロ・?v=guild-77）**: 残り2イベントを追加した
> Codex実装2コミット（7f1185e data:changed / f0d0645 day:changed）を精査＋実機で検証し合格。
> - **data:changed**: `saveData(d, reason='saveData')` に第2引数を追加し、保存後に
>   `GQ.emit('data:changed',{reason})`。既存の `saveData(data)` 呼び出しは全て後方互換
>   （第2引数を渡す既存呼び出しは無しをgrepで確認）。実機で default/明示 reason 両方通過を確認
> - **day:changed**: `todayKey()` にモジュール変数 `_gqObservedDay` を持たせ、日付が
>   変わった最初の1回だけ `GQ.emit('day:changed',{today})`。実機検証: 同日連打は発火0回／
>   日付を翌日に偽装して3回呼んでも発火はちょうど1回・payload.today正確
> - スモーク（起動・5分セッション完了でXP+20・設定/ギルド/図鑑・カレンダー描画）OK、
>   コンソールエラーゼロ。data:changedはセッション完了1回で11回発火するが購読者ゼロのため
>   実害なし（emitは空ハンドラをforEachするだけ）
> - **⚠️ 将来この2イベントに購読者を足す人への注意（重要）**:
>   1. **data:changed の購読処理から `saveData()` を呼ぶと無限ループ**になる。
>      購読側で保存が必要なら別キー保存にするか、フラグでガードする
>   2. **day:changed は `todayKey()` の内部＝多数のホットパスから同期発火**する。
>      日付変更後に最初に todayKey() を呼んだ場所（描画途中かもしれない）で走るため、
>      購読処理は軽量に保つ（重い再描画は `setTimeout(fn,0)` 等で遅延させる）
> - **3イベント（session:complete / data:changed / day:changed）出そろい。** 購読側の
>   本格移行（弱点2の根治）は次フェーズ。急がず段階的に

## 5. Codexへの依頼文（コピペ用）

```text
docs/spec_event_bus.md に従って実装してください。
- Phase B-1（GQ本体+emit追加のみ・既存呼び出しは残す）を最初の1コミットに。
- Phase B-2 は1コミット=1機能の移行。各コミット後にスモークテスト。
- 挙動が1つでも変わったら、作り変えずに報告して止まってください。
```
