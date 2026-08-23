#!/bin/bash
# キャッシュ用バージョン(?v=guild-N)を一括で+1するスクリプト
# 使い方: bash tools/bump_version.sh
# CSS/JSを編集したら必ず実行する（忘れるとブラウザが古いファイルを使い続ける）
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
f="$root/index.html"
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

# アプリが「新しい版が出ていないか」を確認しに行く番号ファイル。
# index.html と必ず同じ番号でなければ意味が無いので、ここで一緒に書き出す。
# （手で書き換えるとズレて、更新の案内が出っぱなし／出ないの事故になる）
printf '{"version":"guild-%s"}\n' "$next" > "$root/version.json"
echo "version.json も guild-$next に更新"

# 見張り: guild系以外の ?v= が混ざっていたら警告する。
# （かつて otomon.js だけ ?v=otomon-N という別系列で、このスクリプトの
#   対象外のまま置き去りになっていた。同じ事故を二度起こさないため）
stray=$(grep -o '?v=[a-z]*-[0-9]*' "$f" | grep -v "^?v=guild-" | sort -u || true)
if [ -n "$stray" ]; then
  echo ""
  echo "⚠️  guild系ではない ?v= が残っています（このスクリプトでは上がりません）:"
  echo "$stray" | sed 's/^/    /'
  echo "    → guild-$next に揃えてください"
fi
