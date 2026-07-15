# 仕様書：各ファイルのIIFE化（Phase D / 弱点1「グローバル名前空間の共有」の根治）

作成: 2026-07-15 ／ 設計: クロ（Fable 5）／ 実装担当: Codex
親: [architecture_review.md](architecture_review.md) §3 弱点1 / §5 Phase D
⚠️ **このプロジェクトで最もデリケートな作業**。過去に起動フリーズを2回起こした弱点そのもの。
他のJS作業と同時進行しない。**1コミット＝1ファイル**、各コミット後に必ず起動スモーク。

---

## 1. 何を解決するか（そして何は解決しないか）

8本のJS（otomon.js除く）の**653個のトップレベル宣言が、すべて1つのグローバル空間に同居**
している。どのファイルの関数・変数も互いに丸見えで、

- 名前の衝突が起きても気づけない
- どのファイルがどの状態を触るのか、全部読まないと分からない
- **読み込み順の罠**（宣言前のletを別ファイルがload時に参照＝TDZ/巻き上げ切れ）
  で過去2回、起動フリーズした（`testCloudNotify`巻き上げ切れ / `featUnlocks`のTDZ）

Phase D は、各ファイルをIIFE（即時実行関数 `(function(){ ... })();`）で包み、
**外に出す必要があるものだけ明示的に公開**する。これで「うっかり共有」を構造的に潰す。
お手本は既に存在する＝`otomon.js`（唯一 `window.Otomon` に包まれ、公開は12個だけ）。

### ⚠️ このPhaseで「やらないこと」（スコープ境界）
- **共有ミュータブル状態を名前空間オブジェクトへ全面移設すること**（`data`等を全部
  `GQ.state.data`にして全アクセスを書き換える）は**やらない**。それはESモジュール級の
  大工事で、architecture_review.md §5-E が「今はやらない」と結論済み。本Phaseは
  **可変状態はグローバルのまま残し、関数と定数のスコープだけ閉じる**（下記§3の技法で両立する）
- ビルド導入・importも**やらない**（依存ゼロの強みを壊さない）

---

## 2. 現状の実測（この設計の根拠・2026-07-15）

各ファイルの「他ファイルから読まれる可変状態(let/var)の数」＝**IIFE化の急所の数**。
少ないほど安全に包める。この昇順が移行順になる。

| 順 | ファイル | 定義関数 | 他ファイル参照される関数 | **急所（他ファイルが読む可変状態）** |
|---|---------|--------|----------------|------------------|
| 1 | quests.js | 17 | 4 | **0** ✅最安全 |
| 2 | features.js | 55 | 18 | 1（avatarType） |
| 3 | timer.js | 37 | 4 | 3（currentMode, remaining, elapsed） |
| 4 | calendar-review.js | 77 | 16 | 4（weeklyReviews, rvWeekKey, rvPeriod, rvAnchor） |
| 5 | boot.js | 109 | 14 | 5（featUnlocks, tlAnchor, dayLog, playerName, guild） |
| 6 | settings-genre.js | 41 | 6 | 6 |
| 7 | progression.js | 30 | 7 | 10 |
| 8 | **core.js** | 81 | 29 | **13**（data, settings, genres…）最難関・**任意/最後** |

---

## 3. 安全技法（これが本仕様の核心）

### 3.1 「包んで、window に再公開」すれば呼び出し側は無改修

依存ゼロの素のscript（module ではない）では、**裸の識別子 `foo()` は、まず各スコープを
探し、最後に window のプロパティを探す**。この性質を使う：

```javascript
// 変更前（quests.js 全体がグローバル）
function completeQuest(id) { ... }
function renderStats() { ... }
let dailyQuests = load();          // このファイル専用の状態

// 変更後（IIFEで包む）
(function () {
  function completeQuest(id) { ... }   // ← IIFE内に閉じる（他からは見えなくなる）
  function renderStats() { ... }
  let dailyQuests = load();            // ← 完全にプライベート化（誰も触れない）

  // 他ファイルから呼ばれる関数だけ、最後に明示公開
  window.completeQuest = completeQuest;
  window.renderStats   = renderStats;
  window.renderStreak  = renderStreak;
  window.updateStreak  = updateStreak;
})();
```

**ポイント**: `window.completeQuest = completeQuest` としておけば、
他ファイルの `completeQuest(id)` という**既存の呼び出しは1文字も変えずに動く**
（裸の `completeQuest` が window.completeQuest に解決される）。
→ 呼び出し側の一括置換は不要。触るのは「包む1ファイルだけ」。

### 3.2 3つのカテゴリと扱い（急所の見分け方）

| 種類 | 扱い | 理由 |
|------|------|------|
| **関数・const**（再代入されない） | IIFE内に入れ、末尾で `window.名前 = 名前` | 参照が安定。安全 |
| **可変状態で、他ファイルが読まない** | IIFE内に入れるだけ（公開しない） | **これが目的＝真のプライベート化** |
| **可変状態で、他ファイルが読む＝急所** | §3.3 の判定へ | window スナップショットが古くなる恐れ |

### 3.3 急所（他ファイルが読む可変状態）の安全な扱い

`window.X = X` は**代入した瞬間の値／参照をコピー**する。だから：

```text
① Xがオブジェクトで「中身だけ書き換え」（X.fame += 5, X.push(...)）
   → window.X = X は同じオブジェクトを指し続ける → 安全。末尾で1回公開すればOK
     例: guild（guild.fame += ... のみ。guild自体は再代入しない）→ 安全

② Xの「変数自体を再代入」する（X = loadX(), playerName = 新名前）
   → window.X は古い値のまま取り残される → ★危険★
   → 対策: その変数だけは IIFE の外に出し、素のトップレベル宣言のまま残す
     （＝そのファイルのIIFEに含めない。1〜2個の例外として明示コメントを付ける）
```

**判定手順（Codexが着手前に必ず実行）**:
各急所変数 `X` について、そのファイル内を `X =`（代入。`X.` や `X ==` は除く）で検索。
- ヒットしない（中身書き換えのみ）→ ①扱い。IIFE内でOK＋末尾公開
- ヒットする（再代入あり）→ ②扱い。**その宣言だけIIFE外に残す**

---

## 4. 移行順とコミット分割（1コミット＝1ファイル）

§2の急所昇順で進める。**D-1（quests.js）を最初の実証**とし、挙動と手順を固める。

- **D-1: quests.js**（急所0）— 公開4関数（completeQuest / renderStats / renderStreak /
  updateStreak）。load時の `GQ.on('session:complete', …)` 2本はそのまま（GQはcore.jsの
  トップレベルconstで、IIFE内から裸の `GQ` で解決される）。**最も安全＝パターン確立用**
- **D-2: features.js**（急所1: avatarType）
- **D-3: timer.js**（急所3）
- **D-4: calendar-review.js**（急所4）
- **D-5: boot.js**（急所5。featUnlocks＝過去フリーズ元。load時のイベント配線が多いので慎重に）
- **D-6: settings-genre.js**（急所6）
- **D-7: progression.js**（急所10）
- **D-8: core.js**（急所13・**任意**）— `data`/`settings`/`genres`/`currentGenreId`/
  `editingGenreId` など再代入される中枢状態が多い。**これらはIIFE外に残す**。
  リスクに見合わないと判断したら**D-8は見送ってよい**（7/8ファイル閉じれば目的はほぼ達成）。
  `const GQ`/`Overlay`/`MODES`/`DEFAULT_DATA` を包むなら必ず `window.GQ = GQ` 等で再公開し、
  他ファイルの裸参照が window 経由で解決できるようにする

各ファイルの「公開が必要なシンボル一覧」は、着手時に次で生成して報告してから始める。
⚠️ **function だけでなく const/let/var も対象**（D-3で `const timeWrapper` の公開漏れが
起動フリーズを起こした教訓。DOM参照のconstも他ファイルがロード時に読む）。インデント宣言も拾う：
```bash
# 定義形(function/const/let/var)・インデント問わず全シンボルを抽出し、他ファイル参照ありを列挙
syms=$(grep -oE "(^|[[:space:]])(function|const|let|var) [A-Za-z_][A-Za-z0-9_]*" scripts/対象.js | awk '{print $NF}' | sort -u)
for s in $syms; do
  o=$(grep -lwE "\b$s\b" scripts/*.js | grep -v "/対象.js"); [ -n "$o" ] && echo "$s ← $o"
done
```

> ✅ **D-1（quests.js）レビュー完了（2026-07-15 クロ・?v=guild-83）**: 精査＋実機で検証し合格。
> パターン確立成功、以降のファイルも同型で進めてよい。
> - **差分**: quests.js全体を `(function(){ … })();` で包み、末尾で cross-file参照される
>   4関数を公開（`window.completeQuest/renderStats/renderStreak/updateStreak`）。呼び出し側は無改修
> - **公開の過不足チェック（静的・全シンボル総ざらい）**: quests.jsの全トップレベルシンボルを
>   抽出し「他ファイル参照あり かつ 未公開」を検索→**該当ゼロ**（4関数で過不足なし）。
>   逆に4関数はすべて実使用（completeQuest←progression/timer、renderStats←boot/progression/
>   settings-genre、renderStreak←core/timer、updateStreak←timer）
> - **実機**: **起動フリーズなし**（app描画・本文表示を確認）／4関数が裸識別子＋window両方で解決／
>   プライベート化が本物（DAILY_QUESTS・dailyQuests・renderDailyQuests は window に漏れない）／
>   load時の `GQ.on('session:complete',…)` 2本もIIFE内から裸のGQで解決し正常動作／
>   実セッション完了(5分)でXP+25・デイリークエスト2件達成・連続1日＝timer.jsからの
>   cross-file呼び出しが実行時に繋がることを確認／設定・図鑑・カレンダーOK・コンソールエラーゼロ
> - **収穫**: dailyQuests等の内部状態が真にプライベート化＝「うっかり共有」が1ファイル分、構造的に消えた

> ✅ **D-2（features.js）レビュー完了（2026-07-15 クロ・?v=guild-84）**: 精査＋実機で検証し合格。
> **急所（再代入される可変状態）の扱いパターンも確立。**
> - **差分**: features.js本体をIIFEで包み、cross-file参照される関数・定数21個を公開。
>   急所 `avatarType` は §3.3判定どおり **IIFE外にトップレベルletとして残す**（理由コメント付き）
> - **急所判定の裏取り**: `avatarType = …`（代入）を全ファイル検索→ boot.js:1702/1730・
>   settings-genre.js:76 で**実際に再代入**を確認。よってIIFE外に残す判断は正しい。もしIIFE内に
>   入れて window公開していたら、外部の再代入とIIFE内 adventurerName() の読む値がズレる事故になった
> - **公開の過不足チェック（全シンボル総ざらい・IIFE外globalも考慮）**: 未公開の外部参照→**該当ゼロ**
> - **実機**: **起動フリーズなし**／急所連動を実証＝外から `avatarType='B'` に再代入すると
>   features.js内 `adventurerName()` が「レン→ミア」に追従（同一bindingを共有できている）／
>   `avatarType` は window非公開のまま（正しい）／アバター・スキルツリー・図鑑モーダル開閉OK／
>   セッション完了でcheckSkillUnlocks購読(IIFE内)が発火しXP+25／コンソールエラーゼロ
>   （※検証中 playerName が空でfallback名表示になったが、これはテスト手順の副作用でD-2起因ではない。
>   playerNameはboot.jsの未ラップglobalで、空ならfallback名は仕様どおりの挙動）

> ✅ **D-3（timer.js）レビュー完了（2026-07-15 クロ・?v=guild-85）**: 起動フリーズ級のバグを
> **1件検出し修正して**合格。**このPhaseの警戒が的中した回。**
> - **差分**: timer.js本体をIIFEで包む。timer.jsは既にPiP用の内側IIFEを持つため二重入れ子に
>   なるが、括弧バランスは健全（外側=9行目〜末尾／内側PiP=1011〜1017で自己完結）を確認。
>   急所 currentMode（settings-genre.js:15で再代入）はIIFE外に残す＝正しい。remaining/elapsed
>   もIIFE外に残されたが、他ファイルの同名参照は無関係なローカルconstで実は非共有＝残しても無害
> - **🔴検出した重大バグ（Codexのexport漏れ）**: `const timeWrapper`(DOM参照)が公開されず、
>   **settings-genre.js:9 がロード時に `timeWrapper` を参照→ReferenceError→settings-genre.js以降の
>   ロードが連鎖崩壊**。結果 boot.js の全global(featUnlocks/guild/vows/vowFormOpen…)がTDZになり、
>   **ギルド・すごろく盤・スキルツリー・段階解放・INITが全滅**（画面は他ファイルが描くので一見起動して見える）。
>   まさに§1で警告した「ロード時のファイル跨ぎ参照＝過去2回のフリーズ型」の再来
> - **診断過程**: git stashでguild-84と比較しD-3起因を確定→boot.js全globalがTDZと判明→
>   index.headに一時 window.onerror を仕込んでロード時エラーの発生元(settings-genre.js:9 timeWrapper)を特定
> - **修正（クロ・小さな修正）**: timer.js末尾に `window.timeWrapper = timeWrapper;` を追加（§3.2の
>   「constも公開」どおり）。**検証**: boot.js全global復活・ギルド/すごろく盤/設定ボタン復活(修正前は全滅)・
>   timeWrapper解決・タイマーstart/stop・図鑑・カレンダーOK・（fix後の新規ロードで）timeWrapperエラー消滅
> - **⚠️教訓（仕様書§4のチェックレシピを強化済み）**: export漏れ検出は **function だけでなく
>   const/let/var・インデント宣言も対象**にしないと危険（初回の静的チェックが `^function` 限定で
>   timeWrapper=constを見逃した）。D-4以降は強化版レシピ（§4）で全シンボルを洗うこと

> ✅ **D-4（calendar-review.js）レビュー完了（2026-07-15 クロ・?v=guild-86）**: 精査＋実機で検証し合格。
> D-3の教訓を反映した強化レシピで臨み、**公開漏れゼロを確認**（D-3の再発なし）。
> - **差分**: calendar-review.js本体をIIFEで包み、cross-file参照される17シンボルを公開
>   （renderCalendar/checkWeeklyReviewTrigger/getWeekKey/analyzeDays/escHtml/DOW_LABELS/
>   testCloudNotify 等。過去フリーズ元の testCloudNotify も忘れず公開）
> - **急所4個の扱い（全て正しくIIFE外に残す）**: weeklyReviews(settings-genre.jsが読む・
>   内部で再代入)／rvWeekKey・rvPeriod・rvAnchor(**boot.js:315-320が再代入**し読む)。
>   weeklyReviewsは「外で `let weeklyReviews;` 宣言→IIFE内で代入」の分離パターン＝正しい
> - **強化版・公開漏れチェック（function/const/let/var・インデント問わず全シンボル）**: 検出ゼロ✅
> - **実機（D-3の教訓＝サイレント死を最重点）**: boot.js全global生存(featUnlocks/guild/vowFormOpen/
>   UNLOCK_DEFS)＝**boot.jsサイレント死なし**／calendar-review自身のglobalも生存／17公開関数すべて解決／
>   カレンダー描画・週次レビュー起動・急所連動(rvPeriod外部再代入→renderReviewBody通過)／
>   ギルド・すごろく盤・設定・図鑑ボタンOK(boot配線健全)／コンソールエラーゼロ
> - **偽陽性の切り分け**: review-bodyが空に見えたが、①innerTextは非表示要素で空を返す性質②git checkoutで
>   guild-85(未ラップ)と比較したところ同条件で同じく空＝**合成データ由来の元挙動でD-4起因ではない**と確定

> ✅ **D-5（boot.js）レビュー完了（2026-07-15 クロ・?v=guild-87）**: **最難関ファイル**（全イベント配線＋
> INIT＋段階解放、2790行・109関数）を精査＋実機で検証し合格。公開漏れゼロ・起動フリーズなし。
> - **差分**: boot.js本体をIIFEで包み、cross-file参照される20シンボルを公開（handleBoardClose/
>   evaluateUnlocks/renderOnboarding/タイムログ系11個/renderEquipmentModal/showEquipmentGetModal/
>   guildPickRecommended＋const UNLOCK_DEFS/TIMELOG_CATS/_tlCat/_tlToMin/_tlDur/_tlFmtH）。
>   D-3の教訓どおりconstも公開できている
> - **急所5個の扱い（分離パターン・全て正しい）**: featUnlocks/tlAnchor/dayLog/playerName/guild を
>   **IIFE外で `let X;`(未初期化)宣言 → IIFE内で `X = loadX()`(letなし代入)**。全5個でシャドウイング
>   (IIFE内のlet/const再宣言)が無いことをRead精査で確認＝外側bindingが正しく共有される
> - **強化版公開漏れチェック（function/const/let/var全シンボル）**: 検出ゼロ✅。未公開のboot.js const
>   (GUILD_NPCS/SUMMON_*/VOW_PRAISES等)は他ファイル非参照＝非公開で正しい
> - **実機（サイレント死を最重点）**: 末尾export(guildPickRecommended/showEquipmentGetModal)まで到達
>   ＝**boot.js完走・フリーズなし**／急所5個に正しい値(featUnlocks=Set,guild=obj,tlAnchor=Date,dayLog=obj,
>   playerName=string)／private化が本物(vows/vowFormOpen/openGuildはwindow非公開)／
>   ギルド・すごろく・スキル・ジャンル・設定・妖精ガイド・レビュー・図鑑・タイマー全機能OK(ボタン＋直接)／
>   コンソールエラーゼロ
> - **偽陽性の切り分け**: `void vows`/`openGuild()`直接呼びが"not defined"になったが、これは
>   **正しくprivate化された証拠**（boot.js内部専用シンボル）。ギルドボタン自体はOK＝boot内部配線が健全
> - **診断メモ**: 分類器(Bash)一時障害中はRead精査で急所シャドウ確認を先行、復旧後に静的チェック＋実機。
>   boot.jsは8番目ロードなので、公開漏れがあっても「他ファイルの実行時参照が失敗」型が主(otomon除く)で
>   D-3のような即・白画面より発見が遅れやすい→実機の機能テストで担保した

> ✅ **D-6（settings-genre.js）レビュー完了（2026-07-15 クロ・?v=guild-88）**: 精査＋実機で検証し合格。
> - **差分**: settings-genre.js本体をIIFEで包み、cross-file参照される44シンボルを公開（applySettings/
>   exportAllData/importAllData/renderGenreSelector/genreIcon/checkBadges/openBadgesModal/BADGES/
>   QUOTES/pickQuote/renderDailyQuote/EMOJI_OPTIONS/COLOR_OPTIONS 等。関数＋constを網羅）
> - **急所6個の扱い（分離パターン・全て正しい）**: earnedBadges/sessionStartHour/lastLevelUp/
>   lastStreakMilestone/lastAvatarEvolution/currentKokuQuote を IIFE外で `let X;`宣言→IIFE内で
>   `X = …`(letなし)代入。全6個シャドウイング無しを確認
> - **強化版公開漏れチェック（全シンボル）**: 検出ゼロ✅
> - **実機**: boot.js完走(featUnlocks/guild/UNLOCK_DEFS生存)＝**フリーズなし**／急所6個に正しい値
>   (earnedBadges=obj/sessionStartHour=number/lastLevelUp=boolean/currentKokuQuote=object)／
>   44公開関数解決／private化(badgesFilter/currentDailyQuoteはwindow非公開)／
>   設定・ジャンル・バッジ・名言・ギルド・すごろく・タイマー全OK／コンソールエラーゼロ

**Phase D 進捗: D-1〜D-6 完了（8ファイル中6つがIIFE化）。残り D-7 progression(急所10) / D-8 core.js(急所13・任意)。**

---

## 5. 受け入れ基準（各コミット共通）

- [ ] 対象ファイルが `(function () {` … `})();` で包まれている
- [ ] 他ファイルから参照される関数・定数が**すべて** `window.名前 = 名前` で公開されている
      （§4のgrepで洗い出した一覧と一致）
- [ ] 他ファイルが読まない状態はプライベート化されている（公開していない）
- [ ] 再代入される急所変数は IIFE 外に残し、コメントで理由を明記
- [ ] **起動フリーズなし**・コンソールに ReferenceError / undefined 由来のエラーなし
- [ ] セッション完了・図鑑・すごろく等、そのファイルが関わる機能が移行前と同一挙動
- [ ] `bash tools/bump_version.sh` 実行済み

## 6. スモークテスト（各コミット後・フリーズ検知が主眼）

```text
① 起動（真っ白＝フリーズ。コンソール即確認）
② localStorage.clear() → reload → 召喚が最後まで進む
③ タイマー START → STOP（1分未満）→ 何も壊れない
④ タイマーで5分相当を完了 → 告・すごろく・統計・バッジ・自信・オトモン応援
⑤ 設定 / ギルド / カレンダー / 図鑑 を開閉
⑥ コンソールエラー 0
```
特に③④は「ファイル間参照が実行時に切れていないか」を撃つ。①は「load時参照切れ＝フリーズ」を撃つ。

## 7. 安全停止条件（1つでも起きたら作り変えず報告）

- 起動が白画面になった（＝load時参照切れ。**最優先で報告**）
- どこかで `X is not defined` / `Cannot read properties of undefined`
- 公開したはずの関数が他ファイルから見えない（window公開の漏れ）
- 再代入される状態を他ファイルが読んでいて、値が古くなる兆候
- 移行前と挙動が変わった
- 仕様にない判断が必要になった（特にcore.jsの中枢状態の扱い）

## 8. なぜこの順序・この技法が安全か（設計メモ）

- IIFEは**load時に実行される**。だが「包む」こと自体は実行タイミングを変えないので、
  **新たなload時参照は生まれない**。むしろ、うっかり書かれていた
  load時クロスファイル参照が「未定義」で**大きな声で失敗するようになり**、
  隠れていた地雷（過去2回のフリーズ型）を早期に炙り出せる
- `window.名前 = 名前` 再公開により**呼び出し側を書き換えないので、diffが対象1ファイルに閉じる**。
  レビューも1ファイル単位で完結し、いつでも止められる
- 急所が0のquests.jsから始めるので、最初のコミットは**関数を公開するだけ＝ほぼ無リスク**。
  ここでパターンを固めてから、急所の多いファイルへ段階的に進む

## 9. Codexへの依頼文（コピペ用）

```text
docs/spec_iife_namespacing.md に従って実装してください。
- 1コミット=1ファイル。移行順は §4（quests.js から。core.js=D-8 は任意・最後）。
- 着手する各ファイルで、まず §4 のgrepで「公開が必要な関数一覧」を出して報告してから包む。
- §3.3 の判定（急所変数が再代入されるか）を必ず実行し、再代入される変数はIIFE外に残す。
- 各コミット後に §6 のスモーク（特に起動＝白画面フリーズの確認）。
- 起動が白くなる/挙動が変わる/未定義が出たら、作り変えずに §7 に従い止まって報告。
- app.js系を編集したら bash tools/bump_version.sh を実行。
まず D-1（quests.js）だけを実装して報告してください。そこでパターンを確認してから次へ進みます。
```
