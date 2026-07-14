# 仕様書：オトモン OverlayManager 統合（Phase C）

親ドキュメント: `docs/architecture_review.md` §5 Phase C

目的:
`scripts/otomon.js` だけが独自にオーバーレイを開閉している状態をやめ、
既存の `OverlayManager` に統一する。

この仕様での「オーバーレイ」は、画面全体を覆うモーダル表示のこと。
`OverlayManager` は、それらを1か所で交通整理する仕組み。

```text
現在:
  otomon.js ── classList.add/remove ── オトモン画面

変更後:
  otomon.js ── Overlay.open/close ── オトモン画面
                    │
                    └─ ESC / focus / inert / aria-hidden を一元管理
```

## 1. 対象

対象にするオーバーレイ:

| id | 用途 |
|---|---|
| `otomon-overlay` | オトモン図鑑・育成パネル |
| `otomon-birth-overlay` | 孵化時の誕生演出 |
| `otomon-bondup-overlay` | bond 昇格演出 |

対象外:

- `#otomon-nudge`
  - これは画面全体を覆うモーダルではなく、短時間表示の通知。
- オトモンのデータ保存、抽選、孵化、bond 計算。
- ホームカード、クエストカード、画像、文言。

## 2. 守る挙動

以下は変えない。

- 既存の開き方、閉じ方。
- 背景タップで閉じる挙動。
- 閉じるボタンで閉じる挙動。
- 誕生演出の「図鑑で見る」は、誕生演出を閉じてから図鑑を開く。
- `window.Otomon.openPanel()` / `window.Otomon.closePanel()` の公開API。
- localStorage キー。

## 3. 実装方針

### 共通

- `scripts/core.js` の `OverlayManager` `DEFS` に対象 id を登録する。
- `styles/app.css` の overlay 共通 `visibility` 対象に対象 id を追加する。
- `scripts/otomon.js` では、既存の注入処理は維持する。
- オーバーレイを開く直前に、今までどおり必要な DOM を注入する。
- `classList.add('open')` は `Overlay.open(id)` に置き換える。
- `classList.remove('open')` は `Overlay.close(id)` に置き換える。

DOM は画面表示時に動的生成されるため、読み込み時点で存在しない。
そのため、`Overlay.open/close` は必ず既存どおり `inject...()` の後で呼ぶ。

## 4. コミット分割

1コミット=1機能で進める。

### Phase C-0: 仕様書追加

このファイルを追加する。
コード変更はしない。

スモーク:

- `git status --short` で意図した docs 変更だけであること。

### Phase C-1: 図鑑パネル

対象:

- `otomon-overlay`

変更:

- `core.js` `DEFS` に登録。
- `app.css` overlay 共通 selector に追加。
- `openPanel()` / `closePanel()` を `Overlay.open/close` に移行。

スモーク:

- 起動。
- ヘッダーまたはホームカードからオトモン図鑑を開く。
- 閉じるボタンで閉じる。
- もう一度開いて、背景タップで閉じる。
- もう一度開いて、ESCで閉じる。
- コンソールエラーがない。

> ✅ **レビュー完了（2026-07-15 クロ・?v=guild-80）**: C-1（図鑑パネル）を精査＋実機で検証し合格。
> - **差分**: core.js DEFSに `otomon-overlay`（openClass:'open', dismissible:true）登録／
>   otomon.js openPanel/closePanel を Overlay.open/close に置換（injectAll+renderPanel は
>   従来どおり open の前）／app.css 共通selectorの visibility:hidden↔visible 両方に
>   `#otomon-overlay` を追加。パネル独自CSSはopacity/pointer-events担当で相補的・競合なし
> - **二重発火なし**: otomon.js に独自ESCハンドラは無く、閉じる配線は閉じるボタンと
>   背景タップ(e.target===ov)のみ。両方 closePanel→Overlay.close 経由。ESCは
>   OverlayManagerが一元管理
> - **実機検証**: 開くと Overlay.topId()==='otomon-overlay'・背景#appがinert化（a11yの核心が
>   機能）・aria-hidden=false／閉じ方3種すべてOK（閉じるボタン／背景タップ／**ESC=新capability**）／
>   閉じると背景inert解除・下のオーバーレイ(login-bonus)へ正しくスタック復帰／
>   パネル中身423ノード描画・閉じるボタン存在／設定・ギルド・カレンダー・図鑑再開閉OK／
>   コンソールエラーゼロ
> - **収穫**: OverlayManager統合で ESC対応＋背景inert＋フォーカストラップ＋スタック管理が
>   自動で付いた（独自実装では無かったa11y改善）。C-2/C-3も同型で進めてよい

### Phase C-2: 誕生演出

対象:

- `otomon-birth-overlay`

変更:

- `core.js` `DEFS` に登録。
- `app.css` overlay 共通 selector に追加。
- `showBirth()` / `closeBirth()` を `Overlay.open/close` に移行。

スモーク:

- 起動。
- テスト用に `window.Otomon.showBirth(...)` で誕生演出を出す。
- 閉じるボタンで閉じる。
- もう一度出して、背景タップで閉じる。
- もう一度出して、ESCで閉じる。
- 「図鑑で見る」で誕生演出が閉じ、図鑑が開く。
- コンソールエラーがない。

### Phase C-3: bond 昇格演出

対象:

- `otomon-bondup-overlay`

変更:

- `core.js` `DEFS` に登録。
- `app.css` overlay 共通 selector に追加。
- `showBondUp()` / `closeBondUp()` を `Overlay.open/close` に移行。

スモーク:

- 起動。
- テスト用の既存経路、または一時的なブラウザ実行で bond 昇格演出を出す。
- 閉じるボタンで閉じる。
- もう一度出して、背景タップで閉じる。
- もう一度出して、ESCで閉じる。
- コンソールエラーがない。

## 5. 全体スモーク

各コミット後に以下を確認する。

```text
起動
  ↓
タイマー START/STOP
  ↓
設定 開閉
  ↓
オトモン図鑑 開閉
  ↓
カレンダー 開閉
  ↓
localStorage.clear() 後に召喚
  ↓
コンソールエラー 0
```

## 6. 安全停止条件

以下が1つでも起きたら、作り変えずに止まって報告する。

- 既存の開閉タイミングが変わった。
- 背景タップ、閉じるボタン、ESC のどれかが効かない。
- オトモン以外のモーダルが開かなくなった。
- タイマー、設定、カレンダー、召喚のどれかで挙動が変わった。
- localStorage の値やキーを変える必要が出た。
- 仕様にない判断が必要になった。
