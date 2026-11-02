# 仕様書：大陸を渡る旅（すごろくの周回に意味を持たせる）

作成: 2026-11-02 クロ ／ レビュー: チャッピー（2026-11-02・§11）／ 実装: Codex（2026-11-02・guild-209）／ 状態: 実装済み・クロのレビュー合格

---

## 0. これは何か

### ヨージの困りごと（本人の言葉）

> ５０分のポモドーロをこなすと出目が大きい数が出やすいのはいいのだけど、すごろくを早く周回する
> メリットが何もなくアイテムやイベントを飛ばしてるだけに感じます。成長や出会いのチャンスを
> 飛ばしてまで周回した先に何もないのは少し寂しくない？

### 調べて分かったこと（2026-11-02）

| | 平均出目 | 1周の回数 | 1周の集中時間 | 勉強1時間あたり止まる回数 |
|---|---|---|---|---|
| ポモドーロ(25分) | 2 | 約50回 | 約21時間 | 約2.4回 |
| ディープ(50分) | 3.5 | 約29回 | 約24時間 | 約1.2回 |

- 1周の**集中時間**はモードによらず約20〜25時間。＝1周は「成長の節目」としてちょうどよい単位
- 周回しても盤面は常に `stage1`「習慣の大陸」。大陸図も1周目で晴れきり、2周目以降は何も起きない
- 一方 `otomon.js` の `habitatForStage()` は周回ごとに卵の生息地を8種で切り替えている。
  ただし画面にほぼ出ず、盤面のエリア（湖・雪山…）とも一致しない＝**世界が2つにねじれている**
- `areas.js` は最初から `getStage(stageId)` で複数ステージを持てる作り（中身は stage1 だけ）

### 作るもの（ヨージ決定 2026-11-02）

**周回するたびに新しい大陸へ渡る。** 8つの大陸と8つの卵の生息地を1対1にする。
各大陸のゴールで、その大陸の **「ぬし（主）」の卵** が必ずもらえる。ぬしは**その大陸を踏破した人だけ**が会える。

```
 周回  大陸              テーマ           生息地   ゴールでもらえる卵
 ─────────────────────────────────────────────────────────
  1   習慣の大陸        踏み出す          森      みならいフェニックス
  2   静寂の大陸        集中（深く潜る）    洞窟    クリスタルラビット
  3   根気の大陸        継続（耐える）     雪原    こおりのトナカイ
  4   工夫の大陸        単調を越える       砂漠    なぞなぞスフィンクス
  5   探究の大陸        先人に学ぶ        遺跡    カエル仙人
  6   絆の大陸          つながり          海辺    イルカ博士
  7   静心の大陸        心を整える        神社    ピース玄武（SSR）
  8   結びの大陸        仲間に還す        ギルド  幸福フェニックス（SSR）
  9〜 1に戻る（ぬしの卵の代わりに目覚めアイテム）
```

1のみならいフェニックスで始まり、8の幸福フェニックスで終わる＝「見習いが幸福に至る」旅。
（将来のオトモン進化・共成長の伏線として選んだ。§9）

### 守るべき判断基準（GQの正典。迷ったらここへ戻る）

1. **本当の努力を要求するか** … ぬしは約20時間の集中の先にしか無い。孵化も通常どおり目覚めアイテム＋オトモンクエストを経る（ゴールで即孵化させない）
2. **STARTまでの秒数を伸ばさないか** … ホーム画面には何も足さない
3. **集中直後の余韻を奪わないか** … 大陸踏破の演出は**ゴールを踏んだ1回だけ**
4. **サボった人を責めないか** … ペースの遅い人を急かす文言（「あと◯回で…」等）を出さない
5. **努力の記録を消さない** … 既存の保存データは1つも書き換え・削除しない（§2.3）

### やらないこと（スコープ境界）

- 大陸ごとのマス配置の変更（`BOARD_CELL_TYPES` は全大陸共通のまま）／ダンジョン → §9 将来
- 大陸図の新しい絵（2大陸目以降は今の絵の色違い。§5）
- `AREA_LINES`（マスの言葉）の文章を書くこと（新大陸ぶんも空の枠だけ用意）
- オトモンの進化

---

## 1. 全体の流れ

```
すごろくで pos が 100の倍数に「届く or またぐ」（例 98→100、98→102。100→102 は該当しない）
  └ doSugorokuRoll: crossed = floor(newPos/100) > floor(prevPos/100)（新。§3.3）
      ├ 既存: +100XP
      ├ 新: メッセージを「🎊 習慣の大陸を踏破！ 次は 静寂の大陸 へ ＋100XP」に
      └ 新: window.Otomon.grantNushiEgg(floor(newPos/100))   ← 踏破した大陸の番号
             ├ その大陸のぬしをまだ受け取っていない → ぬしの卵を1つ追加 → 到着GET演出
             └ 受け取り済み（9周目以降）→ 目覚めアイテム1つ（grantRandomWakeItem）

盤面・大陸図・すごろく見出し
  └ すべて「いまの大陸」= continentForStage(sgGetStage(pos)) の定義で描く

起動時（1回・otomon.js の init()）
  └ 踏破済みの大陸 = floor(pos/100) 個（最大8）。未受け取りのぬしの卵をまとめて渡す（§4.4）
```

---

## 2. データ

### 2.1 areas.js：大陸の定義を足す

**原則: areas.js は他ファイルを参照しない純粋データのまま**（ファイル冒頭の⚠️を守る）。

#### (1) 既存 stage1 に3項目を足す

```js
{
  id: 'stage1', no: 1, name: '習慣の大陸', cells: 100,
  habitat: 'forest',            // 新: 卵の生息地（otomon.js の HABITATS のキー）
  nushi: 'minaraifenikkusu',    // 新: ぬしのオトモンID
  mapTint: '',                  // 新: 大陸図の色づけ（CSS filter 値）。stage1 は空＝原画のまま
  areas: [ ...既存のまま... ],
}
```

#### (2) stage2〜stage8 は「短い表」から作る

70エリアぶん accent/rgb/palette/map/intensity を手で書くと、写し間違いが必ず出る。
**エリアごとに書くのは id・name・terrain・emoji・theme・landmark名 だけ**にし、
残りは関数で stage1 から引き継ぐ。

```js
// 短い表（例: stage2 の最初の2エリア）。全量は §2.2
const CONTINENT_DEFS = [
  { id:'stage2', no:2, name:'静寂の大陸', habitat:'cave', nushi:'kuristalrabit',
    mapTint:'hue-rotate(200deg) saturate(.8)',
    areas: [
      ['s2_irie', '霧の入り江',   'lake',   '🌊', '着く',         '渡し場'],
      ['s2_jukai','しじまの樹海', 'forest', '🌲', '雑念を置く',   '倒木の門'],
      // …10件
    ] },
  // stage3〜stage8
];
```

`expandContinent(def)` で完全な STAGE オブジェクトに広げ、`STAGES` に push する。広げ方:

| 項目 | 決め方 |
|---|---|
| `no`, `range` | 並び順 i（0始まり）から。`no = i+1`, `range = [i*10+1, i*10+10]` |
| `accent`, `rgb`, `palette` | **同じ terrain を持つ stage1 のエリア**から写す（`summit` の rgb は stage1 の値をそのまま） |
| `map`, `intensity`, `review`, `goal` | **同じ並び順（no）の stage1 のエリア**から写す（大陸図の絵が同じなので座標も同じ） |
| `landmark` | `{ id: エリアid + '_lm', name: 表の値 }` |
| `otomonAttr` | 付けない（stage1 でも保留中の項目） |

`AREA_LINES` には新エリアIDの空枠 `{ lines: [], clear: '' }` を足す（足さなくても `lineFor` は null を返して壊れないが、
後で文章を書く人が場所に迷わないように）。

#### (3) 新しい参照ヘルパ（window.Areas に公開）

```js
const CONTINENT_COUNT = 8;
// 周回（1始まり）→ 大陸。9周目は stage1 に戻る
function continentForStage(stageNo) {
  const n = Math.max(1, Number(stageNo) || 1);
  return STAGES[(n - 1) % CONTINENT_COUNT];
}
```

既存の `areaOf / isBoundary / lineFor / revealDiff` は `stageId` 引数を既に持っている。**呼ぶ側が渡すようにする**だけでよい。

### 2.2 大陸の短い表（全量）

名前は**仮**（チャッピー／ヨージがあとで差し替えてよい。IDは変えない）。
terrain は既存10種（grassland forest marsh ruins desert lake snow storm ember summit）のみ。

**stage2 静寂の大陸**（集中・深く潜る／habitat: cave／ぬし: kuristalrabit／mapTint: `hue-rotate(200deg) saturate(.8)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s2_irie | 霧の入り江 | lake | 🌊 | 着く | 渡し場 |
| s2_jukai | しじまの樹海 | forest | 🌲 | 雑念を置く | 倒木の門 |
| s2_domon | 苔むす洞門 | ruins | 🕳 | 潜り始める | 洞門 |
| s2_shizuku | しずくの回廊 | marsh | 💧 | 静けさに慣れる | 地底の泉 |
| s2_suisho | 水晶の坑道 | snow | 💎 | 没頭 | 水晶柱 |
| s2_sado | 音のない砂洞 | desert | ⏳ | 退屈との対話 | 砂時計の間 |
| s2_tomoshibi | 灯火の地下街 | ember | 🔦 | 小さな手応え | 古いランプ |
| s2_hankyo | 反響の大空洞 | storm | ⚡ | 雑音の嵐 | 反響の柱 |
| s2_kagami | 鏡の地底湖 | lake | 🪞 | 澄んだ集中 | 静水の岸 |
| s2_tenmado | 天窓の出口 | summit | ✨ | 浮上 | 光の天窓 |

**stage3 根気の大陸**（継続・耐える／snow／koorinotonakai／`hue-rotate(170deg) brightness(1.1)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s3_shimono | 霜おりる野 | grassland | 🌾 | 冷たい朝 | 霜の柵 |
| s3_shinyo | 針葉の森 | forest | 🌲 | 毎日の一歩 | 樵の小屋 |
| s3_fukidamari | 吹きだまりの道 | snow | ❄️ | 足が重い | 道しるべの杭 |
| s3_itetsuku | 凍てつく湖 | lake | 🧊 | 変化が見えない | 氷上の轍 |
| s3_shirogiri | 白い霧原 | marsh | 🌫 | 迷い | 霧笛の塔 |
| s3_umoremura | 雪に埋もれた村 | ruins | 🏚 | 先に歩いた人 | 村の鐘 |
| s3_neyuki | 根雪の尾根 | snow | 🏔 | 積み重ね | 尾根の石塚 |
| s3_fubuki | 吹雪の峠 | storm | 🌨 | やめたくなる日 | 避難小屋 |
| s3_yukemuri | 湯けむりの谷 | ember | ♨️ | ひと息 | 湯治場 |
| s3_juhyo | 樹氷の頂 | summit | 🌄 | 続けた者の景色 | 樹氷の回廊 |

**stage4 工夫の大陸**（単調を越える／desert／nazonazosufinkusu／`hue-rotate(-20deg) saturate(1.2)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s4_oasis | オアシスの町 | grassland | 🌴 | 備える | 隊商宿 |
| s4_hatenai | 果てない砂原 | desert | 🌵 | 同じ毎日 | 風紋の丘 |
| s4_karakuri | からくり市場 | ruins | ⚙️ | やり方を変える | 歯車の門 |
| s4_caravan | キャラバンの道 | desert | 🐪 | 道連れ | 水場 |
| s4_shinkiro | 蜃気楼の沼 | marsh | 🌫 | 見せかけの近道 | 蜃気楼 |
| s4_hoshiyomi | 星読みの泉 | lake | 💧 | 振り返り | 星図の石 |
| s4_shakunetsu | 灼熱の岩場 | ember | ☀️ | 暑さをしのぐ知恵 | 日除けの岩 |
| s4_sunaarashi | 砂嵐の回廊 | storm | 🌪 | 試練 | 砂嵐の門 |
| s4_kakurezato | 椰子の隠れ里 | forest | 🌿 | 自分の型 | 隠れ里の井戸 |
| s4_nazokake | 謎かけの台地 | summit | 🗿 | 答えを持つ | 謎かけの台座 |

**stage5 探究の大陸**（先人に学ぶ／ruins／kaerusennin／`sepia(.4) hue-rotate(-10deg)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s5_shosha | 書写の丘 | grassland | 📜 | 問いを持つ | 写本小屋 |
| s5_manabiya | 学び舎の森 | forest | 🌳 | 先人の跡 | 古い学び舎 |
| s5_shoko | 沈黙の書庫 | ruins | 🏛 | 読む | 書庫の扉 |
| s5_sennin | 仙人の沼 | marsh | 🐸 | 師に会う | 蓮の飛び石 |
| s5_hakkutsu | 発掘の砂丘 | desert | 🏺 | 掘り下げる | 発掘坑 |
| s5_kioku | 記憶の湖 | lake | 🪞 | 振り返り | 記憶の祠 |
| s5_meikyu | 封印の迷宮 | ruins | 🗝 | 難問 | 迷宮の鍵 |
| s5_tenmondai | 雷鳴の天文台 | storm | 🔭 | 常識が崩れる | 天文台 |
| s5_tomyo | 灯明の地下聖堂 | ember | 🕯 | 理解が灯る | 聖堂の燭台 |
| s5_kenja | 賢者の頂 | summit | 🌅 | 自分の言葉 | 賢者の椅子 |

**stage6 絆の大陸**（つながり／shore／irukahakase／`hue-rotate(160deg) saturate(1.1)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s6_hama | はじまりの浜 | lake | 🐚 | 出会い | 貝殻の浜 |
| s6_minato | 花咲く港町 | grassland | 🌼 | 声をかける | 港の灯台 |
| s6_komorebi | 木漏れ日の小径 | forest | 🌲 | 寄り添う | 木漏れ日の橋 |
| s6_higata | 干潟の市場 | marsh | 🦀 | 分け合う | 干潟の市 |
| s6_iruka | イルカの湾 | lake | 🐬 | 教わる | 湾の桟橋 |
| s6_shiosai | 潮騒の遺跡 | ruins | 🏛 | 振り返り | 潮だまりの神殿 |
| s6_shirasuna | 白砂の島 | desert | 🏝 | ひとりの時間 | 漂着の舟 |
| s6_misaki | 嵐の岬 | storm | 🌊 | すれ違い | 岬の灯 |
| s6_yunagi | 夕凪の入江 | ember | 🎐 | 仲直り | 夕凪の祠 |
| s6_todai | 灯台の丘 | summit | 🌅 | 誰かの灯りになる | 大灯台 |

**stage7 静心の大陸**（心を整える／shrine／piisugenbu／`hue-rotate(-40deg) saturate(.9)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s7_sando | 鳥居の参道 | grassland | ⛩ | 立ち止まる | 一の鳥居 |
| s7_chikurin | 竹林の小径 | forest | 🎋 | 呼吸 | 竹林の門 |
| s7_hasuike | 蓮池の庭 | marsh | 🪷 | 静める | 蓮池の橋 |
| s7_kodera | 古寺の回廊 | ruins | 🏯 | 手放す | 鐘楼 |
| s7_karesansui | 枯山水の庭 | desert | 🪨 | 余白 | 石庭 |
| s7_mizukagami | 水鏡の池 | lake | 🪞 | 振り返り | 水鏡 |
| s7_yukimi | 雪見の山寺 | snow | ❄️ | 冷静 | 雪見灯籠 |
| s7_raijin | 雷神の滝 | storm | ⛈ | 揺さぶり | 滝行の岩 |
| s7_toro | 灯籠の谷 | ember | 🏮 | 内なる火 | 千の灯籠 |
| s7_genbu | 玄武の社 | summit | 🐢 | 揺るがない心 | 奥の院 |

**stage8 結びの大陸**（仲間に還す／guild／kouhukufenikkusu／`saturate(1.3) brightness(1.05)`）

| id | name | terrain | emoji | theme | landmark |
|---|---|---|---|---|---|
| s8_machi | 冒険者の街 | grassland | 🏘 | 帰還 | 街の大門 |
| s8_minarai | 見習いの森 | forest | 🌳 | 昔の自分 | 見習いの木 |
| s8_toginjo | 試練の闘技場 | ruins | ⚔️ | 力を試す | 闘技場の門 |
| s8_funsui | 憩いの噴水広場 | lake | ⛲ | 語り合う | 噴水 |
| s8_chizushi | 地図職人の荒野 | desert | 🗺 | 道を残す | 道標の塔 |
| s8_omoide | 思い出の湿原 | marsh | 🌫 | 振り返り | 記念の碑 |
| s8_shihan | 師範の雪山 | snow | 🏔 | 教える | 師範の庵 |
| s8_ryu | 竜の渓谷 | storm | 🐉 | 最後の試練 | 竜の門 |
| s8_kaji | 鍛冶の谷 | ember | 🔥 | 磨き上げる | 炉の火 |
| s8_tou | 大ギルドの塔 | summit | 🏆 | 次の誰かへ | ギルドの紋章 |

> mapTint の値は目安。プレビューで見て、文字や雲が読めなくなるものは弱めてよい（受け入れ基準 6）。

### 2.3 localStorage

#### 新しいキーは作らない。「渡し済み」は `gq_otomon` の中に持つ

**チャッピーのレビュー（§11 ②③）で、別キーにすると穴が2つあると分かった**ので、初版の新キー `gq_nushi_granted` 案はやめた。

```
 ② 旧バックアップの復元: インポートは「バックアップにあるキーだけ上書き」（settings-genre.js:134〜）
    → 卵(gq_eggs)は昔に戻るのに、バックアップに無い gq_nushi_granted は残る → ぬしの卵が二度と来ない
 ③ 保存が2キーに分かれる: 卵だけ保存成功 → 次回二重に渡る／渡し済みだけ成功 → 卵が消える
```

```js
// gq_otomon（otomonState）に1項目足すだけ。DEFAULT_OTOMON にも足す
const DEFAULT_OTOMON = { discovered:{}, active:'', nudgeOn:true, nushiGranted:[] };
//   nushiGranted: ぬしの卵を渡し済みの大陸ID。例 ["stage1","stage2"]
//   配列でなければ [] として読む（例外で止めない）
```

`gq_otomon` は必ずバックアップに入っているので、復元すると「仲間の記録」と「渡し済み」が**同じ時点の値にそろう**。
（旧バックアップには nushiGranted が無い → 起動時に §4.4 が渡し直す＝正しい）

#### 「渡し済み」は3か所から求める（記録が欠けても自分で直る）

```js
// 次のどれか1つでも当てはまれば、その大陸のぬしは渡し済み
function nushiGrantedSet() {
  const set = new Set(Array.isArray(otomonState.nushiGranted) ? otomonState.nushiGranted : []);
  eggs.forEach(e => { if (e.nushiOf) set.add(e.nushiOf); });                       // まだ孵っていない卵
  Object.values(otomonState.discovered).forEach(r => { if (r && r.nushiOf) set.add(r.nushiOf); }); // 孵った子
  return set;
}
```

- ぬしの卵には `nushiOf: 'stage1'`、孵った記録（discovered[id]）にも `nushiOf` を残す（§4.3）
- こうしておけば、`nushiGranted` だけ保存に失敗しても、壊れていても、**二重に渡らない**
- 逆に「卵の保存が失敗した」ときは渡さなかったことにする（§4.3）＝次の起動で §4.4 がもう一度渡す。
  **どちらに転んでも「消える」側には倒れない**（基準5）

#### 意味を広げるキー1つ: `gq_world_seen_cell`（**値の書き換えはしない**）

| | 今まで | これから |
|---|---|---|
| 意味 | 大陸図を最後に開いたときの到達マス（1〜100） | 大陸図を最後に開いたときの **累計位置（= gq_sugoroku の pos）** |
| 1周目の人 | 37 | 37（**同じ値になる**） |
| 2周目以降の人 | 100（頭打ち） | 次に開いたとき pos が書かれる |

1周目では「到達マス＝累計位置」なので、**既存の値はそのまま新しい意味で正しく読める**（チャッピー確認済み）。
2周目以降の人の既存値 100 は「習慣の大陸の終わりまで見た」と読めるので、いまの大陸の雲は 0 から晴れていく＝正しい。
→ 移行処理は書かない。`docs/architecture_review.md` §6 台帳の説明文と、areas.js の KEYS のコメントだけ直す。

#### 既存データは何も書き換えない

`gq_sugoroku`（pos・stage）・`gq_eggs`・`gq_otomon` の既存の値はそのまま読む。
ぬしの卵は `gq_eggs` に**1件追加するだけ**。`gq_otomon` には `nushiGranted` を**足すだけ**。

---

## 3. 盤面とすごろく（core.js）

### 3.1 SG_ZONES を「いまの大陸」から作る

今は読み込み時に `getStage('stage1')` で1回だけ作っている（[core.js:1714](../scripts/core.js)）。
これを **位置から決まる大陸で作る関数**に変える。

```js
// その位置の大陸のゾーン。大陸が変わったときだけ作り直す（毎回 map しない）
// pos を省略したら「画面上のコマの位置」（§3.1.1）
let _sgZonesFor = null, _sgZonesCache = [];
function sgZones(pos = sgShownPos()) {
  const st = window.Areas ? window.Areas.continentForStage(sgGetStage(pos)) : null;
  if (!st) return [];
  if (_sgZonesFor !== st.id) {
    _sgZonesFor = st.id;
    _sgZonesCache = st.areas.map(a => ({ start:a.range[0], end:a.range[1], name:a.name,
      terrain:a.terrain, emoji:a.emoji, accent:a.accent, rgb:a.rgb }));
  }
  return _sgZonesCache;
}
```

- `SG_ZONES[...]` の参照（約14か所）を `sgZones()[...]` に置き換える。**`SG_ZONES.length`（core.js:1780 付近）も忘れない**
- `window.SG_ZONES = SG_ZONES`（core.js:3090 付近）: 他ファイルからの参照は無い（チャッピー確認）。
  getter（`Object.defineProperty(window, 'SG_ZONES', { get: () => sgZones() })`）に置き換える

#### 3.1.1 歩いている途中の大陸（⚠️ ここに罠がある）

`doSugorokuRoll` は**歩き出す前に** `sugorokuData.pos` を到着点へ書き換える（core.js:1292）。
そのため `sugorokuData.pos` で大陸を決めると、98→102 のロールでは**旧大陸の 99・100 マスを歩いている間から
新大陸の名前・地形**になってしまう。

```
 盤面の大陸は「画面上のコマがいる位置」で決める
   歩行アニメ中 … animFromPos ＋ 歩いた歩数（= sgShownPos()）
   それ以外     … sugorokuData.pos
 → 100 を越えた一歩で（ゴール演出の後）新しい大陸に描き替わる
```

`sgShownPos()` は既存の `animFromPos` / `sgAnimCell`（core.js:2592〜）から求める小さな関数として作る。
既存変数で表せないときは §8 に当たるので止まって報告。
- **areas.js は core.js より前に読まれる**ので `window.Areas` は実行時に必ずある。それでも上の形（存在確認つき）を守る

### 3.2 マスの言葉

`window.Areas.lineFor(cellNum, kind)` の2か所（[core.js:1383, 1392](../scripts/core.js)）に
`newPos` 側の大陸の `stageId` を渡す（`continentForStage(sgGetStage(newPos)).id`）。

### 3.3 ゴール（大陸踏破）

#### 踏破の判定を「100の倍数に届く or またぐ」1つにそろえる

**今のコードには、100マス目ちょうどに止まると踏破が2回起きるバグがある**（チャッピー指摘 §11 ①・クロ確認）。

```
 今:  98 → 100 … cellNum=100 → BOARD_CELL_TYPES[100]='goal' → +100XP（1回目）
      100 → 102 … sgGetStage 1→2 で stageCleared → +100XP（2回目）  ← 同じ大陸で2回
 新:  crossed = Math.floor(newPos / 100) > Math.floor(prevPos / 100)
      98 → 100 … 0 → 1 で crossed ✅    100 → 102 … 1 → 1 で crossed ❌（普通のマス）
      98 → 102 … 0 → 1 で crossed ✅
```

pos=100 は今どおり「習慣の大陸の100マス目（ゴール）」に立っている状態（`sgGetStage(100) = 1`）。
踏破した大陸の番号は `k = Math.floor(newPos / 100)`。

[core.js:1294〜1305](../scripts/core.js) を次のように変える:

```js
const crossed  = Math.floor(newPos / 100) > Math.floor(prevPos / 100);
const cellType = crossed ? 'goal'
               : (cellNum === 100 ? 'normal' : (BOARD_CELL_TYPES[cellNum] || 'normal'));
//  ↑ cellNum===100 で crossed でないのは「100 に立ったまま」は起きないので実質通らない。保険

if (crossed) {
  bonusXP = 100;
  evClass = 'ev-goal';
  const k = Math.floor(newPos / 100);               // 踏破した大陸（1始まり）
  const A = window.Areas;
  const done = A ? A.continentForStage(k)     : null;
  const next = A ? A.continentForStage(k + 1) : null;
  message = done && next
    ? `🎊 ${done.name}を踏破！ 次は ${next.name} へ ＋${bonusXP} XP`
    : `🎊 ゴール！ステージ${k}クリア！ ボーナス +${bonusXP} XP`;   // 保険
  sugorokuData.stage = newStage;
  // otomon.js は core.js より後に読まれる → 必ず window 経由・存在確認（掟2）
  const nushi = window.Otomon && window.Otomon.grantNushiEgg
    ? window.Otomon.grantNushiEgg(k) : null;
  if (nushi) _sgPendingReward = nushi;   // 到着マスのGET演出に流す（既存の仕組み）
} else if (cellType === 'rare') { …以下は今のまま… }
```

- `stageCleared` 変数を他で使っていれば、`crossed` に置き換える（grep で確認）
- この変更で「100ちょうど→次の一歩」の **2回目の +100XP は出なくなる**（バグ修正。Decisions に書く）

⚠️ **ここで return しないこと**（spec_urgent_quest.md §9 の落とし穴と同じ。戻り値の形を変えない）。

### 3.4 「◯周目」「ステージN」の表示

`grep -n "周目\|ステージ" scripts/*.js index.html` で出てくる**画面に出る文字**を大陸名に置き換える。
「2巡目」の判定は `sgGetStage(pos) > 8`（9周目以降）。

- 大陸図の見出し（[core.js:2396](../scripts/core.js)）: `${大陸名} ・ マス ${at} / 100`。9周目以降（2巡目）は `・ 2巡目` を後ろに付ける
- コメント中の「2周目」は直さなくてよい
- `index.html:524` の初期文字「習慣の大陸」はそのままでよい（開くと上書きされる）

---

## 4. ぬしの卵（otomon.js）

### 4.1 生息地を大陸から引く

```js
function habitatForStage(stage) {
  const st = window.Areas && window.Areas.continentForStage
    ? window.Areas.continentForStage(stage) : null;
  if (st && st.habitat && HABITATS.includes(st.habitat)) return st.habitat;
  const i = ((Number(stage) || 1) - 1) % HABITATS.length;   // 保険（従来の計算）
  return HABITATS[i < 0 ? 0 : i];
}
```

stage1〜8 の habitat は今の循環（forest→…→guild）と**同じ順**にしてあるので、結果は変わらない。

### 4.2 卵の定義を1つ足す

```js
// ぬしの卵。生息地を持たない（maybeDropEgg の抽選には入らない）。
// accepts はギルドの random_egg と同じ全種（どの目覚めアイテムでも起こせる）
{ id:'nushi_egg', name:'ぬしの卵', habitat:null, emoji:'🥚', rarity:'SR', accepts:[ ...random_egg と同じ... ] },
```

- `HABITAT_EGGS` の自動生成で `habitat:null` が `HABITAT_EGGS[null]` を作らないようにする（`if (!e.habitat) return;`）
- 卵の表示名は `ぬしの卵（${大陸名}）` にしたい。卵オブジェクトに `nushiOf: 'stage1'` を持たせ、表示側で付け足す。
  表示箇所が多くて大変なら、名前は「ぬしの卵」のままでよい（§7 には当たらない）

### 4.3 grantNushiEgg(stageNo)

```js
// 大陸 stageNo（1始まり）を踏破したときに呼ばれる。戻り値は到着GET演出の形（maybeDropEgg と同じ）
function grantNushiEgg(stageNo) {
  const st = window.Areas && window.Areas.continentForStage(stageNo);
  if (!st || !st.nushi || !OTOMON_BY_ID[st.nushi]) return null;
  if (nushiGrantedSet().has(st.id)) {
    // 2巡目以降：卵の代わりに目覚めアイテム（既存の grantRandomWakeItem）
    return grantRandomWakeItem();
  }
  const rarity = OTOMON_BY_ID[st.nushi].rarity;   // SR / SSR
  const egg = { uid:newUid(), eggId:'nushi_egg', gauge:0, goal:HATCH_GOAL[rarity] || 4,
                usedItem:null, sleeping:false, gotAt:Date.now(),
                pendingId: st.nushi, nushiOf: st.id };   // ← 孵る子をここで固定
  eggs.push(egg);
  if (!saveEggs()) {                                // ① 卵を先に保存。失敗したら渡さなかったことにする
    eggs = eggs.filter(x => x.uid !== egg.uid);     //    （次の起動で §4.4 が渡し直す）
    return null;
  }
  const g = Array.isArray(otomonState.nushiGranted) ? otomonState.nushiGranted : [];
  if (!g.includes(st.id)) g.push(st.id);
  otomonState.nushiGranted = g; saveOtomon();       // ② 失敗しても egg.nushiOf があるので二重には渡らない
  return { name:'ぬしの卵', emoji:'🥚', rarity:'rare',
           effect:{ desc:`${st.name}のぬしが眠っている` },
           flavorText:'大陸を歩ききった者にだけ託される卵。', _eggUid: egg.uid };
}
```

- `saveEggs()` は今 `safeSetItem` の結果を返していない。**`return safeSetItem(...)` にして true/false を返す**ようにする
  （`safeSetItem` は core.js:302 で成功時 true を返す。呼び出し元で戻り値を使っていない所は影響なし）
- **`useWakeItem` は `if (!e.pendingId)` なので、固定した pendingId を上書きしない**（既存のまま）
- `hatch()` でぬしの卵が孵ったら、`discovered[id].nushiOf = e.nushiOf` を残す（既に値があれば上書きしない）
- `window.Otomon` の公開窓口に `grantNushiEgg` と `grantMissedNushiEggs` を足す

### 4.4 すでに踏破済みの人に、まとめて渡す（grantMissedNushiEggs）

```js
// 起動後に1回。踏破済みの大陸（floor(pos/100) 個・最大8）で、未受け取りのぬしの卵を渡す。
// 返り値: 渡した数
function grantMissedNushiEggs(pos) {
  let n = 0;
  const done = Math.min(Math.floor(Math.max(0, Number(pos) || 0) / 100), 8);   // pos=100 → 1、250 → 2
  for (let k = 1; k <= done; k++) {
    const st = window.Areas && window.Areas.continentForStage(k);
    if (st && !nushiGrantedSet().has(st.id) && grantNushiEgg(k)) n++;
  }
  return n;
}
```

- **呼ぶ場所: otomon.js の `init()` の中、`claimMilestoneRewards()` の直後**（otomon.js:3188 付近。チャッピー確認）。
  ここは DOMContentLoaded 後に走り、すごろくの読み込み（core.js:616）も初回補正（boot.js:62〜65）も済んでいる。
  pos は `sugorokuData.pos`（core.js の変数。core.js の方が先に読まれるので参照してよい）。
  **boot.js の末尾で即時に呼ぶのはダメ**（その時点で otomon.js はまだ読まれていない）
- 1以上なら、節目の報酬と同じやり方（同じ `setTimeout` の中、`showNudge`）で1回だけ知らせる:
  「これまで踏破した大陸のぬしの卵が届いた（◯個）」。節目の報酬と両方あるときは、節目を先・ぬしを後に続けて出す
- 2回目以降の起動では渡し済みなので何も起きない（冪等）

### 4.5 ぬしは「その大陸でしか会えない」

`candidatePoolIds(item)` の3段（favors → 属性 → 全体）すべてから、**8体のぬしIDを除く**。

```js
const NUSHI_IDS = () => (window.Areas ? window.Areas.STAGES.map(s => s.nushi).filter(Boolean) : []);
```

- ぬしの卵は pendingId が固定済みなので、この除外の影響を受けない
- **更新前から持っている普通の卵**で、pendingId がすでにぬしに決まっているものがあり得る（チャッピー指摘 §11 ④）。
  `hatch()` で「`e.nushiOf` が無い卵の pendingId がぬし」なら、所持済みと同じく `candidatePoolIds` で引き直す。
  pendingId は孵化するまで画面に出ない（otomon.js:839 のコメント）ので、引き直しても体験は変わらない
- `hatch()` の「所持済みなら引き直す」は、**ぬしの卵（`e.nushiOf` がある）では行わない**。
  すでに別の経路で仲間にしていた子でも、そのまま `count + 1` で孵る（重複は許す）
- 除外の結果、ある目覚めアイテムの favors が空になっても、既存の「属性 → 全体」に降りるので壊れない
- **既にぬしを仲間にしている人の記録は消さない**（除外は「これから孵る抽選」だけ）

---

## 5. 大陸図（core.js の buildWorldMap）

| 箇所 | 今 | これから |
|---|---|---|
| エリア | `A.getStage('stage1').areas` | `A.continentForStage(sgGetStage(pos)).areas` |
| 雲の「到達」 | `worldMaxCell()`：2周目以降は 100 で頭打ち | **いまの大陸の中のマス** `sgGetCellNum(pos)`（pos≤0 なら 0） |
| 雲の「前回」 | `revealDiff(to).from`（= 保存値そのまま） | 保存値（累計位置）を**いまの大陸の中のマス**に直す: `clamp(seen - (stage-1)*100, 0, 100)` |
| 保存 | `markSeen(to)`（1〜100） | `markSeen(pos)`（累計位置） |
| 絵 | `assets/worldmap.webp` | 同じ絵。`<image>` に `style="filter:${st.mapTint}"`（空なら付けない） |
| 見出し | `習慣の大陸 ・ マス N / 100 ・ N周目` | `${st.name} ・ マス N / 100`（2巡目以降は `・ 2巡目`） |
| 足元のエリア名・ランドマーク | `A.areaOf(at)`（core.js:2402。stage1 のまま） | `A.areaOf(at, st.id)` |

- `revealDiff` / `markSeen` は areas.js 側。引数の意味が変わるので、areas.js のコメントも直す
- `worldMaxCell()` の「頭打ち」コメント（§6.2 由来）は役目を終えるので、理由ごと書き換える
- 将来、大陸ごとの絵ができたら `mapImage` 項目を足して差し替えられるようにしておく（今回は項目を作らなくてよい）

---

## 6. 受け入れ基準

1. [x] pos=0〜100 の人は、盤面・大陸図・マスの言葉が**今とまったく同じ**（習慣の大陸）
2. [x] pos=101〜200 で盤面のエリア名・色が「静寂の大陸」になり、大陸図の見出し・足元の表示も静寂の大陸
3. [x] pos=801 で「習慣の大陸」に戻り、見出しに「2巡目」が付く
4. [x] 98→102 のロールで「習慣の大陸を踏破！ 次は 静寂の大陸 へ」＋ぬしの卵の到着GET演出。卵リストに「ぬしの卵」が1つ増える
5. [x] **98→100→102**: 100 に着いたときに踏破が1回だけ。100→102 では踏破も +100XP も出ない
6. [x] 98→102 を歩く間、99・100 マスは習慣の大陸の見た目のまま。100 を越えてから静寂の大陸に描き替わる
7. [x] ぬしの卵に目覚めアイテムを使い、クエストを達成すると**みならいフェニックス**が孵る（すでに持っていても孵る・count+1）
8. [x] 2〜8大陸の大陸図で、雲・道・ノード名が読める（mapTint が強すぎない）。320px幅ではみ出さない
9. [x] **まとめ渡し**: pos=100 → 1つ、pos=250 → 2つ、pos=800 → 8つ。リロードしても増えない。知らせは1回
10. [x] 8大陸を回り終えた後（pos 899→901）のゴールでは卵でなく目覚めアイテム
11. [x] 通常の卵からは、8体のぬしが**孵らない**（新しく拾った卵も、更新前から持っていて pendingId がぬしの卵も）
12. [x] `gq_world_seen_cell` の既存値（例 37、100）で大陸図を開いても壊れない。2周目以降の人はいまの大陸の雲が正しく晴れる。雲のアニメ途中で閉じて開き直しても壊れない
13. [x] **復元**: ぬしを受け取った後に「機能追加前のバックアップ」を復元 → 起動時にぬしの卵が渡し直される。「機能追加後のバックアップ」を復元 → 二重に渡らない
14. [x] **保存の片側失敗**: `nushiGranted` を消した／壊した（`"abc"`）状態で起動しても、ぬしの卵（未孵化）や孵ったぬしがいる大陸は二重に渡らない
15. [x] 新しい localStorage キーが増えていない。`gq_otomon.nushiGranted` と `gq_world_seen_cell` の説明が §6 台帳にある
16. [x] `python3 tools/check_load_order.py` ✅ ／ `bash tools/bump_version.sh` 実行済み ／ コンソールエラー0

---

## 7. テスト手順

プレビューは CLAUDE.md の手順（Bash で `python3 -m http.server 8123` → `localhost:8123/index.html`）。

```js
// 位置を作る（すごろくの保存データを直接いじる。検証用の端末でのみ）
// ⚠️ initialized:true を必ず付ける。無いと boot.js:62〜65 の初回補正で pos が上書きされる
const d = JSON.parse(localStorage.getItem('gq_sugoroku') || '{}');
d.pos = 250; d.initialized = true;
localStorage.setItem('gq_sugoroku', JSON.stringify(d));
const o = JSON.parse(localStorage.getItem('gq_otomon') || '{}'); delete o.nushiGranted;
localStorage.setItem('gq_otomon', JSON.stringify(o));
location.reload();
```

1. pos = 0 / 55 / 100 → 習慣の大陸のまま（基準1）
2. pos = 150 → 盤面と大陸図（見出し・足元）（基準2）。`gq_world_seen_cell` を 100 にしてから大陸図 → 雲が0から晴れる。途中で閉じて開き直す（基準12）
3. pos = 100 / 250 / 800、nushiGranted 無し → 起動でぬしの卵 1 / 2 / 8 つ（基準9）。リロードで増えない
4. pos = 98 にして振る（🧭運命の羅針盤で出目を固定すると楽）→ 2 で基準5、4 で基準4・6
5. pos = 899 → 振って 901 へ → 基準3・10
6. 基準11: 検証のあいだだけ `window.Otomon` に `_candidatePoolIds`（読むだけの関数）を公開し、全目覚めアイテム × 未所持/全所持で回してぬしIDが出ないことを確認。
   加えて、普通の卵の pendingId を手でぬしIDにしてから孵す → ぬし以外が孵る。**公開した関数は検証後に残してよい（読むだけ）が、名前は `_` 始まりにする**
7. 基準13・14: 設定のエクスポートでバックアップを作り、`gq_otomon` から nushiGranted を消したもの／`"abc"` にしたものを用意して復元・起動
8. **条件付き経路を必ず踏む**（FAILURES: guild-141）: `localStorage.clear()` 直後（召喚オンボーディング未完了）に、上の手順で pos=250・initialized:true を作って起動し、フリーズしないこと

---

## 8. 迷ったら止まって報告

- `doSugorokuRoll` の**戻り値の形を変えないと**実装できないと分かったとき
- `SG_ZONES` の置き換えが core.js 以外（CSS・他ファイル）に広がり、20か所を超えたとき
- 既存の保存データ（`gq_sugoroku` / `gq_eggs` / `gq_otomon` / `gq_world_seen_cell`）の**値を書き換える・消す**必要が出たとき
- otomon.js の `init()` で `sugorokuData.pos` が読めない（未定義・0のまま等）とき
- 歩行中の大陸（§3.1.1）を既存の `animFromPos` / `sgAnimCell` で表せないとき
- mapTint でどう調整しても読めない大陸があるとき（色は §2.2 から外してよいが、絵を描き足す話になったら止まる）

---

## 9. 将来の拡張（今回は作らない・設計だけ残す）

ヨージの希望（2026-11-02）: **大陸の増加・ダンジョンなどの作り込み・オトモンの進化や共に成長したことによる変化**。
今回の作りがそれを邪魔しないように、次の余地を残してある。

| やりたいこと | 今回の作りで残した余地 | 次に要る判断 |
|---|---|---|
| 大陸を増やす | `CONTINENT_DEFS` に1件足し `CONTINENT_COUNT` を上げるだけ。ぬしの卵・生息地も同じ仕組み | 生息地（卵の種類）も増やすか。9大陸目のぬし |
| 大陸ごとの地図の絵 | `mapImage` 項目を足せば差し替え可（§5） | 絵を誰が作るか |
| ダンジョン | 大陸の定義に `cellTypes`（マス配置）や `dungeon`（特別区画）を足す形が自然。`BOARD_CELL_TYPES` を大陸ごとに引けるようにするのが第一歩 | ダンジョンは「何の努力」に対応するのか（基準1）。集中の連続？長時間？ |
| オトモンの進化・共成長 | ぬしの並び（みならいフェニックス → 幸福フェニックス）を伏線にした。なつき度（bond）が既にある | 進化の条件を「一緒に何をしたか」（集中時間・大陸踏破・ジャンル）で決めるか |

---

## 10. Codexへの依頼文（コピペ用）

```
Growth Quest（/Users/hapiyopi/Desktop/claude-practice）に「大陸を渡る旅」を実装してください。
仕様書は docs/spec_continent_journey.md です。全文を読んでから着手してください。

守ること:
- 仕様書の §6 受け入れ基準をすべて満たす
- areas.js は他ファイルを参照しない純粋データのまま。export / import を書かない
- 掟2（ファイルをまたぐ読み込み時参照の禁止）を厳守。core.js から otomon.js の関数を呼ぶときは
  window.Otomon && window.Otomon.foo && window.Otomon.foo() の形にする。typeof による存在確認は使わない
- doSugorokuRoll の途中で return しない（戻り値の形を変えない）
- 既存の保存データ（gq_sugoroku / gq_eggs / gq_otomon / gq_world_seen_cell）の値を書き換えない・消さない
  （gq_otomon に nushiGranted を「足す」のはよい。新しい localStorage キーは作らない）
- docs/architecture_review.md §6 の台帳に gq_otomon.nushiGranted と gq_world_seen_cell の新しい意味を書く
- 編集後に `python3 tools/check_load_order.py` と `bash tools/bump_version.sh` を実行する
- **git commit / push はしない**
- 終わったら、変更したファイルと受け入れ基準の結果を報告する
- 仕様書 §8 に当たったら、進めずに報告する
```

---

## 11. レビュー記録

### 2026-11-02 チャッピー（codex exec -s read-only）— 仕様書の初版をコードと照合

| # | 重大度 | 指摘 | 反映 |
|---|---|---|---|
| ① | 高 | 100ちょうど→次の一歩で踏破が2回（既存バグ。98→100 で goal マス、100→102 で stageCleared） | §3.3 判定を `floor(newPos/100) > floor(prevPos/100)` に統一。まとめ渡しも `floor(pos/100)` |
| ② | 高 | 旧バックアップ復元で、別キー gq_nushi_granted だけ残り卵が二度と来ない | 新キーをやめ `gq_otomon.nushiGranted` に（§2.3） |
| ③ | 高 | 卵と渡し済みの保存が別々で、二重・欠配があり得る | 卵を先に保存し失敗なら渡さない＋渡し済みを3か所から求める（§2.3・§4.3） |
| ④ | 高 | 更新前の普通の卵で pendingId がぬし → 除外をすり抜けて孵る | hatch() で引き直す（§4.5）・基準11 |
| ⑤ | 中 | SG_ZONES.length・window.SG_ZONES の見落とし／歩行中に新大陸の見た目になる | §3.1・§3.1.1 |
| ⑥ | 中 | 大陸図の足元表示が stage1 のまま | §5 の表に追加 |
| — | — | 起動時の呼び出し場所＝otomon.js init()、テストの initialized:true、candidatePoolIds が非公開 | §4.4・§7 |

クロが ①④⑤⑥ と呼び出し場所をコードで確認してから反映した（core.js:1294〜1305, 2402, 2592〜／otomon.js:840〜／settings-genre.js:134〜／boot.js:62〜）。

### 2026-11-02 クロ — Codex の実装（guild-209）を差分でレビュー → 合格

- 差分: areas.js（8大陸＋continentForStage）／core.js（踏破判定・sgZones・sgShownPos・大陸図）／otomon.js（ぬし配布・除外・孵化）／
  settings-genre.js（バッジ名）／architecture_review.md §6／tools/test_continent_journey.js（jsc で 473 項目 PASS）
- `check_load_order.py` ✅
- ブラウザ（localhost:8123）で確認:
  - pos=250 で起動 → ぬしの卵2つ＋知らせ1回（基準9）
  - 盤面「根気の大陸・白い霧原」、大陸図の見出し・足元・色づけ（基準2・8）。静寂／探究／絆／静心の大陸図も読める
  - 98→102 の歩行: 99・100 は習慣の大陸、101 から静寂の大陸に描き替わる（基準6）。踏破文言（基準4）
  - 98→100→102: 100 で踏破1回＋ぬしの卵、100→102 は普通のマス +5XP（基準5）
  - コンソールエラーは Service Worker の登録失敗のみ（localhost 由来・今回の変更と無関係）
- 実機・320px幅・設定画面からの復元操作は jsc の再現のみ（Codex 報告）。実機確認は CURRENT.md の積み残しへ

