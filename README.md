# Growth Quest

Growth Quest は、学習時間を記録しながら、XP・レベル・装備・すごろく・バッジで成長を楽しむブラウザアプリです。

## できること

- 学習タイマーで集中時間を記録できます。
- 学習すると XP が増え、レベルが上がります。
- すごろくでマスを進み、イベントや報酬を楽しめます。
- 装備アイテムを集めて、アバターに反映できます。
- 週間レビューで学習の振り返りができます。
- バッジやスキルツリーで成長を見える化できます。

## 開き方

いちばん簡単な方法は、`index.html` をブラウザで開くことです。

```text
index.html をダブルクリック
        ↓
ブラウザで Growth Quest が開く
```

開発用サーバーで開く場合は、プロジェクト直下で次を実行します。

```sh
python3 -m http.server 8000
```

そのあと、ブラウザで次のURLを開きます。

```text
http://localhost:8000
```

## ファイル構成

```text
claude-practice/
├─ index.html              アプリの入口です
├─ styles/app.css          見た目を決めます
├─ scripts/app.js          動きや保存処理を担当します
├─ assets/equipment/       装備画像です
├─ adventurer-*.png        アバター画像です
├─ docs/checklist.md       動作確認リストです
└─ AGENTS.md               Codex向けの作業ルールです
```

## 初心者向けの説明

**HTML** は、画面の骨組みを作るものです。

**CSS** は、色・大きさ・配置など、見た目を作るものです。

**JavaScript** は、ボタンを押したときの動きやデータ保存などを作るものです。

```text
HTML: 画面の骨組み
 CSS: 見た目
  JS: 動き
```

## データ保存

Growth Quest のデータは、ブラウザの `localStorage` に保存されます。

`localStorage` とは、ブラウザの中に小さなデータを保存する仕組みです。

```text
学習する
  ↓
XPや記録が増える
  ↓
localStorage に保存される
  ↓
次に開いたとき復元される
```

注意点として、保存データは基本的に同じブラウザ内だけで使われます。別のPCや別のブラウザへ自動では移りません。

## 現在の状態

このプロジェクトは、個人用の学習RPGアプリとして育てている途中です。

今後は、機能を増やすだけでなく、ファイル整理・動作確認・データ移行のしやすさも少しずつ整えていく予定です。

## 着せ替えスプライトの作り方

Growth Quest のキャラクター衣装差分を作るときは、顔と髪を先に守ります。

```text
元画像
  ↓
顔・髪・目・口の範囲を保護
  ↓
服・腕・脚・小物だけ差し替え
  ↓
透明PNGと白背景PNGを書き出し
```

作業の流れは次の通りです。

1. ベース画像を確認します。
2. 顔、髪、目、口、頭部の輪郭を変えないように指定します。
3. 衣装だけを変更した画像を作ります。
4. 背景が緑などの単色なら、透明背景に変換します。
5. 元画像の頭部をマスクで重ね戻します。
6. 白背景版と透明背景版を保存します。
7. 比較画像で、顔・髪・目・口が崩れていないか確認します。

**マスク** とは、「この部分だけ守る」という範囲のことです。たとえばタイプAでは、茶髪・顔・目・口をマスクで守り、胴体だけを着せ替えます。

```text
守る範囲
  顔
  髪
  目
  口

変更してよい範囲
  服
  腕
  脚
  小物
```

出力ファイル名は、あとで探しやすいように次の形にします。

```text
typeA_outfit11_dice_dealer_white.png
typeA_outfit11_dice_dealer_transparent.png
```

12〜18着目を作るときも、同じように `typeA_outfit12_...` のような番号つきの名前にします。

タイプCの衣装差分では、水色ボブ・丸メガネ・穏やかな表情を特に守ります。

```text
タイプCで守る範囲
  水色ボブ
  丸メガネ
  目
  口
  頬
  中性的な雰囲気

タイプCで変更してよい範囲
  ローブ
  袖
  本
  杖
  腰まわりの小物
  靴
```

タイプCの12〜18着目は、次のような名前にします。

```text
typeC_outfit12_grand_sage_white.png
typeC_outfit12_grand_sage_transparent.png
typeC_outfit13_..._white.png
typeC_outfit13_..._transparent.png
```

顔や髪を守るため、生成画像をそのまま使わず、必要に応じて元画像の頭部を重ね戻して確認します。

## ベースインナーとレイヤー構成

ベースインナーは、今後の衣装を重ねるためのシンプルな土台画像です。

**head_lock** は、顔・髪・目・口を守るための頭部レイヤーです。

**body_base** は、衣装を重ねるための身体レイヤーです。

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

今回作成したベースインナーは、次の名前で管理します。

```text
typeA_base_inner_white.png
typeA_base_inner_transparent.png
typeB_base_inner_white.png
typeB_base_inner_transparent.png
typeC_base_inner_white.png
typeC_base_inner_transparent.png
```

分解用の素材は次の名前で管理します。

```text
typeA_head_lock.png
typeB_head_lock.png
typeC_head_lock.png
typeA_body_base.png
typeB_body_base.png
typeC_body_base.png
```

透明PNGを使うと、背景を消した状態で衣装を重ねられます。

```text
透明PNG
  背景が透明な画像
  ゲーム画面や別の背景に置きやすい
```

注意: 現在の自動生成スクリプトは、完成PNGから服・髪・小物を安全に分離できず、ベースインナー作成には不十分です。

作り直す前に、原因調査メモを確認します。

```text
docs/base-inner-root-cause.md
```
