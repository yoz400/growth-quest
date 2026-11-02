// areas.js
// ステージとエリアの定義。すごろく盤面・冒険ビュー・大陸図は
// すべてこのファイルを参照する。ここが唯一の情報源。
//
// ⚠️ このファイルは他のどのファイルも参照しない（純粋なデータ＋関数だけ）。
//    依存は一方通行。逆向き（ここから core.js の関数を呼ぶ）は絶対に書かないこと。
// ⚠️ export / import は書かない。GQは classic script で読み込むため、
//    export があるとブラウザが中身を1行も実行せず SyntaxError で丸ごと捨てる。

/**
 * @typedef {Object} Area
 * @property {string} id          ローマ字ID。オトモン等との結合キー。変更禁止。
 * @property {number} no          ステージ内の通し番号（1始まり）
 * @property {[number,number]} range  マス範囲 [開始, 終了]（両端含む）
 *
 * -- 表示情報（Phase 2 で新しい世界名へ差し替え済み）--
 * @property {string} name        表示名
 * @property {string} terrain     地形タイプ。CSS(.zt-*)・SPOT_ICONS・ZONE_PARTICLES の鍵
 * @property {string} emoji       ゾーン絵文字
 * @property {string} accent      アクセント色（16進）
 * @property {string} rgb         同色のRGB三つ組（rgba() に埋める用）
 *
 * -- 意味情報（Phase 3 の大陸図で使う。Phase 1〜2 では誰も読まない）--
 * @property {string} theme       心の段階。デバッグ・設計用の覚え書き
 * @property {Object} palette     大陸図用の配色
 * @property {string} otomonAttr  ⚠️ 保留中。§7 の決着まで、どのコードからも読まないこと
 * @property {Object} landmark    境界ランドマーク（そのエリアの最終マスに置く）
 * @property {number} intensity   演出強度 1〜5。5がクライマックス
 * @property {Object} map         大陸図上の座標（viewBox 680x383 基準）。
 *                                assets/worldmap.webp の地形に合わせて手で置いてある。
 *                                絵を差し替えたら、この10個も置き直すこと。
 */

const STAGES = [
  {
    id: 'stage1',
    no: 1,
    name: '習慣の大陸',
    cells: 100,
    habitat: 'forest', nushi: 'minaraifenikkusu', mapTint: '',
    areas: [
      {
        id: 'sougen', no: 1, range: [1, 10],
        name: 'はじまりの草原', terrain: 'grassland',
        emoji: '🌿', accent: '#86efac', rgb: '134,239,172',
        theme: '踏み出す',
        palette: { base: '#2c5b3c', accent: '#3f8a55', sky: '#1b3a2c' },
        otomonAttr: 'beast',
        landmark: { id: 'ishibashi', name: '石橋' },
        intensity: 2,
        map: { x: 128, y: 187 },
      },
      {
        id: 'mori', no: 2, range: [11, 20],
        name: 'ささやきの森', terrain: 'forest',
        emoji: '🌲', accent: '#4ade80', rgb: '74,222,128',
        theme: '続かない不安',
        palette: { base: '#20452f', accent: '#2f7a45', sky: '#16301f' },
        otomonAttr: 'plant',
        landmark: { id: 'michishirube', name: '苔むした道標' },
        intensity: 2,
        map: { x: 115, y: 128 },
      },
      {
        id: 'shitsugen', no: 3, range: [21, 30],
        name: '霧雨の湿原', terrain: 'marsh',
        emoji: '🌫', accent: '#a78bfa', rgb: '167,139,250',
        theme: '重い時期',
        palette: { base: '#3a4f52', accent: '#6b8f92', sky: '#2a3a3d' },
        otomonAttr: 'mist',
        landmark: { id: 'sandou', name: '朽ちた桟道' },
        intensity: 2,
        map: { x: 191, y: 89 },
      },
      {
        id: 'iseki', no: 4, range: [31, 40],
        name: '忘れられた遺跡', terrain: 'ruins',
        emoji: '🏛', accent: '#fb923c', rgb: '251,146,60',
        theme: '先人を知る',
        palette: { base: '#4a4433', accent: '#8c7f5e', sky: '#332f24' },
        otomonAttr: 'ancient',
        landmark: { id: 'mon', name: '遺跡の門' },
        intensity: 3,
        map: { x: 312, y: 121 },
      },
      {
        id: 'sunahara', no: 5, range: [41, 50],
        name: '灼けた砂原', terrain: 'desert',
        emoji: '🌵', accent: '#fbbf24', rgb: '251,191,36',
        theme: '単調さ',
        palette: { base: '#6b5a34', accent: '#b8973f', sky: '#4a3f24' },
        otomonAttr: 'mineral',
        landmark: { id: 'kareido', name: '涸れた井戸' },
        intensity: 2,
        map: { x: 298, y: 220 },
      },
      {
        id: 'mizuumi', no: 6, range: [51, 60],
        name: '鏡面の湖', terrain: 'lake',
        emoji: '💧', accent: '#38bdf8', rgb: '56,189,248',
        theme: '振り返り',
        palette: { base: '#22485f', accent: '#3f86ad', sky: '#16303f' },
        otomonAttr: 'aqua',
        landmark: { id: 'sanbashi', name: '桟橋' },
        intensity: 3,
        map: { x: 450, y: 213 },
        // 中間地点。記録の振り返りを出す。
        // ⚠️ 原案の checkpoint から改名（§6.4）。BOARD_CELL_TYPES の
        //    checkpoint（10刻みの休憩マス）とは別物のため。
        review: true,
      },
      {
        id: 'setsuzan', no: 7, range: [61, 70],
        name: '凍る雪山', terrain: 'snow',
        emoji: '❄️', accent: '#bae6fd', rgb: '186,230,253',
        theme: '本気の負荷',
        palette: { base: '#5d738a', accent: '#e8f0f7', sky: '#3f4f60' },
        otomonAttr: 'ice',
        landmark: { id: 'sekisho', name: '雪の関所' },
        intensity: 3,
        map: { x: 565, y: 220 },
      },
      {
        id: 'touge', no: 8, range: [71, 80],
        name: '雷鳴の峠', terrain: 'storm',
        emoji: '⚡', accent: '#c4b5fd', rgb: '196,181,253',
        theme: '最大の試練',
        palette: { base: '#3c4a5e', accent: '#8fa3c0', sky: '#252f3d' },
        otomonAttr: 'thunder',
        landmark: { id: 'tsuribashi', name: '吊り橋' },
        intensity: 5, // ステージ1のクライマックス。演出はここに寄せる
        map: { x: 588, y: 120 },
      },
      {
        id: 'okibi', no: 9, range: [81, 90],
        name: '熾火の谷', terrain: 'ember',
        emoji: '🔥', accent: '#f87171', rgb: '248,113,113',
        theme: '静かに燃え続ける',
        palette: { base: '#2a221e', accent: '#c25a34', sky: '#1a1512' },
        otomonAttr: 'ember',
        landmark: { id: 'haiwatari', name: '灰の渡り' },
        intensity: 1, // 抑えるほど効く。峠の直後の静けさ
        map: { x: 520, y: 45 },
      },
      {
        id: 'itadaki', no: 10, range: [91, 100],
        name: '暁の頂', terrain: 'summit',
        emoji: '🌅', accent: '#fbbf24', rgb: '220,38,38',
        theme: '到達',
        palette: { base: '#4a5a72', accent: '#e0c86a', sky: '#5a6b85' },
        otomonAttr: 'light',
        landmark: { id: 'unkai', name: '雲海の階段' },
        intensity: 4,
        map: { x: 430, y: 78 },
        goal: true,
      },
    ],
  },
];


// 大陸ごとの短い表。配色は地形、地図上の位置は並び順で引き継ぐ。
const CONTINENT_DEFS = [
  { id: "stage2", no: 2, name: "静寂の大陸", habitat: "cave", nushi: "kuristalrabit", mapTint: "hue-rotate(200deg) saturate(.8)",
    areas: [
      ["s2_irie", "霧の入り江", "lake", "🌊", "着く", "渡し場"],
      ["s2_jukai", "しじまの樹海", "forest", "🌲", "雑念を置く", "倒木の門"],
      ["s2_domon", "苔むす洞門", "ruins", "🕳", "潜り始める", "洞門"],
      ["s2_shizuku", "しずくの回廊", "marsh", "💧", "静けさに慣れる", "地底の泉"],
      ["s2_suisho", "水晶の坑道", "snow", "💎", "没頭", "水晶柱"],
      ["s2_sado", "音のない砂洞", "desert", "⏳", "退屈との対話", "砂時計の間"],
      ["s2_tomoshibi", "灯火の地下街", "ember", "🔦", "小さな手応え", "古いランプ"],
      ["s2_hankyo", "反響の大空洞", "storm", "⚡", "雑音の嵐", "反響の柱"],
      ["s2_kagami", "鏡の地底湖", "lake", "🪞", "澄んだ集中", "静水の岸"],
      ["s2_tenmado", "天窓の出口", "summit", "✨", "浮上", "光の天窓"],
    ] },
  { id: "stage3", no: 3, name: "根気の大陸", habitat: "snow", nushi: "koorinotonakai", mapTint: "hue-rotate(170deg) brightness(1.1)",
    areas: [
      ["s3_shimono", "霜おりる野", "grassland", "🌾", "冷たい朝", "霜の柵"],
      ["s3_shinyo", "針葉の森", "forest", "🌲", "毎日の一歩", "樵の小屋"],
      ["s3_fukidamari", "吹きだまりの道", "snow", "❄️", "足が重い", "道しるべの杭"],
      ["s3_itetsuku", "凍てつく湖", "lake", "🧊", "変化が見えない", "氷上の轍"],
      ["s3_shirogiri", "白い霧原", "marsh", "🌫", "迷い", "霧笛の塔"],
      ["s3_umoremura", "雪に埋もれた村", "ruins", "🏚", "先に歩いた人", "村の鐘"],
      ["s3_neyuki", "根雪の尾根", "snow", "🏔", "積み重ね", "尾根の石塚"],
      ["s3_fubuki", "吹雪の峠", "storm", "🌨", "やめたくなる日", "避難小屋"],
      ["s3_yukemuri", "湯けむりの谷", "ember", "♨️", "ひと息", "湯治場"],
      ["s3_juhyo", "樹氷の頂", "summit", "🌄", "続けた者の景色", "樹氷の回廊"],
    ] },
  { id: "stage4", no: 4, name: "工夫の大陸", habitat: "desert", nushi: "nazonazosufinkusu", mapTint: "hue-rotate(-20deg) saturate(1.2)",
    areas: [
      ["s4_oasis", "オアシスの町", "grassland", "🌴", "備える", "隊商宿"],
      ["s4_hatenai", "果てない砂原", "desert", "🌵", "同じ毎日", "風紋の丘"],
      ["s4_karakuri", "からくり市場", "ruins", "⚙️", "やり方を変える", "歯車の門"],
      ["s4_caravan", "キャラバンの道", "desert", "🐪", "道連れ", "水場"],
      ["s4_shinkiro", "蜃気楼の沼", "marsh", "🌫", "見せかけの近道", "蜃気楼"],
      ["s4_hoshiyomi", "星読みの泉", "lake", "💧", "振り返り", "星図の石"],
      ["s4_shakunetsu", "灼熱の岩場", "ember", "☀️", "暑さをしのぐ知恵", "日除けの岩"],
      ["s4_sunaarashi", "砂嵐の回廊", "storm", "🌪", "試練", "砂嵐の門"],
      ["s4_kakurezato", "椰子の隠れ里", "forest", "🌿", "自分の型", "隠れ里の井戸"],
      ["s4_nazokake", "謎かけの台地", "summit", "🗿", "答えを持つ", "謎かけの台座"],
    ] },
  { id: "stage5", no: 5, name: "探究の大陸", habitat: "ruins", nushi: "kaerusennin", mapTint: "sepia(.4) hue-rotate(-10deg)",
    areas: [
      ["s5_shosha", "書写の丘", "grassland", "📜", "問いを持つ", "写本小屋"],
      ["s5_manabiya", "学び舎の森", "forest", "🌳", "先人の跡", "古い学び舎"],
      ["s5_shoko", "沈黙の書庫", "ruins", "🏛", "読む", "書庫の扉"],
      ["s5_sennin", "仙人の沼", "marsh", "🐸", "師に会う", "蓮の飛び石"],
      ["s5_hakkutsu", "発掘の砂丘", "desert", "🏺", "掘り下げる", "発掘坑"],
      ["s5_kioku", "記憶の湖", "lake", "🪞", "振り返り", "記憶の祠"],
      ["s5_meikyu", "封印の迷宮", "ruins", "🗝", "難問", "迷宮の鍵"],
      ["s5_tenmondai", "雷鳴の天文台", "storm", "🔭", "常識が崩れる", "天文台"],
      ["s5_tomyo", "灯明の地下聖堂", "ember", "🕯", "理解が灯る", "聖堂の燭台"],
      ["s5_kenja", "賢者の頂", "summit", "🌅", "自分の言葉", "賢者の椅子"],
    ] },
  { id: "stage6", no: 6, name: "絆の大陸", habitat: "shore", nushi: "irukahakase", mapTint: "hue-rotate(160deg) saturate(1.1)",
    areas: [
      ["s6_hama", "はじまりの浜", "lake", "🐚", "出会い", "貝殻の浜"],
      ["s6_minato", "花咲く港町", "grassland", "🌼", "声をかける", "港の灯台"],
      ["s6_komorebi", "木漏れ日の小径", "forest", "🌲", "寄り添う", "木漏れ日の橋"],
      ["s6_higata", "干潟の市場", "marsh", "🦀", "分け合う", "干潟の市"],
      ["s6_iruka", "イルカの湾", "lake", "🐬", "教わる", "湾の桟橋"],
      ["s6_shiosai", "潮騒の遺跡", "ruins", "🏛", "振り返り", "潮だまりの神殿"],
      ["s6_shirasuna", "白砂の島", "desert", "🏝", "ひとりの時間", "漂着の舟"],
      ["s6_misaki", "嵐の岬", "storm", "🌊", "すれ違い", "岬の灯"],
      ["s6_yunagi", "夕凪の入江", "ember", "🎐", "仲直り", "夕凪の祠"],
      ["s6_todai", "灯台の丘", "summit", "🌅", "誰かの灯りになる", "大灯台"],
    ] },
  { id: "stage7", no: 7, name: "静心の大陸", habitat: "shrine", nushi: "piisugenbu", mapTint: "hue-rotate(-40deg) saturate(.9)",
    areas: [
      ["s7_sando", "鳥居の参道", "grassland", "⛩", "立ち止まる", "一の鳥居"],
      ["s7_chikurin", "竹林の小径", "forest", "🎋", "呼吸", "竹林の門"],
      ["s7_hasuike", "蓮池の庭", "marsh", "🪷", "静める", "蓮池の橋"],
      ["s7_kodera", "古寺の回廊", "ruins", "🏯", "手放す", "鐘楼"],
      ["s7_karesansui", "枯山水の庭", "desert", "🪨", "余白", "石庭"],
      ["s7_mizukagami", "水鏡の池", "lake", "🪞", "振り返り", "水鏡"],
      ["s7_yukimi", "雪見の山寺", "snow", "❄️", "冷静", "雪見灯籠"],
      ["s7_raijin", "雷神の滝", "storm", "⛈", "揺さぶり", "滝行の岩"],
      ["s7_toro", "灯籠の谷", "ember", "🏮", "内なる火", "千の灯籠"],
      ["s7_genbu", "玄武の社", "summit", "🐢", "揺るがない心", "奥の院"],
    ] },
  { id: "stage8", no: 8, name: "結びの大陸", habitat: "guild", nushi: "kouhukufenikkusu", mapTint: "saturate(1.3) brightness(1.05)",
    areas: [
      ["s8_machi", "冒険者の街", "grassland", "🏘", "帰還", "街の大門"],
      ["s8_minarai", "見習いの森", "forest", "🌳", "昔の自分", "見習いの木"],
      ["s8_toginjo", "試練の闘技場", "ruins", "⚔️", "力を試す", "闘技場の門"],
      ["s8_funsui", "憩いの噴水広場", "lake", "⛲", "語り合う", "噴水"],
      ["s8_chizushi", "地図職人の荒野", "desert", "🗺", "道を残す", "道標の塔"],
      ["s8_omoide", "思い出の湿原", "marsh", "🌫", "振り返り", "記念の碑"],
      ["s8_shihan", "師範の雪山", "snow", "🏔", "教える", "師範の庵"],
      ["s8_ryu", "竜の渓谷", "storm", "🐉", "最後の試練", "竜の門"],
      ["s8_kaji", "鍛冶の谷", "ember", "🔥", "磨き上げる", "炉の火"],
      ["s8_tou", "大ギルドの塔", "summit", "🏆", "次の誰かへ", "ギルドの紋章"],
    ] },
];
function expandContinent(def) {
  return { ...def, cells: 100, areas: def.areas.map(([id, name, terrain, emoji, theme, landmark], i) => {
    const color = STAGES[0].areas.find(a => a.terrain === terrain);
    const slot = STAGES[0].areas[i];
    return { id, no: i + 1, range: [i * 10 + 1, i * 10 + 10], name, terrain, emoji, theme,
      accent: color.accent, rgb: color.rgb, palette: { ...color.palette },
      map: { ...slot.map }, intensity: slot.intensity, review: slot.review, goal: slot.goal,
      landmark: { id: id + '_lm', name: landmark } };
  }) };
}
CONTINENT_DEFS.forEach(def => STAGES.push(expandContinent(def)));
const CONTINENT_COUNT = 8;
function continentForStage(stageNo) {
  const n = Math.max(1, Number(stageNo) || 1);
  return STAGES[(n - 1) % CONTINENT_COUNT];
}

// ---- localStorage キー（gq_ 接頭辞の規約に従う） ----
//
// 到達した最大マスは保存しない。gq_sugoroku の pos が既に持っており、
// 2か所に分けると「片方だけ更新される日」が必ず来るため（掟5・§6.2）。

const KEYS = {
  // 大陸図を最後に開いたときの累計位置（gq_sugoroku.pos）。雲が晴れる差分アニメだけに使う。
  seenCell: 'gq_world_seen_cell',
};

// ---- 保存領域アクセス（必ずこの2つを経由する） ----
//
// 保存領域に触るだけで例外が飛ぶ環境がある（Safariの file://・プライベート
// ブラウズ・Cookie全ブロック）。裸で触ると、そこでファイルの評価が止まり
// 以降の宣言が未初期化のまま残る＝ロゴ画面フリーズ（c5a0b9d と同型）。

function lsGet(key, fallback = null) {
  try { return localStorage.getItem(key); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 記録できなくても動作は続ける */ }
}

// ---- 参照ヘルパ ----

function getStage(stageId = 'stage1') {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0];
}

/**
 * マス番号からエリアを引く。
 * ⚠️ 引数は 1〜100 のマス番号。gq_sugoroku の pos はステージをまたぐと
 *    100を超え続けるので、必ず sgGetCellNum(pos) を通してから渡すこと。
 */
function areaOf(cell, stageId = 'stage1') {
  const areas = getStage(stageId).areas;
  return areas.find((a) => cell >= a.range[0] && cell <= a.range[1]) ?? areas[0];
}

/** エリア内での進み具合（0〜1）。上部バーの「5 / 10」表示などに使う */
function progressInArea(cell, area) {
  const [from, to] = area.range;
  const span = to - from + 1;
  const done = Math.min(Math.max(cell - from + 1, 0), span);
  return { done, span, ratio: done / span };
}

/** そのマスがエリア境界（ランドマーク通過）かどうか */
function isBoundary(cell, stageId = 'stage1') {
  return getStage(stageId).areas.some((a) => a.range[1] === cell);
}

// ---- 大陸図の雲（Phase 3 で使う。Phase 1〜2 では誰も呼ばない） ----

/**
 * エリアを覆う雲の不透明度（0〜1）。
 * エリアに入ってから徐々に薄くなり、最終マスで完全に晴れる。
 * 一度晴れた雲は戻らない — maxCell は単調増加なので自然に担保される。
 */
function cloudOpacity(area, maxCell) {
  const [from, to] = area.range;
  const remaining = (to - maxCell) / (to - from + 1);
  return Math.min(Math.max(remaining, 0), 1);
}

/**
 * 大陸図を開いたときの差分。前回見たときから今回までに晴れるエリアを返す。
 * @param {number} maxCell 現在の大陸内の到達マス（0〜100）。
 * from は保存済みの累計位置。呼ぶ側が現在の周回のマスに換算する。
 */
function revealDiff(maxCell, stageId = 'stage1') {
  const to = maxCell;
  const from = Number(lsGet(KEYS.seenCell) ?? 0);
  const areas = getStage(stageId).areas.filter(
    (a) => cloudOpacity(a, from) > 0 && cloudOpacity(a, to) < cloudOpacity(a, from)
  );
  return { from, to, areas };
}

/** 差分アニメの再生後に呼ぶ。引数は累計位置（pos）。既存値の移行はしない。 */
function markSeen(maxCell) {
  lsSet(KEYS.seenCell, String(maxCell));
}

// ---- マスの言葉 ────────────────────────────────────────
//
// すごろくの100マスのうち40マスは「順調に進んでいます！」の一文しか出ない。
// 一方このファイルには、10エリアそれぞれに theme（心の段階）が設計してある。
// ＝ 世界は書けているのに、歩いている人には届いていない状態だった。
//
// ■ ここに文章を足すと、そのエリアを歩いたとき代わりに表示される。
// ■ 空のままでも壊れない（従来どおり「順調に進んでいます！」が出る）。
//   だから、書けたエリアから少しずつ埋めていける。
//
//   lines … 何もないマスに止まったとき。複数書くと、その中からランダムに1つ
//   clear … そのエリアの最後のマス（10,20,…）を踏んで、エリアを抜けたとき
//
// 書くときのコツ:
//   ・XPや進み具合の実況をしない（それは別の場所に出ている）
//   ・そのエリアの theme に、いま歩いている人の気持ちを重ねる
//   ・短く。1〜2行で読み切れる長さに
//
// 例（はじまりの草原・踏み出す）:
//   lines: ['風がやわらかい。まだ何も成し遂げていないが、もう歩き出している。'],
//   clear: '石橋を渡った。最初の一歩は、いつも一番重い。',

const AREA_LINES = {
  sougen:    { lines: [], clear: '' },   // 1 はじまりの草原 — 踏み出す
  mori:      { lines: [], clear: '' },   // 2 ささやきの森   — 続かない不安
  shitsugen: { lines: [], clear: '' },   // 3 霧雨の湿原     — 重い時期
  iseki:     { lines: [], clear: '' },   // 4 忘れられた遺跡 — 先人を知る
  sunahara:  { lines: [], clear: '' },   // 5 灼けた砂原     — 単調さ
  mizuumi:   { lines: [], clear: '' },   // 6 鏡面の湖       — 振り返り
  setsuzan:  { lines: [], clear: '' },   // 7 凍る雪山       — 本気の負荷
  touge:     { lines: [], clear: '' },   // 8 雷鳴の峠       — 最大の試練
  okibi:     { lines: [], clear: '' },   // 9 熾火の谷       — 静かに燃え続ける
  itadaki:   { lines: [], clear: '' },   // 10 暁の頂        — 到達
};

CONTINENT_DEFS.forEach(def => def.areas.forEach(([id]) => {
  AREA_LINES[id] = { lines: [], clear: '' };
}));

/**
 * そのマスで出す言葉を1つ返す。まだ書かれていなければ null。
 * 呼ぶ側は null のとき従来の文言を使うこと（＝空でも壊れない）。
 * @param {number} cell 1〜100 に正規化済みのマス番号（sgGetCellNum を通したもの）
 * @param {'normal'|'clear'} kind
 */
function lineFor(cell, kind = 'normal', stageId = 'stage1') {
  const area = areaOf(cell, stageId);
  const set = area && AREA_LINES[area.id];
  if (!set) return null;
  if (kind === 'clear') return set.clear || null;
  const list = set.lines;
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// ---- 公開窓口（otomon.js と同じ流儀。export は使わない） ----

window.Areas = {
  STAGES, KEYS, AREA_LINES, CONTINENT_COUNT, continentForStage,
  getStage, areaOf, progressInArea, isBoundary,
  cloudOpacity, revealDiff, markSeen,
  lineFor,
};
