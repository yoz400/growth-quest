# 仕様書：冒険者ギルド Phase 2〜4（特別依頼・状態別おすすめ・NPC会話）

作成: 2026-07-12 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親: ギルドPhase1（2026-06-14完了、boot.js 1922行付近〜のギルドセクション）
⚠️ 着手条件: **spec_event_bus.md（イベントバス）と同時進行しない**。
どちらを先にやってもよいが、推奨は イベントバス → 本仕様 の順
（architecture_review.md §5 Phase B「次の大型機能の前に」の方針に従う）。

---

## 0. 全体像（3つのPhaseは独立。1 Phase = 1コミット）

```text
Phase 2  🎖 特別依頼      … バッジ（称号）の獲得数で解放される「勲章依頼」を追加
Phase 3  🧭 おすすめ強化   … 「疲れた夜」を検知して回復系の依頼を推す分岐を追加
Phase 4  💬 NPC会話演出    … 依頼達成時にNPCがひとこと返す＋ギルド昇格の祝いを追加
```

すべて **boot.js のギルドセクション内の変更のみ**（新ファイル不要。
掟1「新機能は新ファイル」の例外＝既存機能の拡張のため）。
CSSは Phase 2 でチップ1個ぶんだけ追加。JS/CSSを触ったら
`bash tools/bump_version.sh` を忘れない。

---

## 1. Phase 2：🎖 特別依頼（バッジ数で解放）

### 1.1 バッジ獲得数ヘルパー（掟2対応：ファイル間参照は localStorage 直読み）

バッジのデータは settings-genre.js が `gq_badges` に保存している
（`earnedBadges` 変数）。boot.js からは**変数を直接参照せず**、
localStorage を読むヘルパーをギルドセクション冒頭（GUILD_NPCS の手前）に追加する：

```javascript
// バッジ（称号）の獲得数。gq_badges を直読み（ファイル間の変数参照を避ける）
function earnedBadgeCount() {
  try {
    return Object.values(JSON.parse(localStorage.getItem('gq_badges') || '{}'))
      .filter(Boolean).length;
  } catch { return 0; }
}
```

⚠️ 着手前に `gq_badges` の中身の形（値が日付文字列か true か）を実データ or
settings-genre.js の保存箇所で確認すること。`filter(Boolean)` はどちらでも動く保険。

### 1.2 追加するクエスト（GUILD_QUESTS 末尾、g_kikan の後に追記）

`special:'honor'` を新設。カードに🎖チップを出す目印（1.3）。

```javascript
// ───── 🎖 特別依頼（称号の数で解放される勲章依頼）─────
{ id:'g_hirou', rank:'E', cat:'情緒', npc:'mimi', title:'武勲の披露',
  desc:'バッジ画面を開き、いちばん誇らしい称号を1つ選んで眺める。', xp:20, conf:2, repeat:'weekly',
  unlock:() => earnedBadgeCount() >= 3, unlockText:'称号3個で解放', special:'honor' },
{ id:'g_shinjin', rank:'D', cat:'挑戦', npc:'garud', title:'新人指南の心得',
  desc:'昔の自分に教えるつもりで、学びのコツを1つ書き残す。', xp:30, conf:1, repeat:'weekly',
  writable:true, hint:'例：単語は寝る前に見直すと覚えやすい',
  unlock:() => earnedBadgeCount() >= 10, unlockText:'称号10個で解放', special:'honor' },
{ id:'g_kyuusoku', rank:'D', cat:'回復', npc:'hotta', title:'英気を養う茶会',
  desc:'10分だけ画面から離れて、好きな飲み物をゆっくり味わう。', xp:25, conf:1, repeat:'weekly',
  unlock:() => earnedBadgeCount() >= 15, unlockText:'称号15個で解放', special:'honor' },
{ id:'g_meiyo', rank:'C', cat:'創造', npc:'noton', title:'栄誉の記録',
  desc:'始めた頃と比べて「変わったこと」を1つ書き残す。', xp:40, conf:2, repeat:'weekly',
  writable:true, hint:'例：机に向かうのが嫌じゃなくなった',
  unlock:() => earnedBadgeCount() >= 20, unlockText:'称号20個で解放', special:'honor' },
{ id:'g_eiyu', rank:'A', cat:'挑戦', npc:'rista', title:'英雄の帰還録',
  desc:'これまでで「一度くじけて、また戻れた」経験を1つ書き残す。', xp:120, conf:3, repeat:'once',
  writable:true, hint:'例：三日坊主のあと、1週間空けて再開できた',
  unlock:() => earnedBadgeCount() >= 30, unlockText:'称号30個で解放', special:'honor' },
```

### 1.3 見た目：🎖チップ

`guildQuestCardHTML` の reward 組み立てに1行追加：

```javascript
const reward = `+${q.xp}XP` +
  (q.conf ? `<span class="qr-conf">自信+${q.conf}</span>` : '') +
  (q.special === 'honor' ? `<span class="qr-honor">🎖特別</span>` : '') +   // ← 追加
  `<span class="qr-cat">${q.cat}</span>`;
```

CSS（app.css の `.qr-conf` 定義の近くに追加）：

```css
.qr-honor { color: var(--gold); font-weight: 700; }
```

### 1.4 データ・互換の注意

- `guild.completions` / `weekly` / `once` は questId ベースなので**既存構造のまま動く**。
  localStorage 新キーは無し（台帳追記・export追加も不要）。
- おすすめ選定（guildPickRecommended）から honor を**除外しない**
  （comeback だけが除外対象。特別依頼が推されるのはご褒美として正しい）。

---

## 2. Phase 3：🧭 状態別おすすめ強化（疲れた夜は回復系）

`guildPickRecommended()` に分岐を1つ追加。優先順位は
**① おかえり → ②（新設）おつかれの夜 → ③ 挑戦の時 → ④ ふだん**。

```javascript
// ② 20時以降で今日まだ0分 → 回復系のやさしい依頼（新設）
const todayMins = (data.history && data.history[todayKey()]) || 0;
if (new Date().getHours() >= 20 && todayMins === 0) {
  const easy = cands.filter(q => ['回復','精神','暮らし'].includes(q.cat)).sort(byRank)[0];
  if (easy) return { q: easy, tag:'今日はゆるめ',
    line:'今日は、ゆっくりでいい。ひと息つくのも冒険のうちさ。' };
}
```

挿入位置：既存の「候補 = 解放済み…」の `cands` 作成の**直後**、
`if ((data.streak || 0) >= 3)` の**手前**。

設計判断：
- 「疲れ」の判定は**時刻20時以降 かつ 今日の学習0分**のシンプルな2条件に限定する。
  凝った疲労推定はしない（誤爆すると鬱陶しいだけ）。
- 回復系候補ゼロ（全部達成済み等）なら黙って次の分岐へ落ちる（if (easy) のガード）。

---

## 3. Phase 4：💬 NPC会話演出（達成時のひとこと＋ギルド昇格の祝い）

### 3.1 NPCの反応セリフ

GUILD_NPCS の直後に追加：

```javascript
// 依頼達成時にNPCが返すひとこと（ランダム）
const GUILD_NPC_LINES = {
  mimi:  ['はい、確かに受領しました！', 'その調子です。ギルドの評判も上がりますよ。', 'お見事です。次の依頼もお待ちしていますね。'],
  garud: ['ふん、悪くない動きだ。', 'その一歩が鍛錬だ。よくやった。', '筋がいいな。明日も来い。'],
  hotta: ['お疲れさん。茶でも飲んでいきな。', 'ええ仕事や。ゆっくりしていき。', '無理はしなさんな。今日はもう十分。'],
  noton: ['記録しました。歴史に残る一件です。', '素晴らしい。ページがまた一枚埋まりました。', 'ふむ、興味深い記録だ…。'],
  rista: ['おかえりなさい。待っていましたよ。', '戻ってこられた。それがいちばん尊いこと。', 'あなたの帰る場所は、ここにありますから。'],
};
```

### 3.2 showGuildToast の拡張

```javascript
function showGuildToast(q) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  const npc = GUILD_NPCS[q.npc];
  const lines = GUILD_NPC_LINES[q.npc] || [];
  const line = lines.length ? lines[Math.floor(Math.random() * lines.length)] : '';
  t.innerHTML = `📜 依頼を達成！<br>` +
    `<span style="opacity:.85;font-weight:400">${q.title}</span>` +
    (line ? `<br><span style="opacity:.75;font-weight:400">${npc.icon}「${line}」</span>` : '');
  // 以降は既存のまま（表示時間だけ 2600 → 3200 に延長：3行になるため）
```

### 3.3 ギルド昇格の祝い（名声ランクが上がった瞬間）

`completeGuildQuest` 内、`guild.fame += q.xp;` の**前後**で格を比較：

```javascript
const prevRank = guildFameInfo().name;   // fame加算の前に取得
guild.fame += q.xp;
// …既存の処理…
const newRank = guildFameInfo().name;    // saveGuild() 後に取得
if (newRank !== prevRank) {
  // 通常トーストの代わりに昇格祝いを出す（受付ミミが祝う）
  t.innerHTML = `🏰 ギルドが格上げ！<br><b>${newRank}</b><br>` +
    `<span style="opacity:.75;font-weight:400">🧝‍♀️「みんなの頑張りのおかげです！」</span>`;
}
```

実装形は任せるが、**昇格時は昇格トーストを優先**し、通常の達成トーストと
二重表示しないこと（bondシステムの昇格優先と同じ思想）。

### 3.4 自信トーストとの競合解決（2026-07-13 追記・Codexの停止報告への回答）

**発見された問題**: completeGuildQuest 内の `addConfidence(q.conf,'guild_quest')` は
120msデバウンス後に同じ `#confidence-toast` へ💪トーストを表示するため、
NPCひとことが0.12秒で上書きされる（§6で予期した competition が実際に発生）。

**決定した方針: トーストは1アクション1枚。ギルド達成時は💪自信トーストを出さない**
（自信+Nの情報はクエストカードの報酬表示が既に担っている。ゲージ本体の加算と
バー描画は従来どおり行う。レベルアップ🎉だけは重要なので silent でも表示する）。

```javascript
// progression.js — 第3引数 opts を追加（既存呼び出しは無変更で互換）
function addConfidence(amount, reason, opts = {}) {
  // …ゲージ加算・saveData・renderConfidence・レベルアップ検知は従来どおり…
  if (!opts.silent) {
    _confPending.amount += amount;
    if (CONFIDENCE_MESSAGES[reason]) _confPending.lastMsg = CONFIDENCE_MESSAGES[reason];
  }
  if (data.confidenceLevel > oldLevel) _confPending.levelUp = data.confidenceLevel;
  clearTimeout(_confFlushTimer);
  _confFlushTimer = setTimeout(_flushConfidenceToast, 120);
}

// _flushConfidenceToast — silent時のレベルアップ単独表示に対応
function _flushConfidenceToast() {
  if (_confPending.amount <= 0 && !_confPending.levelUp) return;
  const { amount: total, lastMsg, levelUp: lvl } = _confPending;
  _confPending = { amount: 0, lastMsg: '', levelUp: 0 };
  if (total > 0) showConfidenceToast(total, lastMsg || '自信が育ちました');
  if (lvl) setTimeout(() => showConfidenceLevelUp(lvl), total > 0 ? 1500 : 0);
}
```

- boot.js: completeGuildQuest の呼び出しだけ `addConfidence(q.conf, 'guild_quest', { silent:true })` に変更
- **fulfillVow（誓いの祠）は変更しない**（祝福モーダルが画面を覆うため実害なし。スコープ最小化）
- タイマーセッション完了などギルド以外の💪トーストは従来どおり

---

## 4. 受け入れ基準

Phase 2:
- [x] バッジ3個未満のユーザーには特別依頼が🔒ロック表示（「称号3個で解放」）される
- [x] gq_badges に3個以上あると g_hirou が解放され、達成でXP/自信/名声が入る
- [x] 特別依頼カードに🎖特別チップが表示される
- [x] weekly の特別依頼は同じ週に2回達成できない／once は一度きり
- [x] 既存17クエストの挙動・既存ユーザーの gq_guild データが無傷

Phase 3:
- [x] 20時以降＆今日0分で、おすすめが回復/精神/暮らし系のやさしい依頼になる（タグ「今日はゆるめ」）
- [x] 同条件でも streakWasBroken 時は「おかえり依頼」が勝つ（優先順位①）
- [x] 20時前 or 今日1分以上 なら従来どおり（挑戦の時／今日のおすすめ）

Phase 4:
- [x] 依頼達成のたびNPCのひとことがトーストに出る（同じNPCでもセリフが変わる）
  ※ Codexが💪自信トーストの上書き競合を発見→§3.4で解消。レベルアップ時の扱いは下記参照
- [x] 名声ランクが上がった瞬間だけ昇格トーストが出て、通常トーストと二重にならない
- [x] トーストが3行でもレイアウト崩れしない（スマホ幅375pxで確認）

共通:
- [x] コンソールエラーゼロ／スモークテスト（起動→タイマー→設定→図鑑→カレンダー→ギルド）合格
- [x] bump_version.sh 実行済み（?v=guild-N が全ファイル一致で+1）

> ✅ **レビュー完了（2026-07-13 クロ）**: Codex実装をブラウザ実機（localhost・375px含む）で
> 全項目検証し合格。レビュー時点の状態＝Phase 2(a707e4e)・Phase 3(efdf952)はコミット済み、
> **Phase 4は作業ツリーに実装済みだが未コミット**（Codex側のコミット承認待ち。内容は仕様と
> 完全一致・guild-73へbump済みを確認）。
> - Phase 2: バッジ0/3/30個で解放境界が正確。false値を数えない保険も動作
>   （31キー中カウント30を確認）。🎖チップ5件・金色表示OK。週1制限OK
> - Phase 3: 21時＆0分→「今日はゆるめ」(g_kokyu/精神)。おかえり＞夜ゆるめ＞挑戦の
>   優先順位を5パターンで確認（時刻はDate.prototype.getHours差し替えで検証・復元済み）
> - Phase 4: 通常達成でNPCひとこと（ミミのセリフ確認）、fame79→84で昇格トースト
>   「駆け出しのギルド」が1回だけ表示・二重なし。3行トーストは375pxで幅188px・はみ出しなし
> - 既存挙動: g_izumi達成・掲示板描画・誓いの祠・設定/図鑑/カレンダー、コンソールエラーゼロ
>
> ⚠️ **訂正（2026-07-13）**: 上記のPhase 4「NPCひとこと」合格判定は誤り。クロのテストは
> 達成直後のinnerHTMLを同期的に読んでおり、120ms後の💪自信トーストによる上書きを
> 見逃していた（Codexが実機観察で発見・§6どおり停止して報告）。§3.4の方針で修正し、
> 再レビューする。他の項目の判定は有効（昇格トーストは自信トーストより情報が優先される
> 場面が2重に出ないことを含め再レビューで最終確認する）。
>
> ✅ **再レビュー完了（2026-07-13 クロ・?v=guild-75）**: 競合解消を実機で最終確認し合格。
> - Codex実装(5e93515): boot.jsに `addGuildConfidenceReward` ラッパーを新設し、
>   addConfidence後に `_confPending`/`_confFlushTimer` をクリアして💪自信トーストの
>   予約を打ち消す方式（§3.4のsilent引数方式とは別実装だが目的は達成）
> - **本丸**: ギルド達成後150ms・500msでもNPCひとことが上書きされず生存
> - **巻き込みなし**: ギルド以外の addConfidence（セッション完了等）は💪トースト従来どおり
> - **レベルアップの扱い（ヨージ決定2026-07-13「その回だけ🎉優先」）**: Codexの全消し実装
>   では自信レベルアップ演出も消えていた（超レア・演出のみ）。クロが小修正:
>   addGuildConfidenceReward が昇格レベルを返し、レベルアップ回は showConfidenceLevelUp を
>   NPC/昇格トーストより優先（?v=guild-75）。検証: 自信99→依頼達成でLv2昇格時🎉表示・
>   300ms生存／通常回はNPCひとこと／昇格トースト維持／スモーク全OK・コンソールエラーゼロ
>
> **Phase 2〜4 完了。** 残タスク: mainのpush（本番デプロイ）。

## 5. テスト手順

1. プレビューで `localStorage.clear()` → reload → ギルドを開く
   → 特別依頼5件がすべて🔒（称号N個で解放）表示
2. コンソールで `localStorage.setItem('gq_badges', JSON.stringify({a:1,b:1,c:1}))`
   → reload → g_hirou だけ解放されている → 達成 → 🎖チップ・NPCひとこと・報酬を確認
3. バッジ30個ぶんを同様に注入 → 5件すべて解放 → g_eiyu（once）を達成 → reload しても達成済みのまま
4. コンソールで時刻条件を確認：20時以降に today 0分の状態でギルドを開く
   →「今日はゆるめ」推薦（20時前のテストは `new Date().getHours()` の分岐を一時的に
   `>= 0` にして確認後、必ず戻す。戻し忘れ注意）
5. F依頼を連続達成して名声ランク境界（80）をまたぐ → 昇格トーストが1回だけ出る
6. 既存データ（達成履歴あり）で開いて掲示板・おすすめ・誓いの祠が従来どおり

## 6. 迷ったら止まって報告

- gq_badges の値の形が想定（id→truthy）と違う
- confidence-toast の流用で他機能のトーストと競合が見つかった
- 昇格判定を completeGuildQuest 以外（fulfillVow の名声+50 等）にも
  入れるべきか迷った場合（→ 今回は completeGuildQuest のみでよい。祠は対象外）

## 7. Codexへの依頼文（コピペ用）

```text
docs/spec_guild_phase2-4.md に従って実装してください。
- 1 Phase = 1コミット（Phase 2 → 3 → 4 の順）。各コミット後にスモークテスト。
- 着手前に gq_badges の保存形式を settings-genre.js で確認して報告してから開始。
- boot.js/app.css を編集したら bash tools/bump_version.sh を実行。
- §5のテスト手順で確認して報告。挙動に迷ったら §6 に従い止まって報告してください。
```
