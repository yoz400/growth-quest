# Growth Quest 技術品質・パフォーマンス・データ安全レビュー

作成: 2026-07-27 ／ 担当: テツ（技術品質・パフォーマンス・データ安全担当）
対象コミット: `4b1ea17`
方針: 「動いているから大丈夫」を疑う。すべての指摘に `ファイル:行番号` を付ける。今回はコードを一切変更していない（調査のみ）。

---

## 1. 総評（3行）と危険度ランキングTOP5

サーバーが無くlocalStorageだけで1年分の記録を守る設計は、`try/catch`によるJSON読み込みの防御がほぼ全箇所にあり、思ったより頑丈だった。一方で「保存（`setItem`）」側の防御は**ゼロ**で、バックアップの復元やPWA(オフライン動作)の仕組みには実際に壊れている・すり抜けている箇所がある。今すぐ壊れているわけではないが、次の「1つの事故」で記録が消える／古い画面のまま固まる、という土台になっている。

**危険度ランキングTOP5**

| 順位 | 問題 | 影響 |
|---|---|---|
| 🥇1 | Service Worker (`sw.js`) の事前キャッシュが**存在しないファイルを参照**しており、オフライン用キャッシュが丸ごと失敗している可能性が高い | PWA（ホーム画面アプリ）としてのオフライン動作が機能していない |
| 🥈2 | `growthPraiseLogs`（褒めログ）が**バックアップ／復元の対象から漏れている** | エクスポートしても褒めログだけ復元できない。唯一の`gq_`接頭辞違反が実害化している |
| 🥉3 | **保存系関数（`localStorage.setItem`）に例外処理が1つも無い** | 容量上限(約5MB)に達した瞬間、そのセーブ処理が無言で失敗し、以降の画面更新も止まる |
| 4 | `importAllData()`にロールバックが無い | 復元中に例外が起きると、新旧データが混ざった中途半端な状態で保存される |
| 5 | `otomon.js`だけ独自のキャッシュ番号（`?v=otomon-45`）を使っており、`tools/bump_version.sh`の対象外 | otomon.js を直しても「直したのに直ってない」現象が再発しうる（掟1が事実上片手落ち） |

---

## 2. データ消失リスクの検証結果

### 2-1. `exportAllData()` の実装（scripts/settings-genre.js:99-113）

```js
function exportAllData() {
  const out = { _app: 'GrowthQuest', _version: 1, _exportedAt: new Date().toISOString(), data: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('gq_')) out.data[k] = localStorage.getItem(k);
  }
  ...
}
```

**重要な発見**: 台帳の50キーを1つずつハードコードしているわけではなく、localStorageを全走査して`gq_`で始まるキーを**自動で**拾っている。これは良い設計で、「新しいキーを追加したのに台帳登録漏れでexportから漏れる」という事故は原理的に起きない（`gq_`接頭辞さえ守れば自動的に救われる）。

**しかしこれが仇になっている箇所が1つ**: `growthPraiseLogs`（scripts/progression.js:249,253）は`gq_`接頭辞ではないため、この自動走査に**引っかからない**。`importAllData()`（scripts/settings-genre.js:115-131, 特に123行目 `keys = Object.keys(parsed.data).filter(k => k.startsWith('gq_'))`）も同じ理由で復元対象から外れる。

→ **架空のシナリオではなく、コードを読んだ時点で確定している事実**: ヨージが「データのエクスポート」ボタンを押しても、褒めログ（`growthPraiseLogs`）は絶対にバックアップファイルに入らない。端末を機種変更してバックアップから復元しても、褒めログの履歴だけ空になる。

### 2-2. 台帳 vs 実コード vs export対象（全53キーの突き合わせ）

`docs/architecture_review.md` §6 の台帳（見出しは「50キー」だが実際に列挙されているのは52件）と、コード中の`localStorage.setItem/getItem`実測（grepで確認、変数経由のキー名も含む）を突き合わせた。

| 分類 | 結果 | 件数 |
|---|---|---|
| 台帳にあり・実コードにあり・exportにも入る（正常） | ○○○ | 51件（`gq_`接頭辞キー） |
| 台帳にあり・実コードにあり・**exportには入らない**（🔴データ消失） | ○○✗ | `growthPraiseLogs` の1件のみ |
| **台帳に無い**・実コードにはある・exportには入る（掟5違反だが実害無し） | ✗○○ | `gq_widget_order`（boot.js:1242）, `gq_guide_tutorial_seen`（features.js:632）の2件 |

- `gq_widget_order`: ダッシュボードのウィジェット並び替え機能の保存先（boot.js:1242, 1250, 1256, 1284）。台帳未記載だが`gq_`接頭辞なのでexportAllData()には自動で含まれる。**データ消失リスクは無い**が、掟5（台帳追記）違反。
- `gq_guide_tutorial_seen`（features.js:632, 733, 752, 780, 787）: 妖精ガイドのチュートリアル既読フラグ。同様に台帳未記載だが実害なし。

**結論**: 「台帳に無いキーがexportから漏れる」という心配していた事故パターンは実際には起きていない（自動走査のおかげ）。唯一かつ確実に起きているのは、`gq_`接頭辞ルールそのものを破っている`growthPraiseLogs`の消失である。

### 2-3. インポート（復元）処理の頑丈さ検証（scripts/settings-genre.js:115-131）

```js
function importAllData(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    let parsed;
    try { parsed = JSON.parse(ev.target.result); } catch { alert('...'); return; }
    if (!parsed || parsed._app !== 'GrowthQuest' || !parsed.data) { alert('...'); return; }
    const keys = Object.keys(parsed.data).filter(k => k.startsWith('gq_'));
    if (!keys.length) { alert('...'); return; }
    if (!confirm(`...`)) return;
    keys.forEach(k => localStorage.setItem(k, parsed.data[k]));   // ← ここに例外処理が無い
    alert('復元しました。ページを再読み込みします。');
    location.reload();
  };
  reader.readAsText(file);
}
```

良い点:
- JSON構文エラー（壊れたファイル）はcatchしてアラートを出す（119行目）
- `_app`と`data`の存在チェックで「別アプリのファイルを誤って読ませる」事故を防いでいる（120行目）

弱い点:
- `_version`フィールドは書き出す（100行目）が、インポート時に一切チェックしていない。将来データ構造が変わった時の移行（マイグレーション）経路が無い、いわば「飾りのバージョン番号」
- 126行目の`keys.forEach(k => localStorage.setItem(k, parsed.data[k]))`に**try/catchが無い**。容量超過（後述）などで途中の1件が失敗すると、そこで例外が飛んで`forEach`が止まる。結果、**新バックアップの一部キーだけが上書きされ、残りは古いまま**という中途半端な状態でエラーメッセージも出ずに終わる（`alert('復元しました')`すら出ない＝ヨージには何が起きたか分からない）
- 各キーの値の中身（本当に正しいJSON文字列か）は検証していない。手動編集された壊れたバックアップを読ませても、この時点ではエラーにならず、次回`loadXxx()`が呼ばれた瞬間に（幸い）try/catchでデフォルト値にフォールバックする設計なので致命傷にはならない

---

## 3. パフォーマンス実測値

### 3-1. 初回読み込みの主要ファイル（実測バイト数）

| ファイル | 原本サイズ | gzip後（推定・実測） |
|---|---|---|
| index.html | 44,901 B | 11,166 B |
| styles/app.css | 234,646 B | 45,502 B |
| scripts/core.js | 110,439 B | 33,559 B |
| scripts/otomon.js | 226,645 B | 58,973 B |
| scripts/boot.js | 135,801 B | (未計測) |
| scripts/calendar-review.js | 102,772 B | (未計測) |
| scripts/settings-genre.js | 104,373 B | (未計測) |
| scripts/features.js | 77,012 B | (未計測) |
| scripts/timer.js | 40,626 B | (未計測) |
| scripts/progression.js | 22,954 B | (未計測) |
| scripts/quests.js | 22,229 B | (未計測) |
| **HTML+CSS+JS合計** | **1,122,398 B（約1.10MB）** | **299,768 B（約293KB）** ※9ファイル全部gzip実測 |

GitHub PagesはHTTP圧縮(gzip/brotli)を自動で行うため、実際にブラウザが転送でダウンロードする量は約293KBに近い。初回表示としては軽い部類。**scripts/otomon.js(227KB)がJS内最大**で、9本合計(約830KB)の1/4強を占める。

### 3-2. 初期表示で読まれる画像（index.html直参照分）

| ファイル | サイズ |
|---|---|
| assets/guide-fairy-smile.webp | 27,502 B |
| assets/icons/icon-180.png | 35,674 B |
| assets/icons/icon-32.png | 2,271 B |
| assets/icons/icon-16.png | 792 B |
| assets/logo/logo-mark-64.png | 6,391 B |
| assets/ogp.jpg | 47,587 B（※これはOGP用meta参照のみで、通常のブラウザ表示では実際にはダウンロードされない） |

初期表示に直接効く画像は実質**約72KB**（ogp.jpg除く）。アバター・装備・オトモン図鑑などの画像（`assets/`全体で16MB、199枚のwebp）は各画面を開いたときにJSから動的に参照される想定で、初回表示の重さには影響していない（コード上、index.htmlに直接埋め込まれていないことを確認済み）。

### 3-3. assets/ の内訳と「使われていない重量物」

- `assets/`全体: **16MB**（199 webp + 8 png + 6 svg等）
- 使われていない可能性が高いファイル（コード全文grepで一切参照が見つからない）:
  - `assets/icons/icon-512-source.png`（**812KB**、`icon-512.png`とは別に存在。マニフェストにもコードにも一切参照無し）
  - `assets/avatar/costumes/raw/`（1.6MB）、`assets/otomon/*/source/`（tomoshibi_bat 244KB, mame_drako 64KB, korokoro_iwamogu 36KB, amedama_slime 32KB, tsuyukusa_pixie 68KB）… 画像生成時の元データと思われる「source/raw」フォルダ群、合計約**2.0MB**
  - これらは合計で約**2.8MB**。ブラウザの表示速度には影響しない（誰も参照していないので誰もダウンロードしない）が、リポジトリ／GitHub Pagesのデプロイサイズを不必要に膨らませている

### 3-4. `sw.js` のキャッシュ戦略と「更新されない罠」

- `sw.js:5` の `CACHE_NAME = 'gq-cache-v12'` は、git履歴を見る限り**初期コミット以降ほぼ更新されていない**（直近で触られたのは「WebP切替」コミットのみ）。`tools/bump_version.sh`はindex.htmlの`?v=guild-N`しか書き換えないため、**sw.jsのCACHE_NAME更新は完全に手動・別ルート**。
  - 実害: URLに`?v=guild-N`のクエリが含まれるので、CSS/JS自体は新バージョンをちゃんと再取得できる（クエリ文字列が変わればキャッシュキーも変わるため）。ただし**古いバージョンのキャッシュエントリが同じCACHE_NAME内にずっと溜まり続ける**（`activate`のクリーンアップは「CACHE_NAME自体が変わった時」しか働かない＝boot.js:69-81参照ではなくsw.js:69-81）。長期的にはService Worker用のCache Storage容量が肥大化する。
- **より深刻な問題**: `sw.js:12` の `PRECACHE_URLS` に `'./scripts/app.js'` が含まれているが、**このファイルは存在しない**（実際は`scripts/core.js`ほか9本に分割済み。CLAUDE.md記載の構成と一致）。
  ```js
  // sw.js:8-13
  const PRECACHE_URLS = [
    './',
    './index.html',
    './styles/app.css',
    './scripts/app.js',      // ← 存在しないファイル
  ```
  `caches.open(...).then(cache => cache.addAll(PRECACHE_URLS))`（sw.js:62）は**1つでも404が返るとPromise全体がreject**される仕様（`Cache.addAll`の仕様）。つまり**install時の事前キャッシュが丸ごと失敗している可能性が高い**。さらに実際の9本のJSファイル（core.js〜boot.js、otomon.js）は誰もPRECACHE_URLSに入っていないため、たとえaddAllが通ってもJS本体はキャッシュされない。
  → 実質的に「オフラインで開ける」というPWAの売り文句が機能していない疑いが強い（このテツの調査はコードの静的読解のみで、実機のオフライン動作確認は別担当の役割）。

---

## 4. 掟（docs/architecture_review.md §4）の違反箇所一覧

| # | 掟 | 状況 |
|---|---|---|
| 1. bump_version.sh実行 | △ 部分違反 | `scripts/otomon.js`（index.html:970）だけ`?v=otomon-45`という独自のクエリ名で、`bump_version.sh`のsedパターン`s/v=guild-[0-9]*/.../`にはヒットしない（tools/bump_version.sh 全文参照）。CSS/他8本のJSはguild-Nで統一されており問題なし |
| 2. ファイルまたぎ読み込み時参照の禁止 | ○ 違反なし（サンプリング確認） | 全9ファイルがIIFEで包まれ(`(() => { ... })()`)、他ファイルの関数参照は`typeof X === 'function'`ガード付きで**関数呼び出し時点**（DOMイベント発火後、全ファイル読み込み後）にしか行われていないパターンを確認（例: features.js:585, calendar-review.js:125, boot.js:1722 等58箇所）。読み込み時点(トップレベル)での未定義参照は見つからなかった |
| 3. モーダルはOverlayManager経由のみ | ○ 違反なし | index.html上の20個の`*-overlay`要素、およびotomon.jsが動的生成する3個（otomon-overlay等、otomon.js:1236,1541）が、すべてcore.js:36-60の`DEFS`に登録済み。`overlay...style.display`のような独自開閉コードはgrepで0件 |
| 4. UNLOCK_DEFS登録 | 未検証 | 今回のスコープでは深掘りしていない（次回要確認） |
| 5. gq_接頭辞＋台帳追記＋exportAllData対象 | 🔴 違反あり | `growthPraiseLogs`（progression.js:249,253）が接頭辞違反（ドキュメント既知・唯一の例外）で**exportから実際に漏れている**（§2参照）。加えて`gq_widget_order`（boot.js:1242）、`gq_guide_tutorial_seen`（features.js:632）が台帳未記載（実害はexport自動走査のおかげで無し） |

---

## 5. 見つけたバグ候補（再現条件付き）

### 5-1. 🔴 褒めログがバックアップ・復元の対象外（データ消失）
- **根拠**: settings-genre.js:103 `if (k && k.startsWith('gq_'))`、progression.js:253 `localStorage.setItem('growthPraiseLogs', ...)`
- **再現条件**: 設定画面→「データのエクスポート」→ダウンロードしたJSONを開くと`data`オブジェクトに`growthPraiseLogs`キーが存在しない。別端末や`localStorage.clear()`後に「データのインポート」で復元しても褒めログだけ空になる

### 5-2. 🔴 Service Workerの事前キャッシュが存在しないファイルを参照
- **根拠**: sw.js:12 `'./scripts/app.js'`。`ls scripts/`で該当ファイルが無いことを確認済み
- **再現条件**: ブラウザのDevTools → Application → Service Workers でinstallイベントのログ/エラーを見れば、`cache.addAll`失敗（404によるreject）が確認できるはず（実機検証は別担当領域）

### 5-3. 🟠 容量超過（QuotaExceededError）が完全に無防備
- **根拠**: `localStorage.setItem`の呼び出し61箇所（grep実測）のうち、try/catchで包まれているものが**0件**（core.js:259他、boot.js:70他、progression.js:36他、quests.js:27他、timer.js:145、otomon.js:559他、calendar-review.js:26他、features.js:752他、settings-genre.js:824他）
- **再現条件（理論上）**: localStorageが容量上限(多くのブラウザで約5MB)に達した状態で、例えば`saveData(data)`（core.js:258-261）が呼ばれると`setItem`が例外を投げ、直後の`GQ.emit('data:changed', ...)`（core.js:260）が実行されずに終わる。呼び出し元の関数もその時点で中断するため、**「XP加算処理は動いたのに保存されず、しかも画面更新イベントも飛ばずに無言で失敗」**という状態になりうる。ユーザーには何のエラーも表示されない
- **容量到達の概算**: 明示的な件数上限があるのは`gq_nudge_done`（quests.js:186、90日でトリム）のみ。それ以外の日次ログ系（`gq_day_log`, `gq_data.historyDetails`, `growthPraiseLogs`, `gq_words_hist`, `gq_planner`, `gq_tl_punch`/`gq_tl_routine_days`, オトモンの個体別記録等）は明確な上限が無く増え続ける設計。1日分のエントリはどれも数百バイト程度と小さいため、**1〜2年の通常利用でいきなり5MBに達する可能性は低い**が、写真アイコン機能（settings-genre.js:268 `c.toDataURL('image/jpeg', 0.82)`でジャンルアイコンをBase64化して`gq_genres`に保存）のような**画像をdataURLとして直接localStorageに入れている箇所**は、ジャンルを何個も写真付きで作ると1件あたり数KB〜数十KBに膨らみ得るため、ここが実質的な最速の容量消費源になり得る

### 5-4. 🟡 `otomon.js`だけ独立したキャッシュバージョン管理
- **根拠**: index.html:970 `scripts/otomon.js?v=otomon-45`。`tools/bump_version.sh`のsedパターンは`v=guild-[0-9]*`のみを対象とする
- **再現条件**: 今後otomon.jsを編集して`bash tools/bump_version.sh`を実行しても`?v=otomon-45`は変化しないため、ブラウザ・Service Worker双方が古いotomon.jsをキャッシュしたまま「直したのに直ってない」状態になり得る（CLAUDE.md掟1が名指しで警告している症状そのもの）

### 5-5. 🟢 未使用アセットの残存（実害は軽微）
- **根拠**: §3-3参照。`icon-512-source.png`(812KB)およびavatar/otomonの`raw`/`source`フォルダ(約2MB)がコードから一切参照されていない
- **実害**: ブラウザのダウンロード量には影響しないが、リポジトリ肥大化・デプロイ時間の無駄

---

## 6. 現実的な処方箋（優先度順）

| 優先度 | 対応 | 作業量 |
|---|---|---|
| 1 | `exportAllData()`/`importAllData()`に`growthPraiseLogs`を明示的に含める（`k.startsWith('gq_') \|\| k === 'growthPraiseLogs'`のように特例扱いにする） | **S** |
| 2 | `sw.js`の`PRECACHE_URLS`から存在しない`./scripts/app.js`を削除し、実際の9本＋otomon.jsを列挙し直す。同時に`CACHE_NAME`を上げて古いキャッシュを一掃する | **S** |
| 3 | `docs/architecture_review.md` §6 台帳に`gq_widget_order`, `gq_guide_tutorial_seen`を追記（見出しの「50キー」表記も実際の件数に合わせて修正） | **S** |
| 4 | 保存系を共通の`safeSetItem(key, value)`ヘルパーに寄せ、`try/catch`＋容量超過時は「保存できませんでした。エクスポートで空き容量を確認してください」等のアラートを出す。61箇所すべてを一度に変える必要は無く、まず`saveData`(core.js)・`importAllData`(settings-genre.js)のような影響範囲が大きい所から | **M** |
| 5 | `importAllData()`のforEachをtry/catchで包み、失敗したキー数をユーザーに知らせる（全件ロールバックまでは今回は過剰。「何が起きたか分かるようにする」だけで十分） | **S** |
| 6 | `otomon.js`のクエリ名を`?v=guild-N`に統一するか、`bump_version.sh`のsedパターンに`v=otomon-[0-9]*`も追加して両方一括で上がるようにする | **S** |
| 7 | 未使用アセット（`icon-512-source.png`、各`raw`/`source`フォルダ）の削除 | **S** |
| 8 | テスト不在への処方箋（下記詳細） | **M** |

### テスト不在への現実的な処方箋

npm禁止・依存ゼロの制約を守ったまま、`tests.html`という**ブラウザで直接開くだけの1ファイル**を追加する案（大掛かりなフレームワーク無し）:

```html
<!-- tests.html（新規・独立ファイル。index.htmlや本体には一切影響しない） -->
<script src="scripts/core.js"></script>
<script src="scripts/progression.js"></script>
...
<script>
  let pass = 0, fail = 0;
  function assertEq(actual, expected, label) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; }
    else { fail++; console.error(`❌ ${label}: got`, actual, 'want', expected); }
  }
  // 例: todayKey()がローカル日付を返すこと、loadData()が壊れたJSONでも例外を投げないこと 等
  assertEq(typeof todayKey(), 'string', 'todayKeyは文字列を返す');
  localStorage.setItem('gq_data', '{不正なJSON');
  assertEq(loadData().xp, 0, '壊れたgq_dataでもloadDataは例外を投げずデフォルトに戻る');
  document.body.textContent = `${pass} passed, ${fail} failed`;
</script>
```

- ブラウザで`tests.html`を開くだけで結果が見える（`python3 -m http.server`は既に検証で使っている環境そのまま流用可）
- 全機能を網羅する必要は無い。**今回見つけたような「localStorageの読み書き」「日付処理」のような壊れると被害が大きい関数だけ**を数十件カバーすれば十分な費用対効果
- CIは無い（GitHub Actions等の追加はビルド不要の強みを損なわないなら任意）。当面は「新機能を追加したら`tests.html`も開いてゼロエラーを確認する」をリリース前スモークテスト（§4の7か条）に1行足すだけで運用可能

---

以上。コードの変更は一切行っていない（調査・レポート作成のみ）。
