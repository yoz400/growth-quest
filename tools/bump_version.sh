#!/bin/bash
# キャッシュ用バージョン(?v=guild-N)を一括で+1するスクリプト
# 使い方: bash tools/bump_version.sh
# CSS/JSを編集したら必ず実行する（忘れるとブラウザが古いファイルを使い続ける）
set -e
f="$(cd "$(dirname "$0")/.." && pwd)/index.html"
cur=$(grep -o 'v=guild-[0-9]*' "$f" | head -1 | grep -o '[0-9]*$')
if [ -z "$cur" ]; then echo "エラー: index.html に v=guild-N が見つかりません"; exit 1; fi
next=$((cur + 1))
if [[ "$OSTYPE" == darwin* ]]; then
  sed -i '' "s/v=guild-[0-9]*/v=guild-$next/g" "$f"
else
  sed -i "s/v=guild-[0-9]*/v=guild-$next/g" "$f"
fi
n=$(grep -c "v=guild-$next" "$f")
echo "guild-$cur → guild-$next（${n}か所を更新）"
