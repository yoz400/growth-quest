#!/usr/bin/env python3
"""読み込み順の事故を機械的に検出する。

GQで3回起きている起動フリーズは、すべて同じ形をしている:

    先に読まれるファイルが、後から読まれるファイルの関数を「読み込み時に」裸で呼ぶ
      → ReferenceError でそのファイルの評価が止まる
      → 以降の window 公開が全部行われず、他ファイルまで巻き込んで起動しなくなる

    実例: testCloudNotify（guild-59）／featUnlocks（guild-5x）／
          dkey・escHtml（guild-141。ナッジコース選択者だけが踏んだ）

⚠️ 「後のファイルの関数を呼ぶ」こと自体は正常。GQでは日常的にやっている。
   危険なのは、それが**読み込み時に到達する**場合だけ。
   このスクリプトは、トップレベルの実行文から辿れる範囲だけを見る。
   コールバック（addEventListener の中など）は後から動くので対象外。

使い方:  python3 tools/check_load_order.py
        （問題があれば終了コード1）

安全な書き方（検出されない）:
    window.foo && window.foo(...)        ← 未読込なら呼ばない
    typeof foo === 'function' && foo()   ← 同上
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IGNORE = {
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
    'new', 'delete', 'void', 'do', 'else', 'try', 'await', 'yield',
}


def load_order():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    return re.findall(r'<script src="scripts/([\w.-]+)\.js\?', html)


def strip_noise(src):
    """コメントと文字列を空白で潰す。中身の括弧に釣られないため"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(''.join(ch if ch == '\n' else ' ' for ch in src[i:j])); i = j
        elif c == '`':
            # テンプレート文字列。${ … } の中は本物のコードなので必ず残す。
            # ⚠️ ここを潰すと、GQのようにHTMLをテンプレートで組み立てるコードでは
            #    大半の呼び出しが見えなくなる（escHtml の見逃しはこれが原因だった）
            out.append(' '); j = i + 1
            while j < n and src[j] != '`':
                if src[j] == '\\':
                    out.append('  '); j += 2; continue
                if src[j] == '$' and j + 1 < n and src[j + 1] == '{':
                    end = match_brace(src, j + 1)
                    out.append('  ' + strip_noise(src[j + 2:end - 1]) + ' ')
                    j = end; continue
                out.append(src[j] if src[j] == '\n' else ' '); j += 1
            out.append(' '); i = min(j + 1, n)
        elif c in '"\'':
            q, j = c, i + 1
            while j < n and src[j] != q:
                if src[j] == '\\':
                    j += 1
                j += 1
            j = min(j + 1, n)
            out.append(''.join(ch if ch == '\n' else ' ' for ch in src[i:j])); i = j
        else:
            out.append(c); i += 1
    return ''.join(out)


def match_brace(code, start):
    """start は '{' の位置。対応する '}' の次の位置を返す"""
    depth, i = 0, start
    while i < len(code):
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return len(code)


def functions(code):
    """function 宣言 → {名前: (本体の開始, 終了)}"""
    out = {}
    for m in re.finditer(r'\bfunction\s+(\w+)\s*\([^)]*\)\s*\{', code):
        out[m.group(1)] = (m.end() - 1, match_brace(code, m.end() - 1))
    return out


# 「後から動く」コールバックを受け取るAPI。この引数の中だけ読み込み時の対象外にする。
# ⚠️ forEach / map / filter / sort などは**その場で同期実行される**ので、
#    ここに入れてはいけない。入れると今回の escHtml のような見逃しが起きる。
DEFERRED = re.compile(
    r'addEventListener|setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|'
    r'\.then|\.catch|\.finally|GQ\.on\b|onClose|\bon\w+\s*=')


def blank_out_callbacks(code):
    """後から動くコールバックの中身だけを潰す。同期実行される場所は残す"""
    res = list(code)

    def blank(a, b):
        for k in range(a, b):
            if res[k] != '\n':
                res[k] = ' '

    for m in re.finditer(r'\bfunction\s*\w*\s*\([^)]*\)\s*\{', code):
        if DEFERRED.search(code[max(0, m.start() - 60):m.start()]):
            blank(m.end(), match_brace(code, m.end() - 1))

    for m in re.finditer(r'=>\s*', code):
        if not DEFERRED.search(code[max(0, m.start() - 60):m.start()]):
            continue
        j = m.end()
        if j < len(code) and code[j] == '{':
            end = match_brace(code, j)
        else:
            end = code.find('\n', j)
            end = len(code) if end < 0 else end
        blank(j, end)
    return ''.join(res)


def calls_in(code):
    """裸の呼び出し {名前: [行番号]}。

    除外するもの:
      - window.foo(...) / obj.foo(...)     … 未読込でも落ちない／依存ではない
      - function foo(...) { }              … 宣言であって呼び出しではない
      - typeof foo === 'function' && foo() … GQで確立した安全な書き方
    """
    out = {}
    lines = code.split('\n')
    for m in re.finditer(r'(?<![.\w$])(\w+)\s*\(', code):
        name = m.group(1)
        if name in IGNORE:
            continue
        # 直前が function → 宣言なので呼び出しではない
        if re.search(r'\bfunction\s+$', code[max(0, m.start() - 20):m.start()]):
            continue
        lineno = code.count('\n', 0, m.start()) + 1
        # 同じ行に typeof での存在確認があれば、ガード済みとみなす
        if re.search(r'\btypeof\s+' + re.escape(name) + r'\b', lines[lineno - 1]):
            continue
        out.setdefault(name, []).append(lineno)
    return out


def neutralize_iife(code):
    """外側のIIFE `(function () { … })();` の殻だけを空白にする。

    ⚠️ ここを外すとツールが無意味になる。GQのJSはPhase Dで全ファイルが
       IIFEで包まれているので、殻を残したまま「関数式の中身は後から動く」と
       判定すると、ファイル全体が対象外になって何も検出しなくなる。
       （実際に最初の版はこれで、今回の dkey バグを取り逃がした）
    """
    m = re.search(r'^\s*\(\s*function\s*\w*\s*\([^)]*\)\s*\{', code, re.M)
    if not m:
        return code
    end = match_brace(code, m.end() - 1)
    if end > len(code) - 40:                      # 閉じがファイル末尾付近＝外殻とみなす
        res = list(code)
        for k in list(range(m.start(), m.end())) + list(range(end - 1, min(end + 5, len(code)))):
            if res[k] != '\n':
                res[k] = ' '
        return ''.join(res)
    return code


def analyze(src):
    """読み込み時に到達する呼び出しだけを返す"""
    code = neutralize_iife(strip_noise(src))
    funcs = functions(code)

    # トップレベル＝どの関数本体にも入っていない部分
    top = list(code)
    for _, (s, e) in funcs.items():
        for k in range(s, e):
            if top[k] != '\n':
                top[k] = ' '
    top_code = blank_out_callbacks(''.join(top))

    # トップレベルから辿れるローカル関数を集める（コールバックの中は辿らない）
    reachable, queue = set(), [n for n in calls_in(top_code) if n in funcs]
    while queue:
        name = queue.pop()
        if name in reachable:
            continue
        reachable.add(name)
        s, e = funcs[name]
        body = blank_out_callbacks(code[s:e])
        for n in calls_in(body):
            if n in funcs and n not in reachable:
                queue.append(n)

    # 読み込み時に通る範囲の呼び出しを集める
    found = {}
    for name, lines in calls_in(top_code).items():
        found.setdefault(name, []).extend(lines)
    for fn in reachable:
        s, e = funcs[fn]
        base = code.count('\n', 0, s)
        body = blank_out_callbacks(code[s:e])
        for name, lines in calls_in(body).items():
            found.setdefault(name, []).extend(base + l for l in lines)
    return found, set(funcs) | set(re.findall(r'\b(?:const|let|var)\s+(\w+)\s*=', code))


def main():
    order = load_order()
    if not order:
        print('エラー: index.html から <script> の並びを読めません')
        return 1

    info = {}
    for f in order:
        path = os.path.join(ROOT, 'scripts', f + '.js')
        if not os.path.exists(path):
            print(f'エラー: {path} がありません')
            return 1
        src = open(path, encoding='utf-8').read()
        reached, defined = analyze(src)
        info[f] = {
            'exports': set(re.findall(r'^\s*window\.(\w+)\s*=', src, re.M)),
            'reached': reached,
            'defined': defined,
        }

    print('読み込み順:', ' → '.join(order))
    print()

    problems = []
    for i, f in enumerate(order):
        later = {}
        for g in order[i + 1:]:
            for name in info[g]['exports']:
                later.setdefault(name, g)
        for name, lines in info[f]['reached'].items():
            if name in info[f]['defined'] or name not in later:
                continue
            problems.append((f, name, later[name], sorted(set(lines))))

    if not problems:
        print('✅ 問題なし。')
        print('   読み込み時に到達する範囲で、後から読まれるファイルの関数を裸で呼んでいる箇所はありません。')
        return 0

    print('🚨 読み込み時に、後から読まれるファイルの関数を裸で呼んでいます:')
    print()
    for f, name, owner, lines in problems:
        where = ', '.join(str(n) for n in lines[:8]) + ('…' if len(lines) > 8 else '')
        print(f'  {f}.js:{lines[0]}  →  {name}()  は {owner}.js のもの')
        print(f'      該当行: {where}')
    print()
    print('直し方は2つ:')
    print('  ① そのファイル内に同じ処理を持つ関数を用意して、他ファイル依存をなくす（推奨）')
    print('  ② window.foo && window.foo(...) の形にして、未読込なら呼ばないようにする')
    print()
    print('⚠️ 放置すると、そのファイルの評価が読み込み時に止まり、')
    print('   以降の window 公開が全部行われず、起動フリーズになります。')
    return 1


if __name__ == '__main__':
    sys.exit(main())
