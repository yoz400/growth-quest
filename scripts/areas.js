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
 * -- 表示情報（Phase 1 では既存 SG_ZONES と同値。Phase 2 で差し替える）--
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
 * @property {Object} map         大陸図上の座標（viewBox 680x460 基準）
 */

const STAGES = [
  {
    id: 'stage1',
    no: 1,
    name: '習慣の大陸',
    cells: 100,
    areas: [
      {
        id: 'sougen', no: 1, range: [1, 10],
        name: '草　原', terrain: 'grassland',
        emoji: '🌿', accent: '#86efac', rgb: '134,239,172',
        theme: '踏み出す',
        palette: { base: '#2c5b3c', accent: '#3f8a55', sky: '#1b3a2c' },
        otomonAttr: 'beast',
        landmark: { id: 'ishibashi', name: '石橋' },
        intensity: 2,
        map: { x: 95, y: 350 },
      },
      {
        id: 'mori', no: 2, range: [11, 20],
        name: '深い森', terrain: 'forest',
        emoji: '🌲', accent: '#4ade80', rgb: '74,222,128',
        theme: '続かない不安',
        palette: { base: '#20452f', accent: '#2f7a45', sky: '#16301f' },
        otomonAttr: 'plant',
        landmark: { id: 'michishirube', name: '苔むした道標' },
        intensity: 2,
        map: { x: 185, y: 375 },
      },
      {
        id: 'shitsugen', no: 3, range: [21, 30],
        name: '洞　窟', terrain: 'cave',
        emoji: '💎', accent: '#a78bfa', rgb: '167,139,250',
        theme: '重い時期',
        palette: { base: '#3a4f52', accent: '#6b8f92', sky: '#2a3a3d' },
        otomonAttr: 'mist',
        landmark: { id: 'sandou', name: '朽ちた桟道' },
        intensity: 2,
        map: { x: 280, y: 345 },
      },
      {
        id: 'iseki', no: 4, range: [31, 40],
        name: '古代遺跡', terrain: 'ruins',
        emoji: '🏛', accent: '#fb923c', rgb: '251,146,60',
        theme: '先人を知る',
        palette: { base: '#4a4433', accent: '#8c7f5e', sky: '#332f24' },
        otomonAttr: 'ancient',
        landmark: { id: 'mon', name: '遺跡の門' },
        intensity: 3,
        map: { x: 370, y: 375 },
      },
      {
        id: 'sunahara', no: 5, range: [41, 50],
        name: '砂　漠', terrain: 'desert',
        emoji: '🌵', accent: '#fbbf24', rgb: '251,191,36',
        theme: '単調さ',
        palette: { base: '#6b5a34', accent: '#b8973f', sky: '#4a3f24' },
        otomonAttr: 'mineral',
        landmark: { id: 'kareido', name: '涸れた井戸' },
        intensity: 2,
        map: { x: 465, y: 345 },
      },
      {
        id: 'mizuumi', no: 6, range: [51, 60],
        name: '大海原', terrain: 'ocean',
        emoji: '🌊', accent: '#38bdf8', rgb: '56,189,248',
        theme: '振り返り',
        palette: { base: '#22485f', accent: '#3f86ad', sky: '#16303f' },
        otomonAttr: 'aqua',
        landmark: { id: 'sanbashi', name: '桟橋' },
        intensity: 3,
        map: { x: 555, y: 375 },
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
        map: { x: 600, y: 265 },
      },
      {
        id: 'touge', no: 8, range: [71, 80],
        name: '天空の城', terrain: 'sky',
        emoji: '☁️', accent: '#c4b5fd', rgb: '196,181,253',
        theme: '最大の試練',
        palette: { base: '#3c4a5e', accent: '#8fa3c0', sky: '#252f3d' },
        otomonAttr: 'thunder',
        landmark: { id: 'tsuribashi', name: '吊り橋' },
        intensity: 5, // ステージ1のクライマックス。演出はここに寄せる
        map: { x: 505, y: 205 },
      },
      {
        id: 'okibi', no: 9, range: [81, 90],
        name: '火　山', terrain: 'volcano',
        emoji: '🔥', accent: '#f87171', rgb: '248,113,113',
        theme: '静かに燃え続ける',
        palette: { base: '#2a221e', accent: '#c25a34', sky: '#1a1512' },
        otomonAttr: 'ember',
        landmark: { id: 'haiwatari', name: '灰の渡り' },
        intensity: 1, // 抑えるほど効く。峠の直後の静けさ
        map: { x: 370, y: 175 },
      },
      {
        id: 'itadaki', no: 10, range: [91, 100],
        name: '龍の城', terrain: 'dragon',
        emoji: '🐉', accent: '#fbbf24', rgb: '220,38,38',
        theme: '到達',
        palette: { base: '#4a5a72', accent: '#e0c86a', sky: '#5a6b85' },
        otomonAttr: 'light',
        landmark: { id: 'unkai', name: '雲海の階段' },
        intensity: 4,
        map: { x: 230, y: 155 },
        goal: true,
      },
    ],
  },
];

// ---- localStorage キー（gq_ 接頭辞の規約に従う） ----
//
// 到達した最大マスは保存しない。gq_sugoroku の pos が既に持っており、
// 2か所に分けると「片方だけ更新される日」が必ず来るため（掟5・§6.2）。

const KEYS = {
  // 大陸図を最後に開いたときの到達マス。雲が晴れる差分アニメだけに使う。
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
 * @param {number} maxCell 到達済み最大マス（1〜100）。呼ぶ側が
 *        sgGetCellNum(sugorokuData.pos) を渡す。
 */
function revealDiff(maxCell, stageId = 'stage1') {
  const to = maxCell;
  const from = Number(lsGet(KEYS.seenCell) ?? 0);
  const areas = getStage(stageId).areas.filter(
    (a) => cloudOpacity(a, from) > 0 && cloudOpacity(a, to) < cloudOpacity(a, from)
  );
  return { from, to, areas };
}

/** 差分アニメの再生後に呼ぶ。引数は revealDiff に渡したのと同じ maxCell */
function markSeen(maxCell) {
  lsSet(KEYS.seenCell, String(maxCell));
}

// ---- 公開窓口（otomon.js と同じ流儀。export は使わない） ----

window.Areas = {
  STAGES, KEYS,
  getStage, areaOf, progressInArea, isBoundary,
  cloudOpacity, revealDiff, markSeen,
};
