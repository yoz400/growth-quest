# Growth Quest — App Icons

このフォルダには、ホーム画面アイコン・favicon・PWA 用のアイコン画像を配置します。

## 配置するファイル

```text
icon-512.png         512×512  PWA メインアイコン（any 用途）
icon-192.png         192×192  Android ホーム画面
icon-180.png         180×180  iOS apple-touch-icon（背景必須・透過厳禁）
icon-32.png           32×32   favicon
icon-16.png           16×16   favicon（旧仕様フォールバック）
maskable-512.png     512×512  Android 8+ maskable（中央40%以内にロゴ・全面塗り）
favicon.ico          16/32/48 マルチサイズ ICO
```

## 制作の指針

- **背景色**: `#0a0a0f`（manifest.json の `background_color` / `theme_color` と同色）
- **ブランドカラー**: シアン `#06b6d4` / レッド `#e63946` / ゴールド `#f4a261`
- **モチーフ**: 既存ロゴの ⚔（剣）と「上昇感」を踏襲
- **Safe Zone**:
  - 通常アイコン: 中央 80%（端 10% を余白）
  - maskable: 中央 40% にロゴ収め、外周 60% は背景の塗り
- **透過の注意**:
  - iOS 用 `icon-180.png` は **不透明背景**（透過部分は iOS が黒で塗る）
  - maskable も **不透明背景** 必須

`manifest.json` と `index.html` は、この一覧のファイルを参照する設定になっています。
画像が未配置でもアプリ動作には影響しません。
