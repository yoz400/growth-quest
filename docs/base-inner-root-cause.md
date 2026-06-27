# ベースインナー素体の原因調査メモ

このメモは、`typeA_base_inner_*`、`typeB_base_inner_*`、`typeC_base_inner_*` が不自然になった原因と、次に失敗しないための改善策をまとめたものです。

## 結論

今回の失敗は、完成済みの服つきPNGから、プログラムだけで服・髪・小物を分離しようとしたことが主因です。

PNGは見た目としては1枚の画像なので、服、髪、手、装飾、本、杖が同じ層に焼き込まれています。

```text
完成PNG
  顔 + 髪 + 服 + 手 + 小物 + 影
        ↓
  1枚に焼き込まれている
        ↓
  あとから安全に分解するのが難しい
```

## 起きた問題

### 1. レイヤー分解できていない

**レイヤー** とは、透明なシートのように画像を分ける考え方です。

理想は次の形です。

```text
body_base
  ↓
outfit_layer
  ↓
accessory_layer
  ↓
head_lock
  ↓
face_lock
```

しかし今回の元画像は、最初からこのように分かれていませんでした。

そのため、`head_lock` に服の破片が入り、`body_base` に髪の破片が残りました。

### 2. 色だけで判定した

スクリプトでは、ピンクなら髪、肌色なら手、白なら服、というように色で判定しました。

ただし実際のピクセルアートでは、髪のハイライト、服の影、肌、金装飾が似た色になります。

```text
同じような色
  肌
  茶色い服
  金の装飾
  髪の影

結果
  残すべき部分と消すべき部分を間違える
```

### 3. キャラごとの身体を混ぜた

タイプCでは、C専用の自然な身体ベースがなかったため、タイプAの身体を縮小して使ってしまいました。

これは絶対に避けるべきでした。

```text
タイプCの頭
  +
タイプAの身体
  =
別キャラっぽく見える
```

### 4. Bの長い髪が難所だった

タイプBはポニーテールが身体の横から下まで伸びています。

そのため、髪を守ろうとすると服まで拾い、服を消そうとすると髪も消える状態になりました。

### 5. 自動処理の品質チェックが甘かった

以下を機械的に見ただけでは不十分でした。

```text
透過PNGか
四隅が透明か
ファイルが存在するか
```

必要だったのは、次の確認です。

```text
head_lock に服が混ざっていないか
body_base に髪が混ざっていないか
他キャラの身体を使っていないか
元キャラの印象が残っているか
```

## 診断画像

調査用の比較画像です。

```text
outputs/base_inner_diagnostics/base_inner_root_cause_contact.jpg
outputs/base_inner_diagnostics/typeA_layer_bbox_check.jpg
outputs/base_inner_diagnostics/typeB_layer_bbox_check.jpg
outputs/base_inner_diagnostics/typeC_layer_bbox_check.jpg
```

## 改善策

### 方針1: いまの自動スクリプトを正解にしない

`scripts/create_base_inner_sprites.py` は、現状のままでは本番用ベース素体を作る道具として使えません。

再実行しても同じ種類の失敗が出ます。

### 方針2: まず手作業用のマスクを作る

**マスク** とは、「残す場所」「消す場所」を白黒で指定する画像です。

次のマスクをキャラごとに作る必要があります。

```text
typeA_head_mask.png
typeA_body_edit_mask.png
typeB_head_mask.png
typeB_body_edit_mask.png
typeC_head_mask.png
typeC_body_edit_mask.png
```

色判定ではなく、見た目で確認したマスクを使います。

### 方針3: 他キャラの身体を流用しない

タイプCにはタイプC専用の身体ベースが必要です。

タイプAやタイプBの身体を縮小して使うと、頭身や肩幅が合わず、別キャラになります。

### 方針4: Cは新しい専用ベースを作る

タイプCは、本・ローブ・バッグが強く焼き込まれているため、既存PNGから安全に消すのが難しいです。

改善案は次のどちらかです。

```text
案A: 手作業でC専用のbody_baseを描く
  安定度が高い
  顔・髪・メガネを壊さない

案B: 画像編集AIでCの身体だけ作り、最後にhead_lockを重ねる
  早い
  ただし再生成のブレが出る
```

### 方針5: 完成ファイルを書き換える前にレビュー画像を出す

次回からは、いきなり `typeA_base_inner_transparent.png` などを上書きしません。

まず次のような確認画像を作ります。

```text
元画像
  ↓
head_lock
  ↓
body_base
  ↓
合成プレビュー
```

ヨージが確認してから、正式ファイル名で保存します。

## 次にやるべきこと

1. 現在の `type*_base_inner_*` は不採用として扱う。
2. キャラごとの手作業マスクを作る。
3. AとBは既存の村人差分を元に、髪と服の混入を手作業で分ける。
4. Cは他キャラの身体を使わず、C専用のbody_baseを新規に作る。
5. 3体の合成プレビューを先に出し、確認後に正式PNGを書き出す。

## 追加実行結果

改善策として、正式ファイルを上書きしないレビュー工程を追加しました。

```text
scripts/prepare_base_inner_review.py
```

このスクリプトは、次の画像を `outputs/base_inner_review/` に出力します。

```text
typeA_head_mask.png
typeA_body_edit_mask.png
typeA_head_lock_review.png
typeA_body_base_review.png
typeA_base_inner_review_transparent.png
typeA_base_inner_review_white.png

typeB_head_mask.png
typeB_body_edit_mask.png
typeB_head_lock_review.png
typeB_body_base_review.png
typeB_base_inner_review_transparent.png
typeB_base_inner_review_white.png

typeC_head_mask.png
typeC_body_edit_mask.png
typeC_head_lock_review.png
typeC_body_base_review.png
typeC_base_inner_review_transparent.png
typeC_base_inner_review_white.png
```

レビュー用の一覧画像です。

```text
outputs/base_inner_review/base_inner_mask_review.jpg
```

実行結果として、AとBは前回より混入が減りました。

ただし、Cはまだ不採用です。

Cの元画像は本・ローブ・バッグが身体に強く重なっているため、既存PNGだけから自然な `body_base` を作るのは難しいです。

小さいCスプライトから本なし身体を拡大する案も試しましたが、首・肩の接続とドット粒度が合いませんでした。

```text
outputs/base_inner_review/typeC_small_body_candidates.jpg
outputs/base_inner_review/typeC_small_body_candidates2.jpg
outputs/base_inner_review/typeC_small_body_candidates3.jpg
```

現時点の結論は次の通りです。

```text
タイプA
  既存の村人差分から改善可能

タイプB
  既存の村人差分から改善可能
  ただしポニーテールをhead_lock側に完全に逃がす必要がある

タイプC
  既存PNGだけでは不安定
  C専用のbody_baseを新規作成する必要がある
```
