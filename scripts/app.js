// ═══════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════
const MODES = {
  pomodoro: { focus: 25, break: 5 },
  deep:     { focus: 50, break: 10 },
  flow:     { focus: null, break: 0 },
};

const DEFAULT_DATA = {
  level: 1, xp: 0, totalMinutes: 0,
  sessions: 0, todayMinutes: 0, lastDate: '',
  streak: 0, streakLastDate: '', freezeItems: 1, lastFreezeGrantYM: '',
  streakProtectUsedFor: '',  // 装備 streak_protect の発動済みトリガー日（同一日で二重発動を防ぐ）
  streakWasBroken: false,    // 連続記録が途切れた直後フラグ。次回のセッションで復帰ボーナス発火
  confidence: 0,             // 自信ゲージの値（0..99、100到達でレベルアップ）
  confidenceLevel: 1,        // 自信レベル
  history: {}, historyDetails: {},
  morningSessions: 0, nightSessions: 0, flowSessions: 0, freezeEverUsed: false,
};

const DEFAULT_SETTINGS = {
  defaultMode: 'pomodoro',
  kokuStyle: 'fude',
  hideTime: false,
  anim: 'random',
  sound: true,
  notif: true,
};

function loadData() {
  try {
    const d = { ...DEFAULT_DATA, ...JSON.parse(localStorage.getItem('gq_data') || '{}') };
    if (!d.history) d.history = {};
    if (!d.historyDetails) d.historyDetails = {};
    return d;
  } catch { return { ...DEFAULT_DATA }; }
}
function saveData(d) { localStorage.setItem('gq_data', JSON.stringify(d)); }

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('gq_settings') || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { localStorage.setItem('gq_settings', JSON.stringify(s)); }

const DEFAULT_GENRES = [{ id: 'default', name: '学習', emoji: '📖', color: '#06b6d4', xp: 0, minutes: 0 }];
function loadGenres() {
  try {
    const g = JSON.parse(localStorage.getItem('gq_genres') || 'null');
    return g && g.length ? g : [...DEFAULT_GENRES];
  } catch { return [...DEFAULT_GENRES]; }
}
function saveGenres() { localStorage.setItem('gq_genres', JSON.stringify(genres)); }

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let data = loadData();
let settings = loadSettings();
let genres = loadGenres();
let currentGenreId = genres[0]?.id || 'default';
let editingGenreId = null;

// ═══════════════════════════════════════════════════════
//  SUGOROKU SYSTEM — DATA
// ═══════════════════════════════════════════════════════

// Cell types: [0]='start', [1-100]=type
const BOARD_CELL_TYPES = (() => {
  const t = {};
  t[100] = 'goal';
  [10,20,30,40,50,60,70,80,90].forEach(i => t[i] = 'checkpoint');
  [15,28,44,68,88].forEach(i => t[i] = 'rare');
  [7,17,23,34,41,52,59,63,75,81,85,92,95,97,99].forEach(i => t[i] = 'event');
  [3,5,8,11,16,18,22,25,29,32,36,38,45,47,51,53,56,61,64,69,71,73,76,79,83,86,89,91,93,98].forEach(i => t[i] = 'item');
  const result = ['start'];
  for (let i = 1; i <= 100; i++) result.push(t[i] || 'normal');
  return result;
})();

const SUGOROKU_ITEMS = [
  { id:'focus_gem',   name:'集中の珠',    emoji:'💎', xp:15 },
  { id:'sage_staff',  name:'賢者の杖',    emoji:'🪄', xp:10 },
  { id:'study_book',  name:'学びの本',    emoji:'📕', xp:12 },
  { id:'lucky_coin',  name:'幸運のコイン', emoji:'🪙', xp:20 },
  { id:'compass',     name:'羅針盤',      emoji:'🧭', xp:10 },
  { id:'torch',       name:'探求の炬火',  emoji:'🔦', xp:10 },
  { id:'crown',       name:'挑戦者の冠',  emoji:'👑', xp:25 },
  { id:'hourglass',   name:'砂時計',      emoji:'⏳', xp:10 },
  { id:'shield',      name:'守りの盾',    emoji:'🛡', xp:12 },
  { id:'lantern',     name:'学びの灯籠',  emoji:'🏮', xp:15 },
  // 装備アイテム獲得枠（type='equipment' を doSugorokuRoll が検知して特別処理）
  { id:'equipment_drop', name:'装備発見', emoji:'🎁', xp:30, type:'equipment' },
  { id:'legend_gem',  name:'伝説の珠',    emoji:'🌟', xp:50, rare:true },
  { id:'dragon_scroll',name:'龍の巻物',   emoji:'📜', xp:40, rare:true },
  { id:'phoenix',     name:'鳳凰の羽',    emoji:'🪶', xp:45, rare:true },
  { id:'cosmic_orb',  name:'宇宙の珠',    emoji:'🔮', xp:55, rare:true },
  { id:'golden_key',  name:'黄金の鍵',    emoji:'🗝', xp:35, rare:true },
];

function loadSugorokuData() {
  try { return JSON.parse(localStorage.getItem('gq_sugoroku') || 'null') || { pos:0, stage:1, items:[], initialized:false }; }
  catch { return { pos:0, stage:1, items:[], initialized:false }; }
}
function saveSugorokuData() { localStorage.setItem('gq_sugoroku', JSON.stringify(sugorokuData)); }

let sugorokuData = loadSugorokuData();
let pendingSugorokuRoll = null;
let _sgSpinInt = null, _sgSpinT1 = null, _sgSpinT2 = null, _sgAutoClose = null;
let sgAnimating   = false;         // 歩行アニメ実行中フラグ
let sgPendingWalk = null;          // { fromPos, rollTime } ─ 次の開放時にアニメ再生

// ═══════════════════════════════════════════════════════
//  EQUIPMENT SYSTEM — DATA
//  ・ITEM_MASTER:   コード内定数（アイテム定義の一覧）
//  ・inventory:     localStorage（gq_inventory）所持アイテムid配列
//  ・equippedItems: localStorage（gq_equipped）カテゴリ→id（or null）
// ═══════════════════════════════════════════════════════
const EQUIPMENT_CATEGORIES = ['head', 'body', 'hand', 'back', 'pet'];

const CATEGORY_LABEL = {
  head: '頭',
  body: '体',
  hand: '手',
  back: '背中',
  pet:  'ペット',
};

// レアリティ別の抽選 weight（合計100 の感覚で書ける）
const EQUIPMENT_RARITY_WEIGHTS = {
  common:    60,
  rare:      25,
  epic:      10,
  legendary:  5,
};

// 全装備所持済みのとき、equipment_drop に当たった場合の代替ボーナスXP
const EQUIPMENT_DUPLICATE_COMPENSATION_XP = 50;

// effect は { type, value, desc } 形。type は将来増やせる：
//   xp_mult / dice_bonus / streak_protect / comment …
// imagePath は PNG 用意後に差し替える。null のうちは emoji が表示される。
const ITEM_MASTER = [
  // ── head（頭装備）─────────────────────────────
  { id:'cap_focus',     name:'集中のキャップ',  category:'head', rarity:'common',
    emoji:'🧢', imagePath:'assets/equipment/head/cap_focus.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'被ると、ふと深呼吸したくなる。' },
  { id:'crown_scholar', name:'学者の冠',        category:'head', rarity:'legendary',
    emoji:'👑', imagePath:'assets/equipment/head/crown_scholar.png',
    effect:{ type:'xp_mult', value:1.15, desc:'XP +15%' },
    flavorText:'知の頂きに立つ者だけに許された輝き。' },

  // ── body（胴装備）─────────────────────────────
  { id:'vest_adventurer', name:'冒険者のベスト', category:'body', rarity:'common',
    emoji:'🦺', imagePath:'assets/equipment/body/vest_adventurer.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'走り出す背中を、いつもそっと支える。' },
  { id:'robe_sage',       name:'賢者のローブ',   category:'body', rarity:'rare',
    emoji:'🥋', imagePath:'assets/equipment/body/robe_sage.png',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'一度結べば、雨の日も心が乾く。' },

  // ── hand（手装備）─────────────────────────────
  { id:'sword_brave',  name:'勇者の剣',         category:'hand', rarity:'rare',
    emoji:'⚔', imagePath:'assets/equipment/hand/sword_brave.png',
    effect:{ type:'dice_bonus', value:1, desc:'すごろく出目+1' },
    flavorText:'切るのは敵じゃない、迷いだけ。' },
  { id:'staff_wisdom', name:'知恵の杖',         category:'hand', rarity:'epic',
    emoji:'🪄', imagePath:'assets/equipment/hand/staff_wisdom.png',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'振るたびに、頭の中の霧が晴れていく。' },

  // ── back（背中装備）───────────────────────────
  { id:'bag_explorer', name:'探検家のリュック',  category:'back', rarity:'common',
    emoji:'🎒', imagePath:'assets/equipment/back/bag_explorer.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'今日もどこかへ、何かを掴みに。' },
  { id:'cape_phoenix', name:'不死鳥のマント',    category:'back', rarity:'legendary',
    emoji:'🧥', imagePath:'assets/equipment/back/cape_phoenix.png',
    effect:{ type:'xp_mult', value:1.15, desc:'XP +15%' },
    flavorText:'何度倒れても、また燃え上がる羽。' },

  // ── pet（ペット）──────────────────────────────
  { id:'pet_cat', name:'勉強猫',   category:'pet', rarity:'common',
    emoji:'🐈', imagePath:'assets/equipment/pet/pet_cat.png',
    effect:{ type:'comment', value:'にゃ〜', desc:'たまに励ましてくれる' },
    flavorText:'いつの間にか、隣でひとやすみ。' },
  { id:'pet_owl', name:'物知り梟', category:'pet', rarity:'rare',
    emoji:'🦉', imagePath:'assets/equipment/pet/pet_owl.png',
    effect:{ type:'xp_mult', value:1.10, desc:'XP +10%' },
    flavorText:'静かな夜、君の問いに首をかしげる。' },

  // ═══════════ 追加アイテム（各カテゴリ +4個）═══════════
  // ── head（追加）─────────────────────────────
  { id:'hood_moonlight',  name:'月明かりのフード',  category:'head', rarity:'common',
    emoji:'🌙', imagePath:'assets/equipment/head/hood_moonlight.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'静かな夜でも、心の灯りは消えない。' },
  { id:'goggles_focus',   name:'集中ゴーグル',      category:'head', rarity:'rare',
    emoji:'🥽', imagePath:'assets/equipment/head/goggles_focus.png',
    effect:{ type:'xp_mult', value:1.10, desc:'XP +10%' },
    flavorText:'余計な景色を閉じて、大事なものだけを見る。' },
  { id:'tiara_starlight', name:'星読みのティアラ',  category:'head', rarity:'epic',
    emoji:'💫', imagePath:'assets/equipment/head/tiara_starlight.png',
    effect:{ type:'xp_mult', value:1.12, desc:'XP +12%' },
    flavorText:'小さな努力の星座を、未来へつなげる。' },
  { id:'halo_dawn',       name:'夜明けの光輪',      category:'head', rarity:'legendary',
    emoji:'🌅', imagePath:'assets/equipment/head/halo_dawn.png',
    effect:{ type:'xp_mult', value:1.15, desc:'XP +15%' },
    flavorText:'今日という冒険を、まぶしく始める者の証。' },

  // ── body(追加)─────────────────────────────
  { id:'jacket_morning',      name:'朝活ジャケット',  category:'body', rarity:'common',
    emoji:'🧥', imagePath:'assets/equipment/body/jacket_morning.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'袖を通すだけで、少しだけ早く動き出せる。' },
  { id:'apron_creator',       name:'創作のエプロン',  category:'body', rarity:'rare',
    emoji:'👕', imagePath:'assets/equipment/body/apron_creator.png',
    effect:{ type:'xp_mult', value:1.10, desc:'XP +10%' },
    flavorText:'手を動かす人に、ひらめきは降りてくる。' },
  { id:'coat_guardian',       name:'守り人のコート',  category:'body', rarity:'epic',
    emoji:'🛡️', imagePath:'assets/equipment/body/coat_guardian.png',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'続けてきた日々を、静かに守る頼もしい一着。' },
  { id:'armor_constellation', name:'星座の軽鎧',      category:'body', rarity:'legendary',
    emoji:'🌌', imagePath:'assets/equipment/body/armor_constellation.png',
    effect:{ type:'xp_mult', value:1.15, desc:'XP +15%' },
    flavorText:'積み重ねた時間が、胸元で星のように輝く。' },

  // ── hand（追加）─────────────────────────────
  { id:'mug_calm',         name:'ひと息のマグ',   category:'hand', rarity:'common',
    emoji:'☕', imagePath:'assets/equipment/hand/mug_calm.png',
    effect:{ type:'comment', value:'ひと息ついたら、また進もう。', desc:'たまに励ましてくれる' },
    flavorText:'休むことも、前に進むための準備。' },
  { id:'notebook_quest',   name:'冒険者のノート', category:'hand', rarity:'rare',
    emoji:'📓', imagePath:'assets/equipment/hand/notebook_quest.png',
    effect:{ type:'xp_mult', value:1.10, desc:'XP +10%' },
    flavorText:'書き残した一行が、明日の道しるべになる。' },
  { id:'compass_momentum', name:'前進のコンパス', category:'hand', rarity:'epic',
    emoji:'🧭', imagePath:'assets/equipment/hand/compass_momentum.png',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'迷っても大丈夫。進む方角は、もう決まっている。' },
  { id:'lantern_truth',    name:'真理のランタン', category:'hand', rarity:'legendary',
    emoji:'🏮', imagePath:'assets/equipment/hand/lantern_truth.png',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'暗い道でも、学ぶ者の足元だけは照らされる。' },

  // ── back（追加）─────────────────────────────
  { id:'scarf_breeze',       name:'追い風のスカーフ', category:'back', rarity:'common',
    emoji:'🧣', imagePath:'assets/equipment/back/scarf_breeze.png',
    effect:{ type:'xp_mult', value:1.05, desc:'XP +5%' },
    flavorText:'ほんの少しの追い風が、今日の一歩を軽くする。' },
  { id:'wings_small',        name:'小さな羽',         category:'back', rarity:'rare',
    emoji:'🪽', imagePath:'assets/equipment/back/wings_small.png',
    effect:{ type:'dice_bonus', value:1, desc:'すごろく出目+1' },
    flavorText:'飛べなくてもいい。昨日より少し浮けばいい。' },
  { id:'cloak_silence',      name:'静寂のクローク',   category:'back', rarity:'epic',
    emoji:'🌫️', imagePath:'assets/equipment/back/cloak_silence.png',
    effect:{ type:'xp_mult', value:1.12, desc:'XP +12%' },
    flavorText:'雑音を遠ざけ、集中だけをそっと包み込む。' },
  { id:'wings_phoenix_gold', name:'黄金不死鳥の翼',   category:'back', rarity:'legendary',
    emoji:'🔥', imagePath:'assets/equipment/back/wings_phoenix_gold.png',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'途切れそうな炎を、もう一度空へ舞い上げる。' },

  // ── pet（追加）──────────────────────────────
  { id:'pet_slime',  name:'ぷるぷるスライム', category:'pet', rarity:'common',
    emoji:'🫧', imagePath:'assets/equipment/pet/pet_slime.png',
    effect:{ type:'comment', value:'ぷるん。今日もえらい！', desc:'たまに励ましてくれる' },
    flavorText:'何も言わずに、ぷるぷる応援してくれる。' },
  { id:'pet_rabbit', name:'朝駆けうさぎ',     category:'pet', rarity:'rare',
    emoji:'🐇', imagePath:'assets/equipment/pet/pet_rabbit.png',
    effect:{ type:'comment', value:'ぴょんっと一歩、進めたね。', desc:'たまに励ましてくれる' },
    flavorText:'小さな足音で、やる気を連れてくる。' },
  { id:'pet_fox',    name:'知恵ぎつね',       category:'pet', rarity:'epic',
    emoji:'🦊', imagePath:'assets/equipment/pet/pet_fox.png',
    effect:{ type:'xp_mult', value:1.12, desc:'XP +12%' },
    flavorText:'近道ではなく、賢い道をそっと教えてくれる。' },
  { id:'pet_dragon', name:'ちびドラゴン',     category:'pet', rarity:'legendary',
    emoji:'🐉', imagePath:'assets/equipment/pet/pet_dragon.png',
    effect:{ type:'comment', value:'今日の炎、なかなか良かったぞ。', desc:'特別な一言で励ましてくれる' },
    flavorText:'小さいけれど、胸の奥に大きな炎を宿している。' },
];

// id からマスター定義を引くヘルパ
function getItemById(id) {
  return ITEM_MASTER.find(m => m.id === id) || null;
}

// アイコン描画ヘルパ：imagePath があれば <img>、無ければ emoji にフォールバック
function renderItemIcon(item, size = 32) {
  if (!item) return '';
  const emoji = item.emoji || '';
  // emoji フォールバック HTML（共通生成）
  const fallbackHTML = `<span style="font-size:${size}px;line-height:1;display:inline-block;vertical-align:middle">${emoji}</span>`;
  if (item.imagePath) {
    // 画像読み込み失敗時は emoji 表示に置換（PNG未配置でも壊れた画像が出ない）
    const fallbackEscaped = fallbackHTML.replace(/"/g, '&quot;');
    return `<img src="${item.imagePath}" alt="${item.name || ''}" `
         + `onerror="this.outerHTML='${fallbackEscaped}'" `
         + `style="width:${size}px;height:${size}px;object-fit:contain;display:inline-block;vertical-align:middle">`;
  }
  return fallbackHTML;
}

// ── inventory（所持アイテム）── localStorage: gq_inventory
function loadInventory() {
  try { return JSON.parse(localStorage.getItem('gq_inventory') || 'null') || []; }
  catch { return []; }
}
function saveInventory() {
  localStorage.setItem('gq_inventory', JSON.stringify(inventory));
}

// ── equippedItems（装備中）── localStorage: gq_equipped
function loadEquipped() {
  const empty = { head:null, body:null, hand:null, back:null, pet:null };
  try { return Object.assign({}, empty, JSON.parse(localStorage.getItem('gq_equipped') || 'null') || {}); }
  catch { return empty; }
}
function saveEquipped() {
  localStorage.setItem('gq_equipped', JSON.stringify(equippedItems));
}

let inventory     = loadInventory();
let equippedItems = loadEquipped();

// 整合性チェック：装備中の id が inventory に無い／マスターに無い場合は外す
EQUIPMENT_CATEGORIES.forEach(cat => {
  const id = equippedItems[cat];
  if (id && (!inventory.includes(id) || !getItemById(id))) {
    equippedItems[cat] = null;
  }
});

// ── 所持品の操作ヘルパ ─────────────────────────────────
// inventory に追加。マスターに存在しない／既に所持なら false
function addItemToInventory(itemId) {
  if (!getItemById(itemId)) return false;
  if (inventory.includes(itemId)) return false;
  inventory.push(itemId);
  saveInventory();
  return true;
}

// inventory から削除。装備中なら該当スロットを null に戻す
function removeItemFromInventory(itemId) {
  const idx = inventory.indexOf(itemId);
  if (idx === -1) return false;
  inventory.splice(idx, 1);
  EQUIPMENT_CATEGORIES.forEach(cat => {
    if (equippedItems[cat] === itemId) equippedItems[cat] = null;
  });
  saveInventory();
  saveEquipped();
  return true;
}

// inventory の id 配列 → マスター定義オブジェクト配列（古いidは除外）
function getOwnedItems() {
  return inventory.map(id => getItemById(id)).filter(item => item !== null);
}

// 所持判定
function hasItem(itemId) {
  return inventory.includes(itemId);
}

// ── 装備の操作ヘルパ ─────────────────────────────────
// 装備する。マスターに無い／未所持なら false
function equipItem(itemId) {
  const item = getItemById(itemId);
  if (!item) return false;
  if (!hasItem(itemId)) return false;
  equippedItems[item.category] = itemId;
  saveEquipped();
  return true;
}

// カテゴリの装備を外す。無効カテゴリなら false
function unequipItem(category) {
  if (!EQUIPMENT_CATEGORIES.includes(category)) return false;
  equippedItems[category] = null;
  saveEquipped();
  return true;
}

// 装備中の id を ITEM_MASTER のオブジェクトに変換して返す
// 形式: { head: itemObj|null, body: ..., hand: ..., back: ..., pet: ... }
function getEquippedItems() {
  const result = {};
  EQUIPMENT_CATEGORIES.forEach(cat => {
    const id = equippedItems[cat];
    result[cat] = id ? (getItemById(id) || null) : null;
  });
  return result;
}

// このアイテムidが現在どこかに装備されているか
function isEquipped(itemId) {
  return EQUIPMENT_CATEGORIES.some(cat => equippedItems[cat] === itemId);
}

// ── 双六報酬: 装備アイテム配布 ─────────────────────────
// ITEM_MASTER から未所持のものだけ返す
function getUnownedItems() {
  return ITEM_MASTER.filter(m => !inventory.includes(m.id));
}

// 利用可能アイテムに「実在するレアリティだけ」を対象に weight 抽選
// 例: legendary が全て所持済みなら legendary は対象外
function pickWeightedRarity(availableItems) {
  const presentRarities = new Set(availableItems.map(it => it.rarity));
  const entries = Object.entries(EQUIPMENT_RARITY_WEIGHTS)
    .filter(([rar]) => presentRarities.has(rar));
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [rar, w] of entries) {
    r -= w;
    if (r < 0) return rar;
  }
  return entries[entries.length - 1][0];   // 浮動小数誤差の保険
}

// 未所持からランダムに1個。レアリティ別 weight で2段階抽選：
//   1) 残っているレアリティから weight に基づき抽選
//   2) そのレアリティの未所持アイテムから等確率で1つ選ぶ
function getRandomUnownedItem() {
  const pool = getUnownedItems();
  if (pool.length === 0) return null;
  const rarity = pickWeightedRarity(pool);
  if (!rarity) return null;
  const filtered = pool.filter(it => it.rarity === rarity);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// デバッグ用：実際の所持には触れず、現在の未所持プールで抽選結果だけを集計
// 例) testEquipmentRarityRolls(1000) → console.table で確認
function testEquipmentRarityRolls(count) {
  count = count || 1000;
  const pool = getUnownedItems();
  if (pool.length === 0) {
    console.warn('未所持アイテムがありません。inventory を空にしてから試してください。');
    return;
  }
  const tally = { common:0, rare:0, epic:0, legendary:0 };
  for (let i = 0; i < count; i++) {
    const rar = pickWeightedRarity(pool);
    if (rar) tally[rar]++;
  }
  const rows = Object.entries(tally).map(([rar, n]) => ({
    rarity:  rar,
    count:   n,
    percent: ((n / count) * 100).toFixed(1) + '%',
  }));
  console.table(rows);
  return tally;
}
// 装備モーダルが開いていれば再描画。閉じていれば何もしない（エラーにしない）
function refreshEquipmentModalIfOpen() {
  const ov = document.getElementById('equipment-overlay');
  if (ov && ov.classList.contains('open')) renderEquipmentModal();
}
// 未所持アイテムを1個 inventory に追加して返す。配布できなければ null
function grantRandomEquipmentItem() {
  const item = getRandomUnownedItem();
  if (!item) return null;
  if (addItemToInventory(item.id)) {
    refreshEquipmentModalIfOpen();
    return item;
  }
  return null;
}

// ── 装備効果: XP倍率（今回は xp_mult のみ実装）─────────────
// 装備中の xp_mult を全て掛け合わせる。装備なしなら 1
function getEquipmentXpMultiplier() {
  const equipped = getEquippedItems();
  let mult = 1;
  EQUIPMENT_CATEGORIES.forEach(cat => {
    const item = equipped[cat];
    if (item && item.effect && item.effect.type === 'xp_mult') {
      mult *= item.effect.value;
    }
  });
  return mult;
}

// baseXp に装備倍率を適用。{ finalXp, bonusXp, multiplier } を返す
function applyEquipmentXpBonus(baseXp) {
  const multiplier = getEquipmentXpMultiplier();
  const finalXp   = Math.round(baseXp * multiplier);
  return {
    finalXp,
    bonusXp:    finalXp - baseXp,
    multiplier,
  };
}

// ── 装備効果: すごろく出目ボーナス（dice_bonus）─────────────
// 装備中の dice_bonus を全て合算。装備なしなら 0
// （同じ hand カテゴリのため通常は1つだが、将来の複数装備にも備えて合計方式）
function getEquipmentDiceBonus() {
  const equipped = getEquippedItems();
  let bonus = 0;
  EQUIPMENT_CATEGORIES.forEach(cat => {
    const item = equipped[cat];
    if (item && item.effect && item.effect.type === 'dice_bonus') {
      bonus += item.effect.value;
    }
  });
  return bonus;
}

// ── 装備効果: ペットの一言（comment）─────────────────────
// 装備中で effect.type === 'comment' のアイテムを探し { item, text } を返す
// 見つからなければ null（将来複数 comment でもまず最初の1つを返す方針）
function getEquipmentComment() {
  const equipped = getEquippedItems();
  for (const cat of EQUIPMENT_CATEGORIES) {
    const item = equipped[cat];
    if (item && item.effect && item.effect.type === 'comment') {
      return { item, text: item.effect.value };
    }
  }
  return null;
}

// ── 装備効果: 連続記録の保護（streak_protect）─────────────
// 装備中で effect.type === 'streak_protect' のアイテムを探し { item, value } を返す
// 見つからなければ null（将来複数 streak_protect でもまず最初の1つ）
function getEquipmentStreakProtect() {
  const equipped = getEquippedItems();
  for (const cat of EQUIPMENT_CATEGORIES) {
    const item = equipped[cat];
    if (item && item.effect && item.effect.type === 'streak_protect') {
      return { item, value: item.effect.value };
    }
  }
  return null;
}

function sgGetCellNum(pos) {
  if (pos <= 0) return 0;
  const r = pos % 100;
  return r === 0 ? 100 : r;
}
function sgGetStage(pos) {
  if (pos <= 0) return 1;
  return Math.ceil(pos / 100);
}

function rollDice(modeKey, mins, partial) {
  if (partial) {
    // 途中停止: 学習分数に応じて控えめに前進（完走時の最大出目より必ず1少なく）
    const fullMax = modeKey === 'deep' ? 5 : 3;
    const maxRoll = Math.min(1 + Math.floor(mins / 10), fullMax - 1);
    return Math.floor(Math.random() * maxRoll) + 1;
  }
  if (modeKey === 'pomodoro') return Math.floor(Math.random() * 3) + 1;
  if (modeKey === 'deep')     return Math.floor(Math.random() * 4) + 2;
  // flow: 1 to min(floor(mins/10), 10)
  const maxRoll = Math.min(Math.max(1, Math.floor(mins / 10)), 10);
  return Math.floor(Math.random() * maxRoll) + 1;
}

function sgPickItem(isRare) {
  const pool = SUGOROKU_ITEMS.filter(it => !!it.rare === isRare);
  return pool[Math.floor(Math.random() * pool.length)];
}

function doSugorokuRoll(modeKey, mins, partial) {
  // 基本出目 + 装備の dice_bonus を加算した最終出目で前進
  const baseDice  = rollDice(modeKey, mins, partial);
  const diceBonus = getEquipmentDiceBonus();
  const finalDice = baseDice + diceBonus;
  const roll = finalDice;            // 表示用に統一（既存の roll 参照との互換）
  const prevPos = sugorokuData.pos;
  const prevStage = sgGetStage(prevPos);
  const newPos = prevPos + finalDice;
  sugorokuData.pos = newPos;

  const newStage = sgGetStage(newPos);
  const stageCleared = newStage > prevStage;
  const cellNum = sgGetCellNum(newPos);
  const cellType = stageCleared ? 'goal' : BOARD_CELL_TYPES[cellNum] || 'normal';

  let bonusXP = 0, itemGained = null, message = '', evClass = 'ev-normal';

  if (stageCleared || cellType === 'goal') {
    bonusXP = 100;
    evClass = 'ev-goal';
    message = `🎊 ゴール！ステージ${prevStage}クリア！ ボーナス +${bonusXP} XP`;
    sugorokuData.stage = newStage;
  } else if (cellType === 'rare') {
    itemGained = sgPickItem(true);
    bonusXP = itemGained.xp;
    evClass = 'ev-rare';
    if (itemGained.type === 'equipment') {
      const granted = grantRandomEquipmentItem();
      if (granted) {
        showEquipmentGetModal(granted);  // 獲得演出モーダル
        message = `🎁 装備獲得：${granted.emoji} ${granted.name}！ (+${bonusXP} XP)`;
      } else {
        // 全装備所持済み → 代替ボーナスXPで補償
        addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
        message = `🎁 全装備を発見済み！装備発見 +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
      }
    } else {
      message = `⭐ レア！${itemGained.emoji}「${itemGained.name}」を獲得！ (+${bonusXP} XP)`;
      sugorokuData.items.push({ ...itemGained, pos: newPos, date: Date.now() });
    }
  } else if (cellType === 'item') {
    itemGained = sgPickItem(false);
    bonusXP = itemGained.xp;
    evClass = 'ev-item';
    if (itemGained.type === 'equipment') {
      const granted = grantRandomEquipmentItem();
      if (granted) {
        showEquipmentGetModal(granted);  // 獲得演出モーダル
        message = `🎁 装備獲得：${granted.emoji} ${granted.name}！ (+${bonusXP} XP)`;
      } else {
        // 全装備所持済み → 代替ボーナスXPで補償
        addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
        message = `🎁 全装備を発見済み！装備発見 +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
      }
    } else {
      message = `${itemGained.emoji}「${itemGained.name}」を獲得！ (+${bonusXP} XP)`;
      sugorokuData.items.push({ ...itemGained, pos: newPos, date: Date.now() });
    }
  } else if (cellType === 'event') {
    bonusXP = 20;
    evClass = 'ev-event';
    message = `✨ イベントマス！特別な学びの場。 ボーナス +${bonusXP} XP`;
  } else if (cellType === 'checkpoint') {
    bonusXP = 15;
    evClass = 'ev-checkpoint';
    message = `🏁 チェックポイント ${cellNum}マス！ ボーナス +${bonusXP} XP`;
  } else {
    bonusXP = 5;
    evClass = 'ev-normal';
    message = `順調に進んでいます！ +${bonusXP} XP`;
  }

  // 装備の dice_bonus が乗っている場合だけ出目の内訳を表示
  if (diceBonus > 0) {
    message = `🎲 出目 ${baseDice} + 装備ボーナス ${diceBonus} = ${finalDice}<br>` + message;
  }

  saveSugorokuData();
  sgPendingWalk = { fromPos: prevPos, rollTime: Date.now() };
  return { roll, prevPos, newPos, cellNum, cellType, bonusXP, message, evClass };
}

function addBonusXP(xp) {
  if (!xp || xp <= 0) return;
  const prev = data.level;
  data.xp += xp;
  while (data.xp >= xpForLevel(data.level)) {
    data.xp -= xpForLevel(data.level);
    data.level++;
  }
  if (data.level > prev) { lastLevelUp = true; checkAvatarEvolution(); }
  saveData(data); renderXP();
}

// ── すごろく歩行アニメーション ──────────────────────────
const WALK_DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };

// 将来 B/C スプライトを追加できるよう、ファイル名を変数で管理
const WALKER_SPRITES = { A: 'adventurer-a-walk.png' };
let walkerImgLoaded = false;
(function() {
  const _preload = new Image();
  _preload.onload  = () => { walkerImgLoaded = true; };
  _preload.onerror = () => { walkerImgLoaded = false; };
  _preload.src = WALKER_SPRITES.A;
}());

function sgMoveDir(fromN, toN) {
  const {x: x1, y: y1} = sgCellXY(fromN);
  const {x: x2, y: y2} = sgCellXY(toN);
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function getWalkerCellPos(n) {
  const svgEl = document.querySelector('#board-svg-wrapper svg');
  const wrapEl = document.getElementById('board-svg-wrapper');
  if (!svgEl || !wrapEl) return null;
  const svgRect  = svgEl.getBoundingClientRect();
  const wrapRect = wrapEl.getBoundingClientRect();
  const scale = svgRect.width / 400;
  const { x, y } = sgCellXY(n);
  return {
    left: (svgRect.left - wrapRect.left) + x * scale,
    top:  (svgRect.top  - wrapRect.top)  + y * scale,
    size: 36 * scale,
  };
}

async function startWalkAnimation(fromPos, toPos) {
  const walkerEl = document.getElementById('sg-walker');
  if (!walkerEl) { sgAnimating = false; return; }
  // スプライトファイルを動的にセット（将来 B/C スプライト追加時はここが切り替わる）
  walkerEl.style.backgroundImage = `url('${WALKER_SPRITES[avatarType] || WALKER_SPRITES.A}')`;

  const fromCellN = fromPos > 0 ? sgGetCellNum(fromPos) : 1;
  const toCellN   = sgGetCellNum(toPos);
  const fromStage = sgGetStage(fromPos > 0 ? fromPos : 1);
  const toStage   = sgGetStage(toPos);

  // 歩くセルのパスを構築
  const path = [];
  if (fromPos === 0) {
    for (let n = 1; n <= toCellN; n++) path.push(n);
  } else if (fromStage === toStage) {
    for (let n = fromCellN + 1; n <= toCellN; n++) path.push(n);
  } else {
    // ステージクリア: 100まで歩いてから1→toCellN
    for (let n = fromCellN + 1; n <= 100; n++) path.push(n);
    for (let n = 1; n <= toCellN; n++) path.push(n);
  }

  if (path.length === 0) { sgAnimating = false; renderBoard(); return; }

  const startP = getWalkerCellPos(fromPos > 0 ? fromCellN : 1);
  if (!startP) { sgAnimating = false; renderBoard(); return; }

  const sz = startP.size;
  walkerEl.style.width  = sz + 'px';
  walkerEl.style.height = sz + 'px';
  walkerEl.style.backgroundSize     = (sz * 4) + 'px ' + (sz * 4) + 'px';
  walkerEl.style.backgroundPosition = '0px 0px';
  walkerEl.style.left       = startP.left + 'px';
  walkerEl.style.top        = startP.top  + 'px';
  walkerEl.style.transition = 'none';
  walkerEl.style.display    = 'block';

  let prevN = fromPos > 0 ? fromCellN : 1;

  for (const nextN of path) {
    const dir        = sgMoveDir(prevN, nextN);
    const spriteRow  = WALK_DIR_ROW[dir];
    const nextP      = getWalkerCellPos(nextN);
    if (!nextP) break;

    // 次のマスへ移動（CSSトランジション）
    walkerEl.style.transition = 'left 0.38s linear, top 0.38s linear';
    walkerEl.style.left = nextP.left + 'px';
    walkerEl.style.top  = nextP.top  + 'px';

    // 移動中にフレームを切り替え（4コマ × 95ms = 380ms ≒ 1マス分）
    let frame = 1;
    const frameInt = setInterval(() => {
      walkerEl.style.backgroundPosition = `${-frame * sz}px ${-spriteRow * sz}px`;
      frame = (frame + 1) % 4;
    }, 95);

    await new Promise(r => setTimeout(r, 400));
    clearInterval(frameInt);
    prevN = nextN;
  }

  // 到着: 正面立ちポーズに戻す
  walkerEl.style.transition = 'none';
  walkerEl.style.backgroundPosition = '0px 0px';

  await new Promise(r => setTimeout(r, 280));

  sgAnimating = false;
  walkerEl.style.display = 'none';
  renderBoard(); // ドット絵アバターを表示して再描画
}

// ── SVG Board ─────────────────────────────────────────
function sgCellXY(n) {
  const CS = 36, STEP = 38, PAD = 11;
  const idx = n - 1;
  const row = Math.floor(idx / 10);
  const col = idx % 10;
  const isRtl = row % 2 === 1;
  const gx = isRtl ? (9 - col) : col;
  const gy = 9 - row;
  const x = PAD + gx * STEP, y = PAD + gy * STEP;
  return { x, y, cx: x + CS / 2, cy: y + CS / 2 };
}

function buildBoardSVG() {
  const CS = 36, PAD = 11, W = 400;
  const curCell = sgGetCellNum(sugorokuData.pos);
  const TYPE_BG = {
    normal:     'rgba(255,255,255,.05)',
    checkpoint: 'rgba(251,146,60,.14)',
    item:       'rgba(6,182,212,.1)',
    event:      'rgba(230,57,70,.1)',
    rare:       'rgba(251,191,36,.12)',
    goal:       'rgba(251,191,36,.2)',
  };
  const TYPE_STROKE = {
    normal:     'rgba(255,255,255,.1)',
    checkpoint: 'rgba(251,146,60,.4)',
    item:       'rgba(6,182,212,.3)',
    event:      'rgba(230,57,70,.3)',
    rare:       'rgba(251,191,36,.4)',
    goal:       '#fbbf24',
  };
  const TYPE_EMOJI = { checkpoint:'🏁', item:'📦', event:'✨', rare:'⭐', goal:'🏆' };

  let parts = ['<defs><style>.sg-pulse{animation:sgPulse 1.4s ease-in-out infinite}@keyframes sgPulse{0%,100%{opacity:.5}50%{opacity:1}}</style></defs>'];

  // Connection lines
  for (let n = 1; n <= 99; n++) {
    const a = sgCellXY(n), b = sgCellXY(n + 1);
    const passed = n < curCell;
    parts.push(`<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="${passed ? 'rgba(6,182,212,.35)' : 'rgba(255,255,255,.06)'}" stroke-width="2"/>`);
  }

  // Cells
  for (let n = 1; n <= 100; n++) {
    const { x, y, cx, cy } = sgCellXY(n);
    const type = BOARD_CELL_TYPES[n];
    const isCur = n === curCell && sugorokuData.pos > 0;
    const isPassed = n < curCell;
    const bg = isPassed ? 'rgba(255,255,255,.03)' : (TYPE_BG[type] || TYPE_BG.normal);
    const st = isCur ? '#06b6d4' : (isPassed ? 'rgba(255,255,255,.06)' : (TYPE_STROKE[type] || TYPE_STROKE.normal));
    const sw = isCur ? 1.5 : 1;
    parts.push(`<rect x="${x}" y="${y}" width="${CS}" height="${CS}" rx="6" fill="${bg}" stroke="${st}" stroke-width="${sw}"/>`);
    // Cell number
    const numOpacity = isPassed ? 0.25 : isCur ? 0 : 0.35;
    if (numOpacity > 0) {
      parts.push(`<text x="${x+CS-2}" y="${y+CS-2}" text-anchor="end" font-size="7" fill="rgba(232,232,240,${numOpacity})" font-family="sans-serif">${n}</text>`);
    }
    // Type emoji
    const em = TYPE_EMOJI[type];
    if (em && !isCur && !isPassed) {
      parts.push(`<text x="${cx}" y="${cy+1}" text-anchor="middle" dominant-baseline="central" font-size="13" opacity=".7">${em}</text>`);
    }
    // Current cell marker
    if (isCur) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${CS/2-1}" fill="rgba(6,182,212,.2)" stroke="#06b6d4" stroke-width="1.5" class="sg-pulse"/>`);
      if (!sgAnimating) {
        // 静止時: adventurer-a-walk.png の1コマ目（行0=下向き・列0）を表示
        // 画像未読み込みまたはタイプ A 以外の場合は従来のドット絵にフォールバック
        if (walkerImgLoaded && avatarType === 'A') {
          const spFile = WALKER_SPRITES.A;
          const clipId = `spClip${n}`;
          const sz4 = CS * 4; // 64px→CS にスケールするため画像全体を CS*4 で描画
          parts.push(`<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${CS}" height="${CS}"/></clipPath></defs>`);
          parts.push(`<image href="${spFile}" x="${x}" y="${y}" width="${sz4}" height="${sz4}" clip-path="url(#${clipId})" image-rendering="pixelated"/>`);
        } else {
          const _si = getAvatarStageIndex(data.level);
          const _av = buildAvatarSVG(_si, CS, CS);
          const _in = _av.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
          parts.push(`<svg x="${x}" y="${y}" width="${CS}" height="${CS}" viewBox="0 0 80 100" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet">${_in}</svg>`);
        }
      }
    }
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', W);
  svg.innerHTML = parts.join('');
  return svg;
}

function renderBoard() {
  const wrapper = document.getElementById('board-svg-wrapper');

  // アニメ開始判断（SVGを組む前に sgAnimating をセット）
  let animFromPos = null;
  if (sgPendingWalk && !sgAnimating && avatarType === 'A') {
    const { fromPos, rollTime } = sgPendingWalk;
    if (Date.now() - rollTime < 60000) {
      animFromPos = fromPos;
      sgAnimating = true; // ← ここでセットすることで buildBoardSVG がドット絵をスキップ
    }
    sgPendingWalk = null;
  } else if (sgPendingWalk) {
    sgPendingWalk = null; // タイプA以外はアニメなしで破棄
  }

  const old = wrapper.querySelector('svg');
  if (old) old.remove();
  wrapper.appendChild(buildBoardSVG());

  const stage = sgGetStage(sugorokuData.pos);
  const cell  = sgGetCellNum(sugorokuData.pos);
  document.getElementById('board-panel-sub').textContent =
    `ステージ ${stage}  ·  マス ${cell} / 100`;

  // Items list
  const title = document.getElementById('board-items-title');
  const list  = document.getElementById('board-items-list');
  if (sugorokuData.items.length === 0) {
    title.style.display = 'none';
    list.innerHTML = '';
  } else {
    title.style.display = '';
    list.innerHTML = sugorokuData.items.map(it =>
      `<div class="board-item-chip${it.rare ? ' is-rare' : ''}">
         ${it.emoji} ${it.name} <span class="board-item-pos">マス${it.pos}</span>
       </div>`
    ).join('');
  }

  // 歩行アニメーション起動
  if (animFromPos !== null) {
    setTimeout(() => startWalkAnimation(animFromPos, sugorokuData.pos), 180);
  }
}

function openBoardModal() {
  document.getElementById('board-overlay').classList.add('open');
  renderBoard();
}

// ── Koku dice animation ────────────────────────────────
function showSugorokuInKoku(result) {
  const { roll, newPos, cellNum, message, evClass } = result;
  const stage = sgGetStage(newPos);
  const kokuResult = document.getElementById('koku-result');
  const sec = document.createElement('div');
  sec.id = 'koku-sg-section';

  const ts    = Date.now();
  const diceId = 'ksd-' + ts;
  const statId = 'kss-' + ts;
  const evId   = 'kse-' + ts;
  const ctId   = 'ksc-' + ts;

  sec.innerHTML = `
    <div class="koku-sg-label">🎲 すごろく</div>
    <div class="koku-sg-dice-box spinning" id="${diceId}">?</div>
    <div class="koku-sg-status" id="${statId}">サイコロを振っています...</div>
    <div class="koku-sg-event ${evClass}" id="${evId}" style="display:none">${message}</div>
    <div class="koku-sg-pos" id="${evId}-pos" style="display:none">ステージ${stage} · マス ${sgGetCellNum(newPos)} / 100</div>
    <div class="koku-sg-countdown" id="${ctId}" style="display:none">タップして閉じる</div>
  `;
  kokuResult.appendChild(sec);

  const diceEl = document.getElementById(diceId);
  const statEl = document.getElementById(statId);
  const evEl   = document.getElementById(evId);
  const posEl  = document.getElementById(evId + '-pos');
  const ctEl   = document.getElementById(ctId);

  const FACES = ['1','2','3','4','5','6'];
  let fi = 0;
  _sgSpinInt = setInterval(() => { diceEl.textContent = FACES[fi++ % 6]; }, 110);

  _sgSpinT1 = setTimeout(() => {
    clearInterval(_sgSpinInt); _sgSpinInt = null;
    diceEl.textContent = roll > 6 ? String(roll) : FACES[roll - 1];
    diceEl.classList.remove('spinning');
    diceEl.classList.add('stopped');
    statEl.textContent = `${roll} が出ました！ ${roll}マス進みました`;
  }, 1700);

  _sgSpinT2 = setTimeout(() => {
    evEl.style.display = '';
    posEl.style.display = '';
    ctEl.style.display = '';
    ctEl.addEventListener('click', closeKoku);
    // 5秒カウントダウン後に自動クローズ
    let sec2 = 5;
    ctEl.textContent = `タップして閉じる (${sec2}秒)`;
    _sgAutoClose = setInterval(() => {
      sec2--;
      if (!document.getElementById('koku-overlay').className) { clearInterval(_sgAutoClose); _sgAutoClose = null; return; }
      if (sec2 <= 0) { clearInterval(_sgAutoClose); _sgAutoClose = null; closeKoku(); }
      else ctEl.textContent = `タップして閉じる (${sec2}秒)`;
    }, 1000);
  }, 2300);
}

// ═══════════════════════════════════════════════════════
//  SKILL TREE — DATA
// ═══════════════════════════════════════════════════════
const SKILL_THRESHOLDS = [
  { mins:   60, name: '集中力', emoji: '⚡', desc: '短時間の集中を積み重ねてきた証。焦らず、一歩ずつ進む力。' },
  { mins:  300, name: '持続力', emoji: '🔥', desc: '5時間の積み重ね。途切れることなく続けてきた情熱の炎。' },
  { mins:  600, name: '探究心', emoji: '🔍', desc: '10時間の深掘り。知ることへの純粋な好奇心が芽吹いている。' },
  { mins: 1200, name: '習熟',   emoji: '📚', desc: '20時間の鍛錬。このジャンルはもう、あなたの一部になりつつある。' },
  { mins: 3000, name: '達人',   emoji: '✨', desc: '50時間の極み。真の達人への扉がここに開かれた。' },
];

function loadSkillData() {
  try { return JSON.parse(localStorage.getItem('gq_skills') || '{}'); }
  catch { return {}; }
}
function saveSkillData() { localStorage.setItem('gq_skills', JSON.stringify(skillData)); }

let skillData = loadSkillData();
let pendingNewSkills = [];
let skillTreeAnimated = false;

// ═══════════════════════════════════════════════════════
//  XP / LEVEL
// ═══════════════════════════════════════════════════════
function xpForLevel(lv) { return lv * 100; }

function addXP(minutes) {
  const prevLevel = data.level;
  data.xp += minutes;
  data.totalMinutes += minutes;
  data.todayMinutes += minutes;

  // level-up loop
  while (data.xp >= xpForLevel(data.level)) {
    data.xp -= xpForLevel(data.level);
    data.level++;
  }
  lastLevelUp = (data.level > prevLevel);
  if (lastLevelUp) checkAvatarEvolution();
  saveData(data);
  renderXP();
  renderStats();
}

function renderXP() {
  const needed = xpForLevel(data.level);
  const pct = Math.round((data.xp / needed) * 100);
  document.getElementById('level-label').textContent = `Lv ${data.level}`;
  document.getElementById('xp-numbers').textContent = `${data.xp} / ${needed} XP`;
  document.getElementById('xp-bar').style.width = pct + '%';
  document.getElementById('total-time-label').textContent = `累計学習 ${data.totalMinutes}分`;
  renderSkillCount();
  renderConfidence();  // 自信ゲージも同時に更新
}

// ── 自信ゲージ（XPと独立、努力の積み上げを別軸で可視化）─────────
const CONFIDENCE_MESSAGES = {
  session_complete:   '自信が少し育ちました',
  session_5min:       '小さな一歩が、未来の自分を作ります',
  first_today:        '今日の始まり、よく動き出しましたね',
  resume_after_break: '戻ってきたことが、もう成長です',
  weekly_review:      '振り返りは、自信を確かなものにします',
  praise_log:         'これは未来の自信の証拠です',
};

let _confPending = { amount: 0, lastMsg: '', levelUp: 0 };
let _confFlushTimer = null;

// 自信ゲージを加算（reason は CONFIDENCE_MESSAGES のキー）
function addConfidence(amount, reason) {
  if (!amount || amount <= 0) return;
  const oldLevel = data.confidenceLevel || 1;
  data.confidence = (data.confidence || 0) + amount;
  while (data.confidence >= 100) {
    data.confidence -= 100;
    data.confidenceLevel = (data.confidenceLevel || 1) + 1;
  }
  saveData(data);
  renderConfidence();
  // トースト用に累積
  _confPending.amount += amount;
  if (CONFIDENCE_MESSAGES[reason]) _confPending.lastMsg = CONFIDENCE_MESSAGES[reason];
  if (data.confidenceLevel > oldLevel) _confPending.levelUp = data.confidenceLevel;
  // デバウンスでまとめて表示（同じセッション完了で複数回呼ばれても1つに集約）
  clearTimeout(_confFlushTimer);
  _confFlushTimer = setTimeout(_flushConfidenceToast, 120);
}

function _flushConfidenceToast() {
  if (_confPending.amount <= 0) return;
  const total = _confPending.amount;
  const msg   = _confPending.lastMsg || '自信が育ちました';
  const lvl   = _confPending.levelUp;
  _confPending = { amount: 0, lastMsg: '', levelUp: 0 };
  showConfidenceToast(total, msg);
  if (lvl) setTimeout(() => showConfidenceLevelUp(lvl), 1500);
}

function showConfidenceToast(amount, message) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `💪 +${amount} <span style="opacity:.85;font-weight:400">${message}</span>`;
  t.classList.remove('levelup');
  void t.offsetWidth;          // アニメ再生のため reflow
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function showConfidenceLevelUp(newLevel) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🎉 自信レベルアップ！ <strong>Lv ${newLevel}</strong>`;
  t.classList.add('show', 'levelup');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show', 'levelup'), 3500);
}

function renderConfidence() {
  const conf  = data.confidence || 0;
  const level = data.confidenceLevel || 1;
  const lbl = document.getElementById('confidence-label');
  const num = document.getElementById('confidence-numbers');
  const bar = document.getElementById('confidence-bar');
  if (lbl) lbl.textContent = `💪 自信 Lv ${level}`;
  if (num) num.textContent = `${conf} / 100`;
  if (bar) bar.style.width = Math.min(100, conf) + '%';
}

// ═══════════════════════════════════════════════════════
//  PRAISE LOG（今日の自分を褒める）
//  - localStorage: growthPraiseLogs = { "YYYY-MM-DD": [{ text, createdAt }] }
//  - セッション完了後に任意の入力モーダルを表示
//  - 保存時 confidence +2
// ═══════════════════════════════════════════════════════
function loadPraiseLogs() {
  try { return JSON.parse(localStorage.getItem('growthPraiseLogs') || '{}'); }
  catch { return {}; }
}
function savePraiseLogs() {
  localStorage.setItem('growthPraiseLogs', JSON.stringify(praiseLogs));
}
let praiseLogs = loadPraiseLogs();

// 1日1回だけの confidence 報酬を管理（褒めログ等の繰返し付与防止）
// localStorage: gq_confidence_rewards = { "praise_log": "YYYY-MM-DD", ... }
function loadConfidenceRewards() {
  try {
    const v = JSON.parse(localStorage.getItem('gq_confidence_rewards') || '{}');
    // 想定外データ（配列・文字列・null等）が入っていても安全に {} へ
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch {
    return {};
  }
}
function saveConfidenceRewards(rewards) {
  localStorage.setItem('gq_confidence_rewards', JSON.stringify(rewards));
}
// 同じ key × dateKey なら何もしない。新規発火なら addConfidence して true を返す
function addDailyConfidenceOnce(key, amount, reason, dateKey = todayKey()) {
  const rewards = loadConfidenceRewards();
  if (rewards[key] === dateKey) return false;
  rewards[key] = dateKey;
  saveConfidenceRewards(rewards);
  addConfidence(amount, reason);
  return true;
}

// 状態：セッション完了後に告→モーダルへ遷移させるためのフラグ
let _pendingPraisePrompt = false;
let _praiseSessionDate   = '';

function openPraiseModal(dateKey) {
  _praiseSessionDate = dateKey || todayKey();
  const ta = document.getElementById('praise-text');
  ta.value = '';
  updatePraiseCounter();
  document.getElementById('praise-save-btn').disabled = true;
  document.getElementById('praise-overlay').classList.add('open');
  setTimeout(() => ta.focus(), 240);
}
function closePraiseModal() {
  document.getElementById('praise-overlay').classList.remove('open');
}

function updatePraiseCounter() {
  const ta  = document.getElementById('praise-text');
  const cnt = document.getElementById('praise-counter');
  const len = (ta.value || '').length;
  if (cnt) cnt.textContent = `${len} / 200`;
  // 空欄では保存不可（前後空白も無効）
  document.getElementById('praise-save-btn').disabled = (ta.value.trim().length === 0);
}

function savePraise() {
  const btn  = document.getElementById('praise-save-btn');
  const text = (document.getElementById('praise-text').value || '').trim();
  // 空欄ガード ＋ 連打ガード（既に処理中なら無視）
  if (!text || btn.disabled) return;
  btn.disabled = true;

  const dateKey = _praiseSessionDate || todayKey();
  if (!praiseLogs[dateKey]) praiseLogs[dateKey] = [];
  praiseLogs[dateKey].push({
    text,
    createdAt: new Date().toISOString(),
  });
  savePraiseLogs();
  closePraiseModal();

  // 同一日では confidence +2 は1回のみ（複数件保存OKだが報酬は1回）
  const gained = addDailyConfidenceOnce('praise_log', 2, 'praise_log', dateKey);

  // デイリークエスト: 褒めログ自体は何件でも保存可、クエスト報酬は1日1回
  completeQuest('praise_self');

  // 加算ありはレベルアップ演出（addConfidenceから1.5s後発火・3.5s表示）を上書きしないよう
  // 5.6s 後に保存トーストを出す。加算なしは 1.8s 後に単独表示
  setTimeout(showPraiseSavedToast, gained ? 5600 : 1800);
}

function showPraiseSavedToast() {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `💛 今日の成長を記録しました<br>` +
                `<span style="opacity:.85;font-weight:400">これは未来の自信の証拠です</span>`;
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 3500);
}

// イベントリスナー
document.getElementById('praise-text').addEventListener('input', updatePraiseCounter);
document.getElementById('praise-save-btn').addEventListener('click', savePraise);
document.getElementById('praise-skip-btn').addEventListener('click', closePraiseModal);
document.getElementById('praise-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('praise-overlay')) closePraiseModal();
});
document.addEventListener('keydown', e => {
  const ov = document.getElementById('praise-overlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); closePraiseModal(); }
  else if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault(); savePraise();    // Cmd/Ctrl + Enter で保存
  }
});

// 指定週の褒めログをフラット化して返す: [{ dateKey, text, createdAt }, ...]
function getPraiseLogsForWeek(weekKey) {
  const dates = getWeekDates(weekKey).map(dkey);
  const out = [];
  dates.forEach(dk => {
    (praiseLogs[dk] || []).forEach(log => out.push({ dateKey: dk, ...log }));
  });
  return out;
}

// ═══════════════════════════════════════════════════════
//  DAILY QUEST（今日のクエスト）
//  - 小さな行動を肯定する3つの定義
//  - localStorage: gq_daily_quests = { "YYYY-MM-DD": { [questId]: true } }
//  - 報酬は同じ日付では1回だけ（XP・confidence ともに二重加算なし）
// ═══════════════════════════════════════════════════════
const DAILY_QUESTS = [
  { id:'start_5min',        label:'5分だけ始める',
    desc:'STARTを押した時点で、一歩前進',
    xp:5,  confidence:1 },
  { id:'complete_session',  label:'1セッションを終える',
    desc:'今日の学びに区切りをつけた証拠',
    xp:10, confidence:2 },
  { id:'praise_self',       label:'今日の自分を一言ほめる',
    desc:'未来の自信の証拠を残す',
    xp:5,  confidence:2 },
];

function loadDailyQuests() {
  try {
    const v = JSON.parse(localStorage.getItem('gq_daily_quests') || '{}');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch { return {}; }
}
function saveDailyQuests() {
  localStorage.setItem('gq_daily_quests', JSON.stringify(dailyQuests));
}
let dailyQuests = loadDailyQuests();

function isQuestDone(questId, dateKey) {
  const dk = dateKey || todayKey();
  const day = dailyQuests[dk];
  return !!(day && day[questId]);
}

// クエスト達成。同じ key × 日付では2回目以降は無視（XP/自信 二重加算防止）
function completeQuest(questId) {
  const today = todayKey();
  if (isQuestDone(questId, today)) return false;
  const quest = DAILY_QUESTS.find(q => q.id === questId);
  if (!quest) return false;
  // 達成状態を保存（XP・confidence加算の前に書き込み＝以後の同日呼び出しはガードされる）
  if (!dailyQuests[today] || typeof dailyQuests[today] !== 'object' || Array.isArray(dailyQuests[today])) {
    dailyQuests[today] = {};
  }
  dailyQuests[today][questId] = true;
  saveDailyQuests();
  // 報酬付与（既存パイプを再利用、時間統計には影響しない addBonusXP を使用）
  if (quest.xp > 0)         addBonusXP(quest.xp);
  if (quest.confidence > 0) addConfidence(quest.confidence, 'daily_quest');
  renderDailyQuests();
  setTimeout(() => showQuestDoneToast(quest), quest.confidence > 0 ? 3000 : 0);
  return true;
}

function renderDailyQuests() {
  const wrap = document.getElementById('quest-list');
  if (!wrap) return;
  const today = todayKey();
  const done  = dailyQuests[today] || {};
  wrap.innerHTML = DAILY_QUESTS.map(q => {
    const isDone = !!done[q.id];
    return `<div class="quest-item${isDone ? ' done' : ''}">
      <div class="quest-check">${isDone ? '✓' : '○'}</div>
      <div class="quest-body">
        <div class="quest-title">${q.label}</div>
        <div class="quest-desc">${q.desc}</div>
        <div class="quest-reward">${isDone ? '達成！' : '報酬'}：XP +${q.xp} / 自信 +${q.confidence}</div>
      </div>
    </div>`;
  }).join('');
}

function showQuestDoneToast(quest) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `📜 クエスト達成！<br>` +
                `<span style="opacity:.85;font-weight:400">${quest.label}</span>`;
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 2600);
}

// 起動時の初期描画（DOM 構築済みのスクリプト末尾実行を前提）
renderDailyQuests();

function renderStats() {
  document.getElementById('stat-sessions').textContent = data.sessions;
  document.getElementById('stat-today').textContent = data.todayMinutes;
  renderStreak();
}

function renderStreak() {
  const el = document.getElementById('stat-streak');
  const n = data.streak || 0;
  el.textContent = n;
  el.className = 'stat-val';
  if (n >= 30) el.classList.add('streak-rainbow');
  else if (n >= 7) el.classList.add('streak-red');
  else if (n >= 1) el.classList.add('streak-orange');

  const freeze = document.getElementById('stat-freeze');
  freeze.textContent = data.freezeItems > 0 ? `🧊×${data.freezeItems}` : '';
}

// daily init: streak + freeze grant
(function initDaily() {
  const today = todayKey();

  // 毎月1回フリーズアイテムを付与（最大3個）
  const ym = today.slice(0, 7);
  if (data.lastFreezeGrantYM !== ym) {
    data.lastFreezeGrantYM = ym;
    if (data.freezeItems < 3) data.freezeItems = Math.min(3, (data.freezeItems || 0) + 1);
  }

  if (data.lastDate && data.lastDate !== today) {
    data.todayMinutes = 0;
    updateStreak(today);
  }
  if (!data.lastDate || data.lastDate !== today) {
    data.lastDate = today;
    saveData(data);
  }
})();

function updateStreak(today) {
  const last = data.streakLastDate;
  if (!last) { return; }

  const msPerDay = 86400000;
  const lastMs = new Date(last).getTime();
  const todayMs = new Date(today).getTime();
  const diffDays = Math.round((todayMs - lastMs) / msPerDay);
  const prevStreak = data.streak || 0;   // ← 切れ検知のため事前値を保存

  if (diffDays === 1) {
    // 連続継続
    data.streak = (data.streak || 0) + 1;
  } else if (diffDays === 2 && data.freezeItems > 0) {
    // 1日空き → フリーズ消費（既存の優先処理）
    data.freezeItems--;
    data.freezeEverUsed = true;
    data.streak = (data.streak || 0) + 1;
  } else if (diffDays === 2 && data.freezeItems === 0) {
    // フリーズ尽きた → 装備の streak_protect で救えるか判定
    const protect = getEquipmentStreakProtect();
    if (protect && data.streakProtectUsedFor !== data.streakLastDate) {
      data.streakProtectUsedFor = data.streakLastDate;   // 同日二重発動を防ぐ
      data.streak = (data.streak || 0) + 1;
      // freezeEverUsed は変更しない（既存のバッジ条件を汚さない）
      console.log(`${protect.item.name}が連続記録を守った（${data.streakLastDate} → ${today}）`);
    } else {
      data.streak = 0;
    }
  } else if (diffDays > 1) {
    data.streak = 0;
  }

  // 連続が「切れた瞬間」を記録（次回のセッションで復帰ボーナス用）
  if (prevStreak > 0 && data.streak === 0) {
    data.streakWasBroken = true;
  }
}

// ═══════════════════════════════════════════════════════
//  TIMER STATE
// ═══════════════════════════════════════════════════════
let timerState = 'idle'; // idle | running | paused
let currentMode = settings.defaultMode;
let remaining = 0;
let elapsed = 0;
let intervalId = null;
let sessionMinutes = 0;
// wall-clock精度タイマー（バックグラウンド対応）
let timerStartWall  = null;  // 最後にstart/resumeした時刻
let timerPausedSec  = 0;     // 一時停止前の累計秒
let breakStartWall  = null;  // 休憩の開始時刻
let breakStartRemain = 0;    // 休憩の残り秒（開始時点）
let pipWin = null;           // Picture-in-Pictureウィンドウ

const timerDisplay = document.getElementById('timer-display');
const phaseLabel = document.getElementById('phase-label');
const startBtn = document.getElementById('start-btn');
const timeWrapper = document.getElementById('time-wrapper');
const breakBanner = document.getElementById('break-banner');
const breakTimerDisplay = document.getElementById('break-timer-display');

function fmtTime(sec) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── wall-clock ヘルパー ──────────────────────────────────
function getTimerElapsedSec() {
  if (!timerStartWall) return timerPausedSec;
  return timerPausedSec + Math.floor((Date.now() - timerStartWall) / 1000);
}
function getBreakRemainSec() {
  if (!breakStartWall) return breakStartRemain;
  return Math.max(0, breakStartRemain - Math.floor((Date.now() - breakStartWall) / 1000));
}

// ── タブタイトル ──────────────────────────────────────────
function updateTabTitle(t) { document.title = `(${t}) Growth Quest`; }
function resetTabTitle()    { document.title = 'Growth Quest'; }

// ── チャイム（Web Audio API） ───────────────────────────
function playChime() {
  if (!settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523.25,0],[659.25,.32],[783.99,.62]].forEach(([f,delay]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = f;
      const t0 = ctx.currentTime + delay;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.28, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.72);
      o.start(t0); o.stop(t0 + 0.75);
    });
  } catch(e) {}
}

// ── デスクトップ通知 ─────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  await Notification.requestPermission();
}
function showTimerNotif(title, body) {
  if (!settings.notif) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch(e) {}
}

// ── Picture-in-Picture ────────────────────────────────────
function updatePiP(t) {
  if (!pipWin || pipWin.closed) return;
  const el = pipWin.document.getElementById('pip-timer');
  if (el) el.textContent = t;
}
async function openPiP() {
  if (!window.documentPictureInPicture) return;
  try {
    pipWin = await window.documentPictureInPicture.requestWindow({ width:220, height:110 });
    const bd = pipWin.document.body;
    bd.style.cssText = 'margin:0;background:#0a0a0f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;';
    const lbl = pipWin.document.createElement('div');
    lbl.style.cssText = 'font-family:sans-serif;font-size:.6rem;color:rgba(255,255,255,.4);letter-spacing:.08em;';
    lbl.textContent = 'GROWTH QUEST';
    const disp = pipWin.document.createElement('div');
    disp.id = 'pip-timer';
    disp.style.cssText = 'font-family:monospace;font-size:2.8rem;font-weight:900;color:#06b6d4;font-variant-numeric:tabular-nums;';
    disp.textContent = timerDisplay.textContent;
    bd.appendChild(lbl); bd.appendChild(disp);
    pipWin.addEventListener('pagehide', () => { pipWin = null; });
  } catch(e) {}
}

function setTimerForMode(mode) {
  const cfg = MODES[mode];
  if (mode === 'flow') {
    remaining = 0; elapsed = 0;
    timerDisplay.textContent = '00:00';
    phaseLabel.textContent = 'フローモード';
  } else {
    remaining = cfg.focus * 60;
    timerDisplay.textContent = fmtTime(remaining);
    phaseLabel.textContent = '集中タイム';
  }
}

const stopBtn = document.getElementById('stop-btn');

function startTimer() {
  if (timerState === 'idle') {
    // ── START ──
    if (breakInterval) {
      clearInterval(breakInterval);
      breakInterval = null;
      breakBanner.classList.remove('visible');
    }
    sessionStartHour = new Date().getHours();
    timerStartWall = Date.now();
    timerPausedSec = 0;
    timerState = 'running';
    startBtn.textContent = '一時停止';
    startBtn.classList.add('running');
    stopBtn.style.display = 'inline-flex';
    sessionMinutes = 0;
    startAnim();
    intervalId = setInterval(tick, 1000);
    requestNotifPermission();
    // デイリークエスト: STARTを押した時点で1日1回達成
    completeQuest('start_5min');

  } else if (timerState === 'running') {
    // ── PAUSE ──
    timerPausedSec = getTimerElapsedSec();
    timerStartWall = null;
    clearInterval(intervalId);
    intervalId = null;
    timerState = 'paused';
    startBtn.textContent = '▶ 再開';
    startBtn.classList.remove('running');
    pauseAnim();

  } else if (timerState === 'paused') {
    // ── RESUME ──
    timerStartWall = Date.now();
    timerState = 'running';
    startBtn.textContent = '一時停止';
    startBtn.classList.add('running');
    resumeAnim();
    intervalId = setInterval(tick, 1000);
  }
}

function stopTimer() {
  // ── RESET ── (リセットボタン用)
  sessionMinutes = getTimerElapsedSec(); // 実経過秒を確定
  timerStartWall = null;
  timerPausedSec = 0;
  clearInterval(intervalId);
  intervalId = null;
  timerState = 'idle';
  startBtn.textContent = 'START';
  startBtn.classList.remove('running');
  stopBtn.style.display = 'none';
  document.getElementById('anim-stage').classList.remove('paused');
  stopAnim();
  resetTabTitle();
  updatePiP('--:--');

  // 1分以上経過していればXP付与（1分未満は何も起きなかった扱い＝告も出さない）
  const mins = Math.floor(sessionMinutes / 60);
  if (mins > 0) {
    // 自信ゲージ用フラグ：recordSessionCompletion 前に取得
    const _today = todayKey();
    const _isFirstToday      = !data.history[_today];
    const _isResumeFromBreak = !!data.streakWasBroken;
    if (currentMode === 'flow') data.sessions++;
    recordSessionCompletion(mins);
    addXP(mins);
    saveData(data);
    renderStats();
    checkBadges();
    const { newlyUnlocked: _sk } = checkSkillUnlocks();
    pendingNewSkills = _sk;

    // 装備の xp_mult を適用（baseXp = mins）。bonus分だけ別途加算
    const _eq = applyEquipmentXpBonus(mins);
    if (_eq.bonusXp > 0) addBonusXP(_eq.bonusXp);

    // 自信ゲージ加算（XPとは別軸）
    addConfidence(3, 'session_complete');
    if (mins >= 5)          addConfidence(1, 'session_5min');
    if (_isFirstToday)      addConfidence(2, 'first_today');
    if (_isResumeFromBreak) { addConfidence(5, 'resume_after_break'); data.streakWasBroken = false; saveData(data); }

    const cfg = MODES[currentMode];
    const _pc = getEquipmentComment();   // ペット装備のひとこと（null可）
    if (currentMode === 'flow') {
      // フローモードは自分で終えるのが「完了」→ 達成の告（すごろくも振る）
      const _sgResult = doSugorokuRoll(currentMode, mins);
      pendingSugorokuRoll = _sgResult;
      addBonusXP(_sgResult.bonusXP);
      playChime();
      showTimerNotif('セッション完了！', `${mins}分間、集中できました！`);
      showKoku(mins, cfg.break, 'complete', _eq.bonusXp, _pc);
    } else {
      // ポモドーロ/ディープを目標時間の前に手動停止 → 労いの告（控えめにすごろく前進）
      const _sgResult = doSugorokuRoll(currentMode, mins, true);
      pendingSugorokuRoll = _sgResult;
      addBonusXP(_sgResult.bonusXP);
      showKoku(mins, cfg.break, 'partial', _eq.bonusXp, _pc);
    }
    // デイリークエスト: 手動停止でも実質「セッションを終えた」とみなす（1日1回限定）
    completeQuest('complete_session');
    // 告が閉じたら「褒めログ入力」モーダルを案内
    _pendingPraisePrompt = true;
    _praiseSessionDate   = _today;
  }
  sessionMinutes = 0;
  setTimerForMode(currentMode);
}

stopBtn.addEventListener('click', stopTimer);

function tick() {
  const sec = getTimerElapsedSec();
  sessionMinutes = sec;

  if (currentMode === 'flow') {
    elapsed = sec;
    timerDisplay.textContent = fmtTime(elapsed);
    updateTabTitle(fmtTime(elapsed));
    updatePiP(fmtTime(elapsed));
    if (currentAnim === 'plant' && currentAnimController) {
      currentAnimController.updateProgress(Math.min(elapsed / 3600, 1.0));
    }
    return;
  }

  const total = MODES[currentMode].focus * 60;
  remaining = Math.max(0, total - sec);
  timerDisplay.textContent = fmtTime(remaining);
  updateTabTitle(fmtTime(remaining));
  updatePiP(fmtTime(remaining));

  if (currentAnim === 'water') {
    updateWaterFill((total - remaining) / total);
  }
  if (currentAnim === 'plant' && currentAnimController) {
    currentAnimController.updateProgress((total - remaining) / total);
  }

  if (remaining <= 0) {
    timerStartWall = null;
    timerPausedSec = 0;
    clearInterval(intervalId);
    intervalId = null;
    timerState = 'idle';
    startBtn.textContent = 'START';
    startBtn.classList.remove('running');
    stopBtn.style.display = 'none';
    stopAnim();
    resetTabTitle();
    updatePiP('00:00');
    completeSession();
  }
}

function recordSessionCompletion(mins) {
  if (mins <= 0) return;
  const today = todayKey();

  // 時間帯・モード別カウント
  if (sessionStartHour >= 6 && sessionStartHour < 9)  data.morningSessions = (data.morningSessions||0) + 1;
  if (sessionStartHour >= 22)                          data.nightSessions   = (data.nightSessions||0)   + 1;
  if (currentMode === 'flow')                          data.flowSessions    = (data.flowSessions||0)    + 1;

  // 学習履歴に記録
  data.history[today] = (data.history[today] || 0) + mins;

  // 詳細記録（セッション数・ジャンル別分数）
  if (!data.historyDetails) data.historyDetails = {};
  if (!data.historyDetails[today]) data.historyDetails[today] = { sessions: 0, genres: {} };
  data.historyDetails[today].sessions++;
  data.historyDetails[today].genres[currentGenreId] =
    (data.historyDetails[today].genres[currentGenreId] || 0) + mins;

  // ジャンルに加算
  const g = genres.find(x => x.id === currentGenreId);
  if (g) { g.xp = (g.xp || 0) + mins; g.minutes = (g.minutes || 0) + mins; saveGenres(); }

  // 時間帯記録（週次レビュー用）
  if (!data.historyDetails[today].hourMins) data.historyDetails[today].hourMins = {};
  data.historyDetails[today].hourMins[sessionStartHour] =
    (data.historyDetails[today].hourMins[sessionStartHour] || 0) + mins;

  // ストリーク更新（初回 or 今日が新しい日付）
  if (!data.streakLastDate) {
    data.streak = 1;
    data.streakLastDate = today;
  } else if (data.streakLastDate !== today) {
    updateStreak(today);
    data.streakLastDate = today;
  }
  lastStreakMilestone = [3,7,14,21,30,50,100].includes(data.streak);

  saveData(data);
  renderStreak();
  renderCalendar();
}

function completeSession() {
  const cfg = MODES[currentMode];
  const mins = cfg.focus || Math.floor(sessionMinutes / 60);
  data.sessions++;
  // 自信ゲージ用フラグ：recordSessionCompletion で値が変わる前に取得
  const _today = todayKey();
  const _isFirstToday      = !data.history[_today];
  const _isResumeFromBreak = !!data.streakWasBroken;
  recordSessionCompletion(mins);
  const { newlyUnlocked: _sk } = checkSkillUnlocks();
  pendingNewSkills = _sk;
  const _sgResult = doSugorokuRoll(currentMode, mins);
  pendingSugorokuRoll = _sgResult;
  addXP(mins); // also saves & renders
  // 装備の xp_mult を適用（baseXp = mins）。bonus分だけ別途加算
  const _eq = applyEquipmentXpBonus(mins);
  if (_eq.bonusXp > 0) addBonusXP(_eq.bonusXp);
  addBonusXP(_sgResult.bonusXP);
  // 自信ゲージ加算（XPとは別軸、デバウンスで1回のトーストに集約）
  addConfidence(3, 'session_complete');
  if (mins >= 5)             addConfidence(1, 'session_5min');
  if (_isFirstToday)         addConfidence(2, 'first_today');
  if (_isResumeFromBreak)    { addConfidence(5, 'resume_after_break'); data.streakWasBroken = false; saveData(data); }
  checkBadges();
  playChime();
  showTimerNotif('セッション完了！', `${mins}分間、集中できました！`);
  resetTabTitle();
  showKoku(mins, cfg.break, 'complete', _eq.bonusXp, getEquipmentComment());
  // デイリークエスト: セッション完了（1日1回限定）
  completeQuest('complete_session');
  // 告が閉じたら「褒めログ入力」モーダルを案内
  _pendingPraisePrompt = true;
  _praiseSessionDate   = _today;

  // break
  if (cfg.break > 0) {
    startBreak(cfg.break);
  } else {
    setTimerForMode(currentMode);
  }
}

// ═══════════════════════════════════════════════════════
//  BREAK
// ═══════════════════════════════════════════════════════
let breakRemaining = 0;
let breakInterval = null;

function startBreak(minutes) {
  breakStartRemain = minutes * 60;
  breakStartWall = Date.now();
  breakTimerDisplay.textContent = fmtTime(breakStartRemain);
  breakBanner.classList.add('visible');
  breakInterval = setInterval(() => {
    const rem = getBreakRemainSec();
    breakTimerDisplay.textContent = fmtTime(rem);
    if (rem <= 0) endBreak();
  }, 1000);
}

function endBreak() {
  clearInterval(breakInterval);
  breakInterval = null;
  breakStartWall = null;
  breakBanner.classList.remove('visible');
  showTimerNotif('休憩終了', '次のセッションを始めましょう！');
  setTimerForMode(currentMode);
}

document.getElementById('break-skip-btn').addEventListener('click', () => {
  clearInterval(breakInterval);
  breakInterval = null;
  breakStartWall = null;
  breakBanner.classList.remove('visible');
  setTimerForMode(currentMode);
});

// バックグラウンドから戻ったとき即座に表示を同期
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (timerState === 'running') tick();
  if (breakInterval) {
    const rem = getBreakRemainSec();
    breakTimerDisplay.textContent = fmtTime(rem);
    if (rem <= 0) endBreak();
  }
});

// ═══════════════════════════════════════════════════════
//  告 SYSTEM
// ═══════════════════════════════════════════════════════
function showKoku(mins, breakMins, kind, equipBonusXp, petComment) {
  // kind: 'complete'（完走）= 達成の告 / 'partial'（途中停止）= 労いの告
  // equipBonusXp: 装備の xp_mult による追加XP（0なら非表示）
  // petComment: { item, text } または null（pet装備のひとこと）
  kind = kind || 'complete';
  equipBonusXp = equipBonusXp || 0;
  const isPartial = kind === 'partial';
  const overlay = document.getElementById('koku-overlay');
  const result = document.getElementById('koku-result');
  const xpGained = mins;
  const genre = genres.find(x => x.id === currentGenreId);
  const genreLabel = genre ? `${genre.emoji} ${genre.name}` : '学習';
  const streakN = data.streak || 0;
  const streakMsg = streakN >= 2 ? `🔥 ${streakN}日連続達成！` : '';

  // 完走 / 途中停止で見出し・締めメッセージを出し分け
  const headline = isPartial
    ? `🌱 ${genreLabel} — ここまで`
    : `${genreLabel} — セッション完了`;
  const closingMsg = isPartial
    ? 'ここまで向き合えたね。途中でも、机に向かえた時間は確かな一歩。'
    : (breakMins > 0 ? `推奨：${breakMins}分の休憩` : '今日もお疲れ様！');

  // 装備ボーナス行（bonus > 0 のときだけ表示）
  const equipLine = equipBonusXp > 0
    ? `<span class="koku-equip-bonus">⚡ 装備ボーナス +${equipBonusXp} XP</span><br>`
    : '';

  // ペットのひとこと（装備中のみ表示）
  const petLine = petComment
    ? `<div class="koku-pet-comment">${renderItemIcon(petComment.item, 18)}<span>${petComment.item.name}：「${petComment.text}」</span></div>`
    : '';

  overlay.className = 'active style-' + settings.kokuStyle;

  result.innerHTML = `
    <span class="result-divider">────────────────</span>
    ${headline}<br>
    集中時間 ${mins}分 &nbsp;/&nbsp; 経験値 <strong>+${xpGained} XP</strong><br>
    ${equipLine}
    累計 ${data.totalMinutes}分<br>
    ${streakMsg ? streakMsg + '<br>' : ''}
    <span class="result-divider">────────────────</span>
    ${closingMsg}
    ${petLine}
  `;

  // 名言を選んで表示
  let qScene = 'session_complete';
  if (lastLevelUp) qScene = 'level_up';
  else if (lastStreakMilestone) qScene = 'streak_milestone';
  const q = pickQuote(qScene);
  currentKokuQuote = q;
  const qBox = document.getElementById('koku-quote-box');
  if (q) {
    document.getElementById('koku-quote-text').textContent = `「${q.text}」`;
    const meta = [q.author, q.source].filter(Boolean).join(' ・ ');
    document.getElementById('koku-quote-author').textContent = meta ? `— ${meta}` : '';
    updateKokuFavBtn();
    qBox.style.display = '';
  } else {
    qBox.style.display = 'none';
  }
  // アバター進化演出
  if (lastAvatarEvolution) {
    const si     = getAvatarStageIndex(data.level);
    const prevSi = Math.max(0, si - 1);
    const st     = AVATAR_STAGES[si];
    const evoDiv = document.createElement('div');
    evoDiv.id = 'koku-evo-section';
    evoDiv.innerHTML = `
      <div class="koku-evo-label" style="color:${st.c1}">✦ アバター進化 ✦</div>
      <div class="koku-evo-chars">
        <div style="opacity:.4">${buildAvatarSVG(prevSi, 44, 55)}</div>
        <div class="koku-evo-arrow">→</div>
        <div style="filter:drop-shadow(0 0 12px ${st.c1})">${buildAvatarSVG(si, 58, 72)}</div>
      </div>
      <div class="koku-evo-name" style="color:${st.c1}">「${st.title}」に進化しました！</div>
    `;
    result.appendChild(evoDiv);
    lastAvatarEvolution = false;
  }

  // スキル解放演出
  if (pendingNewSkills.length) {
    renderNewSkillsInKoku(pendingNewSkills);
    pendingNewSkills = [];
  }

  // すごろく演出
  if (pendingSugorokuRoll) {
    showSugorokuInKoku(pendingSugorokuRoll);
    pendingSugorokuRoll = null;
  }

  lastLevelUp = false;
  lastStreakMilestone = false;
}

function closeKoku() {
  const ov = document.getElementById('koku-overlay');
  if (!ov.className) return; // already closed
  ov.className = '';
  clearInterval(_sgSpinInt); clearInterval(_sgAutoClose);
  clearTimeout(_sgSpinT1); clearTimeout(_sgSpinT2);
  _sgSpinInt = _sgSpinT1 = _sgSpinT2 = _sgAutoClose = null;
  // セッション完了後に告を閉じたら、褒めログ入力モーダルを案内
  if (_pendingPraisePrompt) {
    _pendingPraisePrompt = false;
    setTimeout(() => openPraiseModal(_praiseSessionDate), 420);
  }
}

document.getElementById('koku-close-btn').addEventListener('click', closeKoku);
document.getElementById('koku-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('koku-overlay')) closeKoku();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('koku-overlay').className.includes('active'))
    closeKoku();
});

// ═══════════════════════════════════════════════════════
//  ANIMATIONS
// ═══════════════════════════════════════════════════════
const ANIMS = ['fire','plant','nebula','water','particle','gradient'];
let currentAnim = null;
let currentAnimController = null;

function pickAnim() {
  if (settings.anim !== 'random') return settings.anim;
  return ANIMS[Math.floor(Math.random() * ANIMS.length)];
}

function startAnim() {
  const type = pickAnim();
  currentAnim = type;
  const stage = document.getElementById('anim-stage');
  stage.innerHTML = '';
  stage.classList.remove('paused');
  if (type === 'particle') {
    currentAnimController = createParticleCanvas(stage);
  } else if (type === 'plant') {
    currentAnimController = createPlantCanvas(stage);
  } else {
    stage.innerHTML = buildAnimHTML(type);
    currentAnimController = null;
  }
}

function stopAnim() {
  if (currentAnimController) { currentAnimController.stop(); currentAnimController = null; }
  const stage = document.getElementById('anim-stage');
  stage.innerHTML = '';
  stage.classList.remove('paused');
  currentAnim = null;
}

function pauseAnim() {
  if (currentAnimController && currentAnimController.pause) {
    currentAnimController.pause();
  } else {
    document.getElementById('anim-stage').classList.add('paused');
  }
}

function resumeAnim() {
  if (currentAnimController && currentAnimController.resume) {
    currentAnimController.resume();
  } else {
    document.getElementById('anim-stage').classList.remove('paused');
  }
}

// ── CSS ベースのアニメーション HTML ─────────────────────
function buildAnimHTML(type) {
  switch (type) {
    case 'fire':     return buildFire();
    case 'nebula':   return buildNebula();
    case 'water':    return buildWater();
    case 'gradient': return `<div class="anim-gradient"></div>`;
  }
  return '';
}

function buildFire() {
  const embers = Array.from({length:8}, () => {
    const dx = (Math.random()*40-20).toFixed(0);
    const delay = (Math.random()*2).toFixed(1);
    const left = (30+Math.random()*40).toFixed(0);
    return `<div class="ember" style="left:${left}%;bottom:30px;--dx:${dx}px;animation-delay:${delay}s;animation-duration:${(1.5+Math.random()).toFixed(1)}s"></div>`;
  }).join('');
  return `<div class="anim-fire"><div class="flame flame-1"></div><div class="flame flame-2"></div><div class="flame flame-3"></div>${embers}</div>`;
}

function buildPlant() {
  const petals = Array.from({length:6}, (_,i) => {
    const rot = i * 60;
    return `<div class="petal" style="transform:rotate(${rot}deg) translateY(-100%) rotate(-${rot}deg);transform-origin:50% 100%;"></div>`;
  }).join('');
  return `<div class="anim-plant">
    <div class="plant-stem"></div>
    <div class="plant-leaf leaf-l" style="position:absolute;bottom:80px;left:calc(50% - 38px);animation-delay:.8s"></div>
    <div class="plant-leaf leaf-r" style="position:absolute;bottom:100px;left:calc(50% + 2px);animation-delay:1.2s"></div>
    <div class="plant-flower" style="top:20px">${petals}<div class="flower-center"></div></div>
  </div>`;
}

function buildNebula() {
  const stars = Array.from({length:30}, () => {
    const sz = (1+Math.random()*3).toFixed(1);
    const top = (Math.random()*100).toFixed(0);
    const left = (Math.random()*100).toFixed(0);
    const dur = (1.5+Math.random()*3).toFixed(1);
    const delay = (Math.random()*3).toFixed(1);
    return `<div class="nebula-star" style="width:${sz}px;height:${sz}px;top:${top}%;left:${left}%;--dur:${dur}s;animation-delay:${delay}s"></div>`;
  }).join('');
  return `<div class="anim-nebula"><div class="nebula-core"></div>${stars}</div>`;
}

function buildWater() {
  return `<div class="anim-water"><div class="vessel"><div class="water-fill" id="water-fill" style="height:5%"></div></div></div>`;
}

function updateWaterFill(pct) {
  const el = document.getElementById('water-fill');
  if (el) el.style.height = Math.min(95, 5 + pct * 90) + '%';
}

// ── E. パーティクル: Canvas + requestAnimationFrame ────────
function createParticleCanvas(stage) {
  const W = 220, H = 220, CX = 110, CY = 110;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
  stage.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const COLORS = ['#06b6d4','#e63946','#818cf8','#f4a261','#4ade80'];

  // 粒子の初期設定
  const particles = Array.from({length: 22}, (_, i) => ({
    angle:  (i / 22) * Math.PI * 2,
    radius: 18 + Math.random() * 76,
    speed:  (0.007 + Math.random() * 0.013) * (i % 3 === 0 ? -1 : 1),
    size:   2 + Math.random() * 4.5,
    color:  COLORS[i % COLORS.length],
    phase:  Math.random() * Math.PI * 2,
  }));

  let rafId = null;
  let running = true;

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    // 中心のグロー
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 26);
    g.addColorStop(0,   'rgba(6,182,212,0.95)');
    g.addColorStop(0.5, 'rgba(6,182,212,0.25)');
    g.addColorStop(1,   'rgba(6,182,212,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, 26, 0, Math.PI * 2);
    ctx.fill();

    // 粒子を描画
    particles.forEach(p => {
      p.angle += p.speed;
      const x = CX + Math.cos(p.angle) * p.radius;
      const y = CY + Math.sin(p.angle) * p.radius;
      const pulse = 0.5 + 0.5 * Math.sin(ts * 0.0018 + p.phase);
      const r = p.size * (0.75 + pulse * 0.5);

      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = r * 5;
      ctx.globalAlpha = 0.35 + pulse * 0.65;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (running) rafId = requestAnimationFrame(draw);
  }

  rafId = requestAnimationFrame(draw);

  return {
    pause()  { running = false; cancelAnimationFrame(rafId); rafId = null; },
    resume() { running = true;  rafId = requestAnimationFrame(draw); },
    stop()   { running = false; cancelAnimationFrame(rafId); rafId = null; },
  };
}

// ── B. 植物の成長: Canvas + requestAnimationFrame ─────────
function createPlantCanvas(stage) {
  const W = 220, H = 220;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const MAX = 80;
  const COLORS = ['#fbbf24','#f472b6','#e2e8f0','#a78bfa','#fb923c','#f87171','#34d399','#67e8f9'];

  // y昇順（奥から手前）にソートした固定座標リスト
  const SLOTS = Array.from({length: MAX}, () => ({
    x: 12 + Math.random() * 196,
    y: 172 + Math.random() * 36,
    layer: Math.random(),
  })).sort((a, b) => a.y - b.y);

  let flowers = [];
  let progress = 0;
  let running = true;
  let rafId = null;

  // 進行度 → 目標花の数（仕様に合わせたブレークポイント補間）
  function targetCount(p) {
    const bps = [[0,0],[0.03,0],[0.05,1],[0.20,3],[0.40,6],[0.60,14],[0.80,36],[1.0,MAX]];
    for (let i = 1; i < bps.length; i++) {
      if (p <= bps[i][0]) {
        const t = (p - bps[i-1][0]) / (bps[i][0] - bps[i-1][0]);
        return Math.round(bps[i-1][1] + t * (bps[i][1] - bps[i-1][1]));
      }
    }
    return MAX;
  }

  function spawnFlower() {
    const idx = flowers.length;
    if (idx >= SLOTS.length) return;
    const s = SLOTS[idx];
    flowers.push({
      x: s.x, baseY: s.y,
      type: Math.floor(Math.random() * 3),            // 0=5枚花 1=デイジー 2=チューリップ
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size:  5 + s.layer * 9 + Math.random() * 4,    // 奥=小, 手前=大
      stemH: 14 + s.layer * 42 + Math.random() * 28,
      birthTs: null,
      bloomMs: 1200 + Math.random() * 2000,           // 開花にかかる時間
      sp: Math.random() * Math.PI * 2,                // 風揺れ位相
      ss: 0.5 + Math.random() * 0.9,                  // 風揺れ速度
      sa: 0.5 + Math.random() * 1.8,                  // 風揺れ幅
    });
  }

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    // 地面
    ctx.fillStyle = 'rgba(12,18,4,0.4)';
    ctx.fillRect(0, H - 20, W, 20);
    const grd = ctx.createLinearGradient(0, H-40, 0, H-20);
    grd.addColorStop(0, 'transparent');
    grd.addColorStop(1, 'rgba(74,222,128,0.13)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H-40, W, 20);

    // 必要な数だけスポーン
    const tgt = Math.min(targetCount(progress), MAX);
    while (flowers.length < tgt) spawnFlower();

    // 奥から手前の順で描画
    const globalWind = Math.sin(ts * 0.00085);
    flowers.forEach(f => {
      if (f.birthTs === null) f.birthTs = ts;
      const bloom = Math.min((ts - f.birthTs) / f.bloomMs, 1.0);
      const sway = globalWind * f.sa * Math.sin(ts * 0.001 * f.ss + f.sp);
      drawFlower(f, bloom, sway);
    });

    if (running) rafId = requestAnimationFrame(draw);
  }

  function drawFlower(f, bloom, sway) {
    const stemProg  = Math.min(bloom * 1.7, 1.0);
    const petalProg = Math.max(0, (bloom - 0.42) / 0.58);
    // 開花時に少しふわっと膨らむ
    const bounce    = Math.max(0, Math.sin(Math.max(0, bloom - 0.85) / 0.15 * Math.PI)) * 0.12;
    const headScale = 0.25 + petalProg * 0.75 + bounce;

    ctx.save();
    ctx.translate(f.x, f.baseY);
    ctx.rotate(sway * Math.PI / 180);

    // 茎（二次ベジェで自然な曲がり）
    const topY = -f.stemH * stemProg;
    ctx.strokeStyle = `rgba(74,222,128,${0.55 + 0.45 * stemProg})`;
    ctx.lineWidth = Math.max(1.2, f.size * 0.10);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.35, topY * 0.52, 0, topY);
    ctx.stroke();

    // 葉（茎が50%伸びたら出現）
    if (stemProg > 0.5) {
      const lp = Math.min((stemProg - 0.5) / 0.38, 1.0);
      ctx.save();
      ctx.translate(0, topY * 0.52);
      ctx.scale(lp, lp);
      ctx.fillStyle = 'rgba(74,222,128,0.62)';
      ctx.beginPath();
      ctx.ellipse(f.size * 0.55, 0, f.size * 0.62, f.size * 0.22, -0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 花（茎が42%伸びたら咲き始める）
    if (petalProg > 0) {
      ctx.translate(0, topY);
      ctx.save();
      ctx.scale(headScale, headScale);
      if      (f.type === 0) drawSimpleFlower(ctx, f.size, f.color);
      else if (f.type === 1) drawDaisy(ctx, f.size, f.color);
      else                   drawTulip(ctx, f.size, f.color);
      ctx.restore();
    }

    ctx.restore();
  }

  // 型0: 5枚花
  function drawSimpleFlower(ctx, r, color) {
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2 - Math.PI / 2);
      ctx.fillStyle = color; ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.72, r * 0.36, r * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#fbbf24'; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.30, 0, Math.PI * 2); ctx.fill();
  }

  // 型1: デイジー（10枚花びら）
  function drawDaisy(ctx, r, color) {
    for (let i = 0; i < 10; i++) {
      ctx.save();
      ctx.rotate((i / 10) * Math.PI * 2);
      ctx.fillStyle = color; ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.62, r * 0.20, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#f97316'; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }

  // 型2: チューリップ（3枚花びら）
  function drawTulip(ctx, r, color) {
    const lighter = lightenHex(color, 0.3);
    [[color, -r*0.27, -0.32], [lighter, 0, 0], [color, r*0.27, 0.32]].forEach(([c, dx, a]) => {
      ctx.save();
      ctx.translate(dx, 0); ctx.rotate(a);
      ctx.fillStyle = c; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.60, r * 0.34, r * 0.70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function lightenHex(hex, t) {
    const r = parseInt(hex.slice(1,3),16),
          g = parseInt(hex.slice(3,5),16),
          b = parseInt(hex.slice(5,7),16);
    return `rgb(${(r+(255-r)*t)|0},${(g+(255-g)*t)|0},${(b+(255-b)*t)|0})`;
  }

  rafId = requestAnimationFrame(draw);

  return {
    updateProgress(p) { progress = Math.max(progress, p); }, // 進行は戻らない
    pause()  { running = false; cancelAnimationFrame(rafId); rafId = null; },
    resume() { running = true;  rafId = requestAnimationFrame(draw); },
    stop()   { running = false; cancelAnimationFrame(rafId); rafId = null; },
  };
}

// ═══════════════════════════════════════════════════════
//  MODE TABS
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (timerState === 'running' || timerState === 'paused') return;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMode = tab.dataset.mode;
    setTimerForMode(currentMode);
  });
});

startBtn.addEventListener('click', startTimer);

// PiP ボタン（ブラウザ対応時のみ表示）
(function() {
  const pipBtn = document.getElementById('pip-btn');
  if (window.documentPictureInPicture) {
    pipBtn.style.display = 'block';
    pipBtn.addEventListener('click', openPiP);
  }
})();

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function applySettings() {
  // hide time
  if (settings.hideTime) {
    timeWrapper.classList.add('hidden-mode');
  } else {
    timeWrapper.classList.remove('hidden-mode');
  }
  // set default mode tab
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  const dm = document.querySelector(`[data-mode="${settings.defaultMode}"]`);
  if (dm) dm.classList.add('active');
  currentMode = settings.defaultMode;
  setTimerForMode(currentMode);

  // sync UI
  document.getElementById('set-default-mode').value = settings.defaultMode;
  document.getElementById('set-koku-style').value = settings.kokuStyle;
  document.getElementById('set-hide-time').checked = settings.hideTime;
  document.getElementById('set-anim').value = settings.anim;
  document.getElementById('set-sound').checked = settings.sound !== false;
  document.getElementById('set-notif').checked  = settings.notif  !== false;
}

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-overlay').classList.add('open');
});
document.getElementById('settings-close-btn').addEventListener('click', () => {
  document.getElementById('settings-overlay').classList.remove('open');
});
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay'))
    document.getElementById('settings-overlay').classList.remove('open');
});

document.getElementById('set-default-mode').addEventListener('change', e => {
  settings.defaultMode = e.target.value;
  saveSettings(settings);
  applySettings();
});
document.getElementById('set-koku-style').addEventListener('change', e => {
  settings.kokuStyle = e.target.value;
  saveSettings(settings);
});
document.getElementById('set-hide-time').addEventListener('change', e => {
  settings.hideTime = e.target.checked;
  saveSettings(settings);
  applySettings();
});
document.getElementById('set-anim').addEventListener('change', e => {
  settings.anim = e.target.value;
  saveSettings(settings);
});
document.getElementById('set-sound').addEventListener('change', e => {
  settings.sound = e.target.checked;
  saveSettings(settings);
  if (e.target.checked) playChime(); // 試し鳴らし
});
document.getElementById('set-notif').addEventListener('change', async e => {
  settings.notif = e.target.checked;
  saveSettings(settings);
  if (e.target.checked) await requestNotifPermission();
});

// ═══════════════════════════════════════════════════════
//  GENRE SELECTOR
// ═══════════════════════════════════════════════════════
const EMOJI_OPTIONS = ['📖','✏️','🔬','🎵','🎨','💻','🏃','🍳','📐','🌍','💬','📊'];
const COLOR_OPTIONS = ['#06b6d4','#818cf8','#f97316','#e63946','#4ade80','#fbbf24','#a78bfa','#f472b6'];

let selectedEmoji = EMOJI_OPTIONS[0];
let selectedColor = COLOR_OPTIONS[0];

function renderGenreSelector() {
  const container = document.getElementById('genre-tabs');
  if (!genres.length) {
    container.innerHTML = `<span class="genre-empty">ジャンルがありません。<span class="genre-empty-link" onclick="openGenreModal()">追加する</span></span>`;
    return;
  }
  container.innerHTML = genres.map(g => `
    <button class="genre-tab ${g.id === currentGenreId ? 'active' : ''}"
      data-gid="${g.id}"
      style="${g.id === currentGenreId ? `border-color:${g.color};color:${g.color};background:${g.color}22` : ''}">
      ${g.emoji} ${g.name}
    </button>
  `).join('');
  container.querySelectorAll('.genre-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGenreId = btn.dataset.gid;
      renderGenreSelector();
    });
  });
}

// ═══════════════════════════════════════════════════════
//  GENRE MODAL
// ═══════════════════════════════════════════════════════
function openGenreModal() {
  document.getElementById('genre-overlay').classList.add('open');
  hideGenreForm();
  renderGenreList();
}

function renderGenreList() {
  const list = document.getElementById('genre-list');
  if (!genres.length) {
    list.innerHTML = `<p style="color:var(--text-dim);font-size:.82rem;padding:10px 0">ジャンルがありません</p>`;
    return;
  }
  list.innerHTML = genres.map(g => `
    <div class="genre-item-row">
      <div class="genre-item-emoji">${g.emoji}</div>
      <div class="genre-item-info">
        <div class="genre-item-name" style="color:${g.color}">${g.name}</div>
        <div class="genre-item-stats">${g.minutes || 0}分 &middot; ${g.xp || 0} XP</div>
      </div>
      <div class="genre-item-actions">
        <button class="genre-action-btn" data-edit="${g.id}">編集</button>
        ${genres.length > 1 ? `<button class="genre-action-btn del" data-del="${g.id}">削除</button>` : ''}
      </div>
    </div>
  `).join('');
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showGenreForm(btn.dataset.edit));
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      genres = genres.filter(x => x.id !== btn.dataset.del);
      if (currentGenreId === btn.dataset.del) currentGenreId = genres[0]?.id || '';
      saveGenres();
      renderGenreList();
      renderGenreSelector();
    });
  });
}

function showGenreForm(id) {
  editingGenreId = id || null;
  const form = document.getElementById('genre-form');
  form.style.display = 'block';

  const g = id ? genres.find(x => x.id === id) : null;
  document.getElementById('genre-form-title').textContent = id ? 'ジャンルを編集' : '新規ジャンル';
  document.getElementById('genre-name-input').value = g ? g.name : '';
  selectedEmoji = g ? g.emoji : EMOJI_OPTIONS[0];
  selectedColor = g ? g.color : COLOR_OPTIONS[0];

  // Emoji picker
  const ep = document.getElementById('emoji-picker');
  ep.innerHTML = EMOJI_OPTIONS.map(e =>
    `<button class="emoji-pick-btn ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`
  ).join('');
  ep.querySelectorAll('.emoji-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEmoji = btn.dataset.emoji;
      ep.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === selectedEmoji));
    });
  });

  // Color picker
  const cp = document.getElementById('color-picker');
  cp.innerHTML = COLOR_OPTIONS.map(c =>
    `<button class="color-pick-btn ${c === selectedColor ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
  cp.querySelectorAll('.color-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      cp.querySelectorAll('.color-pick-btn').forEach(b => b.classList.toggle('selected', b.dataset.color === selectedColor));
    });
  });
}

function hideGenreForm() {
  document.getElementById('genre-form').style.display = 'none';
  editingGenreId = null;
}

function saveGenreForm() {
  const name = document.getElementById('genre-name-input').value.trim();
  if (!name) { document.getElementById('genre-name-input').focus(); return; }

  if (editingGenreId) {
    const g = genres.find(x => x.id === editingGenreId);
    if (g) { g.name = name; g.emoji = selectedEmoji; g.color = selectedColor; }
  } else {
    genres.push({ id: Date.now().toString(36), name, emoji: selectedEmoji, color: selectedColor, xp: 0, minutes: 0 });
  }
  saveGenres();
  hideGenreForm();
  renderGenreList();
  renderGenreSelector();
  checkBadges();
}

// Genre modal event listeners
document.getElementById('genre-btn').addEventListener('click', openGenreModal);
document.getElementById('genre-close-btn').addEventListener('click', () => {
  document.getElementById('genre-overlay').classList.remove('open');
});
document.getElementById('genre-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('genre-overlay'))
    document.getElementById('genre-overlay').classList.remove('open');
});
document.getElementById('genre-add-btn').addEventListener('click', () => showGenreForm(null));
document.getElementById('genre-form-cancel').addEventListener('click', hideGenreForm);
document.getElementById('genre-form-save').addEventListener('click', saveGenreForm);

// ═══════════════════════════════════════════════════════
//  QUOTES SYSTEM
// ═══════════════════════════════════════════════════════
const QUOTE_CATS = {
  classic: '古典・偉人', modern: '現代の経営者', athlete: 'アスリート',
  artist: 'アーティスト', anime: 'アニメ・漫画', film: '映画・歌詞',
  proverb: 'ことわざ・格言', custom: 'マイ・コレクション',
};
const SCENE_LABELS = {
  morning:'朝', session_start:'集中前', session_complete:'達成',
  streak_milestone:'連続記録', level_up:'レベルアップ', comeback:'カムバック', night:'夜',
};

const QUOTES = [
  // 古典・偉人
  {id:'s0',  text:'千里の道も一歩から。',                                                         author:'老子',            source:'',            category:'classic',  scenes:['morning','session_start']},
  {id:'s1',  text:'学べば学ぶほど、自分が無知であることに気づく。',                              author:'アインシュタイン',  source:'',            category:'classic',  scenes:['night','session_complete']},
  {id:'s2',  text:'天才とは、1%のひらめきと99%の努力だ。',                                      author:'トーマス・エジソン', source:'',            category:'classic',  scenes:['session_start']},
  {id:'s3',  text:'最も偉大な栄光は、決して倒れないことではなく、倒れるたびに起き上がることだ。', author:'ネルソン・マンデラ', source:'',            category:'classic',  scenes:['comeback']},
  {id:'s4',  text:'人生に無駄な経験は一つもない。',                                              author:'ゲーテ',           source:'',            category:'classic',  scenes:['session_complete','night']},
  {id:'s5',  text:'知識に投資すれば、常に最大の利益が得られる。',                                author:'ベンジャミン・フランクリン', source:'',   category:'classic',  scenes:['morning','session_start']},
  // 現代の経営者
  {id:'s6',  text:'あなたの時間は限られている。だから他の誰かの人生を生きることで時間を無駄にするな。', author:'スティーブ・ジョブズ', source:'スタンフォード卒業式スピーチ', category:'modern', scenes:['morning','night']},
  {id:'s7',  text:'失敗しなかったことは、新しいことに挑戦しなかったということだ。',              author:'ジェフ・ベゾス',   source:'',            category:'modern',   scenes:['comeback','session_complete']},
  {id:'s8',  text:'一日一日を大切に生きることが、将来への最大の投資だ。',                        author:'稲盛和夫',         source:'',            category:'modern',   scenes:['morning','session_complete']},
  {id:'s9',  text:'準備が整うのを待つのではなく、今すぐ始めることだ。',                          author:'マーク・ザッカーバーグ', source:'',        category:'modern',   scenes:['session_start','morning']},
  {id:'s10', text:'夢を大きく持て。小さな夢には人を動かす力がない。',                            author:'松下幸之助',       source:'',            category:'modern',   scenes:['morning','level_up']},
  // アスリート
  {id:'s11', text:'不可能とは、現状に甘んじる人間の言葉だ。',                                   author:'モハメド・アリ',   source:'',            category:'athlete',  scenes:['session_start','comeback']},
  {id:'s12', text:'プレッシャーはチャンスだ。',                                                  author:'大谷翔平',         source:'',            category:'athlete',  scenes:['session_start']},
  {id:'s13', text:'今できることを全力でやる。それだけ。',                                        author:'イチロー',         source:'',            category:'athlete',  scenes:['session_start','morning']},
  {id:'s14', text:'諦めなければ必ず道は開ける。',                                                author:'松岡修造',         source:'',            category:'athlete',  scenes:['comeback','streak_milestone']},
  {id:'s15', text:'努力した者が全て報われるとは限らない。しかし、成功した者は皆すべからく努力している。', author:'王貞治', source:'',            category:'athlete',  scenes:['session_complete','night']},
  {id:'s16', text:'一番大切なのは、昨日の自分より今日の自分が成長していること。',                author:'内村航平',         source:'',            category:'athlete',  scenes:['morning','session_start']},
  // アーティスト
  {id:'s17', text:'創造とは、破壊することから始まる。',                                          author:'岡本太郎',         source:'',            category:'artist',   scenes:['session_start','morning']},
  {id:'s18', text:'芸術は爆発だ！',                                                               author:'岡本太郎',         source:'',            category:'artist',   scenes:['session_start','level_up']},
  {id:'s19', text:'想像力は知識よりも大切だ。知識には限界があるが、想像力は世界を包む。',        author:'アインシュタイン',  source:'',            category:'artist',   scenes:['morning','session_start']},
  {id:'s20', text:'人生そのものが最高の芸術作品だ。',                                            author:'オスカー・ワイルド', source:'',           category:'artist',   scenes:['night','session_complete']},
  {id:'s21', text:'美しいものを見るためには、美しい目が必要だ。',                                author:'ロダン',           source:'',            category:'artist',   scenes:['night','morning']},
  // アニメ・漫画
  {id:'s22', text:'諦めたら、そこで試合終了ですよ。',                                            author:'安西先生',         source:'スラムダンク', category:'anime',    scenes:['comeback','session_start']},
  {id:'s23', text:'海賊王に、俺はなる！',                                                         author:'モンキー・D・ルフィ', source:'ONE PIECE', category:'anime',    scenes:['session_start','morning']},
  {id:'s24', text:'自分を信じろ。お前は強い。',                                                  author:'ロック・リー',     source:'NARUTO',      category:'anime',    scenes:['session_start','comeback']},
  {id:'s25', text:'限界を超えろ！PLUS ULTRA！',                                                  author:'オールマイト',     source:'僕のヒーローアカデミア', category:'anime', scenes:['session_start','level_up']},
  {id:'s26', text:'前を向け。未来は必ずそこにある。',                                            author:'竈門炭治郎',       source:'鬼滅の刃',    category:'anime',    scenes:['morning','comeback']},
  {id:'s27', text:'オレたちの旅はまだ終わらない！',                                              author:'千空',             source:'Dr.STONE',    category:'anime',    scenes:['session_complete','streak_milestone']},
  {id:'s28', text:'走れ！進め！前に進み続けることだ！',                                          author:'エレン・イェーガー', source:'進撃の巨人', category:'anime',    scenes:['session_start']},
  // 映画・歌詞
  {id:'s29', text:'人生はチョコレートの箱。開けてみるまで何が入っているかわからない。',          author:'フォレスト・ガンプ', source:'フォレスト・ガンプ', category:'film', scenes:['morning']},
  {id:'s30', text:'Do, or do not. There is no try.',                                              author:'ヨーダ',           source:'スター・ウォーズ', category:'film', scenes:['session_start']},
  {id:'s31', text:'夢を持ち続ける勇気があれば、夢は必ず叶う。',                                  author:'ウォルト・ディズニー', source:'',           category:'film',     scenes:['morning','level_up']},
  {id:'s32', text:'変われない人間はいない。ただ変わろうとしていないだけだ。',                    author:'',                 source:'',            category:'film',     scenes:['comeback']},
  {id:'s33', text:'どんな夜も必ず朝が来る。',                                                    author:'',                 source:'',            category:'film',     scenes:['night','morning']},
  {id:'s34', text:'生きることへの最大の冒険は、自分の夢の通りに生きることだ。',                  author:'オプラ・ウィンフリー', source:'',           category:'film',     scenes:['night','session_complete']},
  // ことわざ・格言
  {id:'s35', text:'継続は力なり。',                                                               author:'',                 source:'',            category:'proverb',  scenes:['morning','streak_milestone','session_complete']},
  {id:'s36', text:'七転び八起き。',                                                               author:'',                 source:'日本のことわざ', category:'proverb', scenes:['comeback']},
  {id:'s37', text:'石の上にも三年。',                                                             author:'',                 source:'日本のことわざ', category:'proverb', scenes:['streak_milestone','session_complete']},
  {id:'s38', text:'急がば回れ。',                                                                 author:'',                 source:'日本のことわざ', category:'proverb', scenes:['session_start']},
  {id:'s39', text:'塵も積もれば山となる。',                                                       author:'',                 source:'日本のことわざ', category:'proverb', scenes:['streak_milestone','morning']},
  {id:'s40', text:'初志貫徹。',                                                                   author:'',                 source:'日本の格言',  category:'proverb',  scenes:['session_start','streak_milestone']},
  {id:'s41', text:'知は力なり。',                                                                 author:'フランシス・ベーコン', source:'',           category:'proverb',  scenes:['night','session_start']},
];

// ── ストレージ ─────────────────────────────────────────
function loadUserWords() {
  try { return JSON.parse(localStorage.getItem('gq_words') || '[]'); } catch { return []; }
}
function saveUserWords() { localStorage.setItem('gq_words', JSON.stringify(userWords)); }
function loadFavIds() {
  try { return new Set(JSON.parse(localStorage.getItem('gq_words_favs') || '[]')); } catch { return new Set(); }
}
function saveFavIds() { localStorage.setItem('gq_words_favs', JSON.stringify([...favIds])); }
function loadShownHist() {
  try { return JSON.parse(localStorage.getItem('gq_words_hist') || '{}'); } catch { return {}; }
}
function saveShownHist() { localStorage.setItem('gq_words_hist', JSON.stringify(shownHist)); }

let userWords  = loadUserWords();
let favIds     = loadFavIds();
let shownHist  = loadShownHist();
let lastLevelUp         = false;
let lastStreakMilestone = false;
let lastAvatarEvolution = false;
let currentKokuQuote    = null;
let currentDailyQuote   = null;

// ── コアロジック ──────────────────────────────────────
function pickQuote(scene) {
  const WEEK = 7 * 86400000;
  const now  = Date.now();
  const all  = [...QUOTES, ...userWords];
  const cands = all.filter(q => q.scenes && q.scenes.includes(scene));
  if (!cands.length) return null;
  const fresh = cands.filter(q => (now - (shownHist[q.id] || 0)) > WEEK);
  const pool  = fresh.length ? fresh : cands;
  const q     = pool[Math.floor(Math.random() * pool.length)];
  shownHist[q.id] = now;
  saveShownHist();
  return q;
}

function detectDailyScene() {
  const h = new Date().getHours();
  const today = todayKey();
  if (data.streakLastDate && data.streakLastDate !== today) {
    const diff = Math.round((new Date(today) - new Date(data.streakLastDate)) / 86400000);
    if (diff >= 2) return 'comeback';
  }
  if (h >= 22) return 'night';
  if (h < 10)  return 'morning';
  return 'session_start';
}

const SCENE_TAG_LABELS = {
  morning:'☀ 朝の一言', night:'🌙 夜の一言', comeback:'👋 おかえり！',
  session_start:'⚡ 今日の一言', session_complete:'🎉 セッション達成',
  streak_milestone:'🔥 記録更新', level_up:'✨ レベルアップ',
};

function renderDailyQuote() {
  const scene = detectDailyScene();
  const q = pickQuote(scene);
  currentDailyQuote = q;
  if (!q) { document.getElementById('daily-quote-card').style.display = 'none'; return; }
  document.getElementById('daily-quote-card').style.display = '';
  document.getElementById('dq-scene-tag').textContent = SCENE_TAG_LABELS[scene] || '今日の一言';
  document.getElementById('dq-text').textContent = `「${q.text}」`;
  const meta = [q.author, q.source].filter(Boolean).join(' ・ ');
  document.getElementById('dq-author').textContent = meta ? `— ${meta}` : '';
  updateDQFavBtn();
}

function updateDQFavBtn() {
  if (!currentDailyQuote) return;
  const isFav = favIds.has(currentDailyQuote.id);
  const btn = document.getElementById('dq-fav-btn');
  btn.textContent = isFav ? '♥' : '♡';
  btn.classList.toggle('fav-active', isFav);
}

function updateKokuFavBtn() {
  if (!currentKokuQuote) return;
  const isFav = favIds.has(currentKokuQuote.id);
  const btn = document.getElementById('koku-fav-btn');
  btn.textContent = isFav ? '♥ お気に入り済み' : '♡ お気に入り';
  btn.classList.toggle('fav-active', isFav);
}

function toggleFav(quoteId) {
  if (favIds.has(quoteId)) favIds.delete(quoteId);
  else                      favIds.add(quoteId);
  saveFavIds();
}

function copyQuoteToClipboard(q) {
  if (!q) return;
  const text = q.author ? `「${q.text}」— ${q.author}` : `「${q.text}」`;
  navigator.clipboard?.writeText(text).catch(() => {});
}

// Daily quote buttons
document.getElementById('dq-fav-btn').addEventListener('click', () => {
  if (!currentDailyQuote) return;
  toggleFav(currentDailyQuote.id);
  updateDQFavBtn();
  if (document.getElementById('words-overlay').classList.contains('open')) renderWordsList();
});
document.getElementById('dq-share-btn').addEventListener('click', () => {
  copyQuoteToClipboard(currentDailyQuote);
  const btn = document.getElementById('dq-share-btn');
  btn.textContent = '✓ コピー済み'; setTimeout(() => { btn.textContent = '📤 コピー'; }, 1800);
});
document.getElementById('dq-refresh-btn').addEventListener('click', () => {
  const scene = detectDailyScene();
  const q = pickQuote(scene);
  if (!q) return;
  currentDailyQuote = q;
  document.getElementById('dq-text').textContent = `「${q.text}」`;
  const meta = [q.author, q.source].filter(Boolean).join(' ・ ');
  document.getElementById('dq-author').textContent = meta ? `— ${meta}` : '';
  updateDQFavBtn();
});

// Koku quote buttons
document.getElementById('koku-fav-btn').addEventListener('click', () => {
  if (!currentKokuQuote) return;
  toggleFav(currentKokuQuote.id);
  updateKokuFavBtn();
});
document.getElementById('koku-share-btn').addEventListener('click', () => {
  copyQuoteToClipboard(currentKokuQuote);
  const btn = document.getElementById('koku-share-btn');
  btn.textContent = '✓ コピー済み'; setTimeout(() => { btn.textContent = '📤 コピー'; }, 1800);
});

// ── Words Collection モーダル ──────────────────────────
let wordsFilter   = 'all';
let wordsSearch   = '';
let editingWordId = null;
let selectedScenes = new Set(['session_start']);

const ALL_SCENES = ['morning','session_start','session_complete','streak_milestone','level_up','comeback','night'];

function openWordsModal() {
  document.getElementById('words-overlay').classList.add('open');
  hideWordsForm();
  renderWordsList();
}

function renderWordsList() {
  const all = [...QUOTES, ...userWords];
  const q = wordsSearch.trim().toLowerCase();
  const items = all.filter(w => {
    if (wordsFilter === 'favs'   && !favIds.has(w.id)) return false;
    if (wordsFilter === 'custom' && !userWords.find(u => u.id === w.id)) return false;
    if (q && !w.text.toLowerCase().includes(q) &&
        !(w.author||'').toLowerCase().includes(q)) return false;
    return true;
  });

  const list = document.getElementById('words-list');
  if (!items.length) {
    list.innerHTML = `<div class="words-empty">該当する言葉がありません</div>`; return;
  }
  const isUser = id => !!userWords.find(u => u.id === id);
  list.innerHTML = items.map(w => {
    const isFav   = favIds.has(w.id);
    const cat     = QUOTE_CATS[w.category] || w.category;
    const meta    = [w.author, w.source].filter(Boolean).join(' ・ ');
    const canDel  = isUser(w.id);
    return `<div class="word-card">
      <div class="word-card-text">「${w.text}」</div>
      <div class="word-card-meta">
        <span class="word-card-cat">${cat}</span>
        ${meta}
      </div>
      <div class="word-card-acts">
        <button class="wc-act-btn ${isFav ? 'fav-active' : ''}" data-fav="${w.id}">${isFav ? '♥' : '♡'}</button>
        ${canDel ? `<button class="wc-act-btn del" data-del="${w.id}">削除</button>` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleFav(btn.dataset.fav);
      renderWordsList();
      updateDQFavBtn();
      updateKokuFavBtn();
    });
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      userWords = userWords.filter(u => u.id !== btn.dataset.del);
      favIds.delete(btn.dataset.del);
      saveUserWords(); saveFavIds();
      renderWordsList();
    });
  });
}

function showWordsForm() {
  editingWordId = null;
  document.getElementById('words-form-title').textContent = '新しい言葉';
  document.getElementById('words-text-input').value = '';
  document.getElementById('words-author-input').value = '';
  document.getElementById('words-source-input').value = '';
  selectedScenes = new Set(['session_start']);
  renderScenePicks();
  document.getElementById('words-add-form').style.display = 'block';
  document.getElementById('words-add-btn').style.display = 'none';
}

function hideWordsForm() {
  document.getElementById('words-add-form').style.display = 'none';
  document.getElementById('words-add-btn').style.display = '';
}

function renderScenePicks() {
  const container = document.getElementById('words-scene-picks');
  container.innerHTML = ALL_SCENES.map(s =>
    `<button class="words-scene-chip ${selectedScenes.has(s) ? 'selected' : ''}" data-sc="${s}">${SCENE_LABELS[s]}</button>`
  ).join('');
  container.querySelectorAll('.words-scene-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (selectedScenes.has(btn.dataset.sc)) selectedScenes.delete(btn.dataset.sc);
      else                                     selectedScenes.add(btn.dataset.sc);
      btn.classList.toggle('selected', selectedScenes.has(btn.dataset.sc));
    });
  });
}

function saveWordsForm() {
  const text = document.getElementById('words-text-input').value.trim();
  if (!text) { document.getElementById('words-text-input').focus(); return; }
  const newWord = {
    id:       'usr_' + Date.now().toString(36),
    text,
    author:   document.getElementById('words-author-input').value.trim(),
    source:   document.getElementById('words-source-input').value.trim(),
    category: 'custom',
    scenes:   [...selectedScenes],
  };
  userWords.push(newWord);
  saveUserWords();
  hideWordsForm();
  renderWordsList();
}

// Words modal events
document.getElementById('words-btn').addEventListener('click', openWordsModal);
document.getElementById('words-close-btn').addEventListener('click', () =>
  document.getElementById('words-overlay').classList.remove('open'));
document.getElementById('words-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('words-overlay'))
    document.getElementById('words-overlay').classList.remove('open');
});
document.getElementById('words-add-btn').addEventListener('click', showWordsForm);
document.getElementById('words-form-cancel').addEventListener('click', hideWordsForm);
document.getElementById('words-form-save').addEventListener('click', saveWordsForm);
document.getElementById('words-search').addEventListener('input', e => {
  wordsSearch = e.target.value; renderWordsList();
});
document.querySelectorAll('[data-wf]').forEach(btn => {
  btn.addEventListener('click', () => {
    wordsFilter = btn.dataset.wf;
    document.querySelectorAll('[data-wf]').forEach(b => b.classList.toggle('active', b.dataset.wf === wordsFilter));
    renderWordsList();
  });
});

// ═══════════════════════════════════════════════════════
//  BADGES & ACHIEVEMENTS
// ═══════════════════════════════════════════════════════
const RARITY_LABELS = { common:'よくある', rare:'レア', epic:'エピック', legendary:'伝説' };
const CAT_LABELS    = { start:'始まり系', streak:'継続系', total:'累計系', special:'特別系' };

function checkPerfectWeek() {
  const tod = new Date(); tod.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(tod); d.setDate(tod.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!((data.history[k]||0) > 0)) return false;
  }
  return true;
}

const BADGES = [
  // 始まり系 ─ common
  { id:'b1',  name:'最初の一歩',           desc:'初めてのセッションを完了',        icon:'🌱', cat:'start',  rarity:'common',    check:()=> data.sessions >= 1 },
  { id:'b2',  name:'朝活マスター',         desc:'朝6〜9時に5回セッション完了',     icon:'🌅', cat:'start',  rarity:'common',    check:()=> (data.morningSessions||0) >= 5 },
  { id:'b3',  name:'夜更かしの賢者',       desc:'22時以降に5回セッション完了',     icon:'🌙', cat:'start',  rarity:'common',    check:()=> (data.nightSessions||0) >= 5 },
  { id:'b4',  name:'ジャンルチャレンジャー', desc:'3つ以上のジャンルを登録',       icon:'🎯', cat:'start',  rarity:'common',    check:()=> genres.length >= 3 },
  { id:'b5',  name:'フローの達人',         desc:'フローモードを10回完了',          icon:'🌊', cat:'start',  rarity:'common',    check:()=> (data.flowSessions||0) >= 10 },
  // 継続系
  { id:'b6',  name:'習慣化の入口',         desc:'3日間連続で学習',                icon:'🔥', cat:'streak', rarity:'common',    check:()=> (data.streak||0) >= 3 },
  { id:'b7',  name:'7日の壁突破',          desc:'7日間連続で学習',                icon:'💪', cat:'streak', rarity:'rare',      check:()=> (data.streak||0) >= 7 },
  { id:'b8',  name:'鬼の継続力',           desc:'30日間連続で学習',               icon:'👹', cat:'streak', rarity:'epic',      check:()=> (data.streak||0) >= 30 },
  { id:'b9',  name:'100日の覚悟',          desc:'100日間連続で学習',              icon:'💎', cat:'streak', rarity:'legendary', check:()=> (data.streak||0) >= 100 },
  { id:'b10', name:'不死鳥',               desc:'凍結アイテムを初めて使用',        icon:'🦅', cat:'streak', rarity:'rare',      check:()=> data.freezeEverUsed === true },
  // 累計系
  { id:'b11', name:'集中の探求者',         desc:'累計10時間学習',                 icon:'🔍', cat:'total',  rarity:'common',    check:()=> (data.totalMinutes||0) >= 600 },
  { id:'b12', name:'学びの旅人',           desc:'累計50時間学習',                 icon:'🎒', cat:'total',  rarity:'rare',      check:()=> (data.totalMinutes||0) >= 3000 },
  { id:'b13', name:'知識の蓄積者',         desc:'累計100時間学習',                icon:'📚', cat:'total',  rarity:'epic',      check:()=> (data.totalMinutes||0) >= 6000 },
  { id:'b14', name:'学習の覇者',           desc:'累計200時間学習',                icon:'🏆', cat:'total',  rarity:'legendary', check:()=> (data.totalMinutes||0) >= 12000 },
  { id:'b15', name:'セッション職人',       desc:'50セッション達成',               icon:'🎓', cat:'total',  rarity:'rare',      check:()=> (data.sessions||0) >= 50 },
  // 特別系
  { id:'b16', name:'レベル10突破',         desc:'レベル10に到達',                 icon:'✨', cat:'special', rarity:'rare',     check:()=> (data.level||1) >= 10 },
  { id:'b17', name:'言葉コレクター',       desc:'名言を10個お気に入りに登録',      icon:'💌', cat:'special', rarity:'common',   check:()=> favIds.size >= 10 },
  { id:'b18', name:'ジャンルマスター',     desc:'1ジャンルで100分以上学習',        icon:'🔬', cat:'special', rarity:'rare',     check:()=> genres.some(g => (g.minutes||0) >= 100) },
  { id:'b19', name:'完璧な週',             desc:'7日間全て学習記録あり',           icon:'🌟', cat:'special', rarity:'epic',     check:()=> checkPerfectWeek() },
  { id:'b20', name:'伝説の探求者',         desc:'Lv5 & 7日連続 & 累計5時間達成',  icon:'🔮', cat:'special', rarity:'legendary', check:()=> (data.level||1)>=5 && (data.streak||0)>=7 && (data.totalMinutes||0)>=300 },
];

// ── Storage ─────────────────────────────────────────────
function loadBadgeData() {
  try { return JSON.parse(localStorage.getItem('gq_badges') || '{}'); } catch { return {}; }
}
function saveBadgeData() { localStorage.setItem('gq_badges', JSON.stringify(earnedBadges)); }

let earnedBadges = loadBadgeData();
let sessionStartHour = new Date().getHours();
let badgesFilter = 'all';
const badgeQueue = [];
let badgeToastActive = false;

// ── Core ────────────────────────────────────────────────
function checkBadges() {
  const newlyEarned = [];
  BADGES.forEach(badge => {
    if (earnedBadges[badge.id]) return;
    try {
      if (badge.check()) {
        earnedBadges[badge.id] = Date.now();
        newlyEarned.push(badge);
      }
    } catch(_) {}
  });
  if (newlyEarned.length) {
    saveBadgeData();
    newlyEarned.forEach(b => badgeQueue.push(b));
    if (!badgeToastActive) showNextBadgeToast();
    if (document.getElementById('badges-overlay').classList.contains('open')) renderBadgeGrid();
  }
  return newlyEarned;
}

// ── Toast queue ─────────────────────────────────────────
function showNextBadgeToast() {
  if (!badgeQueue.length) { badgeToastActive = false; return; }
  badgeToastActive = true;
  const b = badgeQueue.shift();
  const toast = document.getElementById('badge-toast');
  document.getElementById('badge-toast-emoji').textContent = b.icon;
  document.getElementById('badge-toast-name').textContent  = b.name;
  const rEl = document.getElementById('badge-toast-rarity');
  rEl.textContent  = RARITY_LABELS[b.rarity];
  rEl.className    = `badge-toast-rarity badge-${b.rarity}`;
  toast.className  = `badge-toast badge-${b.rarity} show`;
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextBadgeToast, 450);
  }, 3200);
}

// ── Modal ───────────────────────────────────────────────
function openBadgesModal() {
  document.getElementById('badges-overlay').classList.add('open');
  renderBadgeGrid();
}

function renderBadgeGrid() {
  const earned = Object.keys(earnedBadges).length;
  document.getElementById('badges-earned-count').textContent = earned;

  const items = BADGES.filter(b => {
    if (badgesFilter === 'earned') return !!earnedBadges[b.id];
    if (badgesFilter === 'locked') return !earnedBadges[b.id];
    return true;
  });

  const grid = document.getElementById('badge-grid');
  grid.innerHTML = items.map(b => {
    const isEarned = !!earnedBadges[b.id];
    const earnedTs = earnedBadges[b.id];
    const dateStr  = earnedTs ? new Date(earnedTs).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric'}) + ' 獲得' : '';
    return `<div class="badge-card ${isEarned ? 'earned' : 'locked'} badge-${b.rarity}" title="${b.desc}">
      ${!isEarned ? '<span class="badge-lock-icon">🔒</span>' : ''}
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${isEarned ? b.name : b.name}</div>
      <div class="badge-rarity-tag badge-${b.rarity}">${RARITY_LABELS[b.rarity]}</div>
      <div class="badge-desc">${b.desc}</div>
      ${dateStr ? `<div class="badge-earned-date">${dateStr}</div>` : ''}
    </div>`;
  }).join('');
}

document.getElementById('badges-btn').addEventListener('click', openBadgesModal);
document.getElementById('badges-close-btn').addEventListener('click', () =>
  document.getElementById('badges-overlay').classList.remove('open'));
document.getElementById('badges-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('badges-overlay'))
    document.getElementById('badges-overlay').classList.remove('open');
});
document.querySelectorAll('[data-bf]').forEach(btn => {
  btn.addEventListener('click', () => {
    badgesFilter = btn.dataset.bf;
    document.querySelectorAll('[data-bf]').forEach(b => b.classList.toggle('active', b.dataset.bf === badgesFilter));
    renderBadgeGrid();
  });
});

// ═══════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

function dkey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function renderCalendar() {
  const y = calYear, m = calMonth;
  document.getElementById('cal-title').textContent = `${y}年${m + 1}月`;

  const firstDow    = new Date(y, m, 1).getDay();     // 0=日
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr    = todayKey();
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);

  // セルを構築（前月末尾 + 当月 + 翌月先頭で7の倍数に）
  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push(new Date(y, m, -i));
  for (let d = 1; d <= daysInMonth; d++)  cells.push(new Date(y, m, d));
  let nd = 1;
  while (cells.length % 7 !== 0) cells.push(new Date(y, m + 1, nd++));

  // 当月の学習済みキーセット（連続ライン判定用）
  const studiedSet = new Set();
  cells.forEach((date, idx) => {
    const mo = date.getMonth();
    if (mo !== ((m % 12 + 12) % 12)) return; // other-month
    if (date > todayStart) return;
    const k = dkey(date);
    if (data.history[k]) studiedSet.add(k);
  });

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = cells.map((date, idx) => {
    const isThisMonth = (date.getMonth() === ((m % 12 + 12) % 12) &&
                         date.getFullYear() === (m < 0 ? y - 1 : m > 11 ? y + 1 : y));
    const k       = dkey(date);
    const mins    = data.history[k] || 0;
    const isToday = k === todayStr;
    const isFuture = date > todayStart;
    const dow     = date.getDay();

    if (!isThisMonth) {
      return `<div class="cal-cell other-month ${dow===0?'sun':dow===6?'sat':''}">
                <span class="cal-day-num">${date.getDate()}</span>
              </div>`;
    }

    // スタンプ
    let stampHTML = '';
    if (mins > 0 && !isFuture) {
      let lv, sym;
      if      (mins >= 120) { lv = 4; sym = '✨'; }
      else if (mins >= 60)  { lv = 3; sym = '🌸'; }
      else if (mins >= 30)  { lv = 2; sym = '★'; }
      else                  { lv = 1; sym = '●'; }
      stampHTML = `<div class="cal-stamp stamp-lv${lv}">${sym}<span class="cal-mins">${mins}分</span></div>`;
    }

    // 連続ライン（右隣が同月&学習済み）
    let streakRight = false;
    if (!isFuture && studiedSet.has(k) && idx % 7 < 6) {
      const nextDate = cells[idx + 1];
      if (nextDate && dkey(nextDate) !== k) {
        const nk = dkey(nextDate);
        if (studiedSet.has(nk)) streakRight = true;
      }
    }

    const cls = ['cal-cell',
      isToday     ? 'today'   : '',
      isFuture    ? 'future'  : '',
      mins > 0 && !isFuture ? 'studied' : '',
      streakRight ? 'streak-right' : '',
      dow === 0   ? 'sun'     : '',
      dow === 6   ? 'sat'     : '',
    ].filter(Boolean).join(' ');

    const attr = !isFuture ? `data-date="${k}"` : '';
    return `<div class="${cls}" ${attr}>
              <span class="cal-day-num">${date.getDate()}</span>
              ${stampHTML}
            </div>`;
  }).join('');

  // クリックイベント
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => showDayPopup(cell.dataset.date, cell));
  });

  renderCalStats(y, m);
}

function renderCalStats(y, m) {
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let totalMins = 0, studyDays = 0, bestMins = 0, bestDate = '';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    if (date > todayStart) break;
    const k = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const mins = data.history[k] || 0;
    if (mins > 0) {
      totalMins += mins;
      studyDays++;
      if (mins > bestMins) { bestMins = mins; bestDate = `${m+1}月${d}日`; }
    }
  }

  const el = document.getElementById('cal-stats');
  el.innerHTML = `
    <div class="cal-stat-item">学習日数: <strong>${studyDays}日</strong></div>
    <div class="cal-stat-item">総学習時間: <strong>${totalMins}分</strong></div>
    ${bestDate ? `<div class="cal-stat-item">ベスト: <strong>${bestDate}（${bestMins}分）</strong></div>` : ''}
  `;
}

function showDayPopup(dateKey, cellEl) {
  const popup = document.getElementById('cal-day-popup');
  const mins  = data.history[dateKey] || 0;
  const det   = data.historyDetails?.[dateKey];

  const [y, mo, d] = dateKey.split('-');
  document.getElementById('cdp-date').textContent = `${y}年${parseInt(mo)}月${parseInt(d)}日`;
  document.getElementById('cdp-mins').innerHTML = mins
    ? `学習時間: <strong>${mins}分</strong>` : '学習記録なし';
  document.getElementById('cdp-sessions').innerHTML = det
    ? `セッション: <strong>${det.sessions}回</strong>` : '';

  let genreHTML = '';
  if (det?.genres) {
    genreHTML = Object.entries(det.genres).map(([gid, gMins]) => {
      const g = genres.find(x => x.id === gid);
      return g ? `<span class="cdp-genre-tag">${g.emoji} ${g.name} ${gMins}分</span>` : '';
    }).join('');
  }
  document.getElementById('cdp-genres').innerHTML = genreHTML;

  // ─ その日の褒めログを表示 ─
  const praiseEl = document.getElementById('cdp-praise');
  if (praiseEl) {
    const logs = praiseLogs[dateKey] || [];
    if (logs.length > 0) {
      praiseEl.innerHTML = `<div class="cdp-praise-title">💛 今日の褒めログ</div>` +
        logs.map(l => `<div class="cdp-praise-item">「${escHtml(l.text)}」</div>`).join('');
    } else {
      praiseEl.innerHTML = '';
    }
  }

  // ポップアップ位置調整（高さは実測してはみ出し回避）
  popup.classList.remove('hidden');
  const PW = 250;
  const PH = popup.offsetHeight || 140;
  const rect = cellEl.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - PW / 2;
  let top  = rect.bottom + 8;
  if (left < 8) left = 8;
  if (left + PW > window.innerWidth - 8) left = window.innerWidth - PW - 8;
  if (top + PH > window.innerHeight - 8) top = rect.top - PH - 8;

  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
}

document.getElementById('cdp-close-btn').addEventListener('click', () => {
  document.getElementById('cal-day-popup').classList.add('hidden');
});
document.addEventListener('click', e => {
  const popup = document.getElementById('cal-day-popup');
  if (!popup.classList.contains('hidden') &&
      !popup.contains(e.target) && !e.target.closest('.cal-cell')) {
    popup.classList.add('hidden');
  }
});
document.getElementById('cal-prev-btn').addEventListener('click', () => {
  calMonth--; if (calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar();
});
document.getElementById('cal-next-btn').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar();
});
document.getElementById('cal-today-btn').addEventListener('click', () => {
  calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); renderCalendar();
});

// ═══════════════════════════════════════════════════════
//  WEEKLY REVIEW SYSTEM
// ═══════════════════════════════════════════════════════

const DOW_LABELS = ['月','火','水','木','金','土','日'];
const DOW_FULL   = ['月曜','火曜','水曜','木曜','金曜','土曜','日曜'];

// ── 週ユーティリティ ─────────────────────────────────────
function getWeekMonday(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  const m = getWeekMonday(date);
  return dkey(m);
}

function getWeekDates(weekKey) {
  const mon = new Date(weekKey + 'T00:00:00');
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function dowIndex(date) {
  // Mon=0 … Sun=6
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function fmtMins(m) {
  if (m >= 60) return `${Math.floor(m/60)}h${m%60 ? m%60+'m' : ''}`;
  return `${m}分`;
}

// ── ストレージ ────────────────────────────────────────────
function loadReviews()       { try { return JSON.parse(localStorage.getItem('gq_reviews') || '{}');  } catch { return {}; } }
function saveReviews()       { localStorage.setItem('gq_reviews', JSON.stringify(weeklyReviews)); }
function loadReviewStatus()  { try { return JSON.parse(localStorage.getItem('gq_rv_status') || '{"skips":0}'); } catch { return {skips:0}; } }
function saveReviewStatus()  { localStorage.setItem('gq_rv_status', JSON.stringify(reviewStatus)); }

let weeklyReviews    = loadReviews();
let reviewStatus     = loadReviewStatus();
let rvWeekKey        = '';       // 現在開いている週
let rvGoalMins       = 0;
let rvGoalBadge      = '';
let rvViewMode       = 'current'; // 'current' | 'past'

// ── 分析 ─────────────────────────────────────────────────
function analyzeWeek(weekKey) {
  const dates     = getWeekDates(weekKey);
  const days      = dates.map(d => ({
    date: d, key: dkey(d),
    mins: data.history[dkey(d)] || 0,
    det:  data.historyDetails?.[dkey(d)] || null,
  }));
  const totalMins = days.reduce((s, d) => s + d.mins, 0);
  const studyDays = days.filter(d => d.mins > 0).length;
  const sessions  = days.reduce((s, d) => s + (d.det?.sessions || 0), 0);
  const bestDay   = days.reduce((b, d) => d.mins > b.mins ? d : b, days[0]);

  const genreMins = {};
  days.forEach(d => {
    if (!d.det?.genres) return;
    Object.entries(d.det.genres).forEach(([gid, m]) => {
      genreMins[gid] = (genreMins[gid] || 0) + m;
    });
  });

  const slots = { morning:0, afternoon:0, evening:0, night:0 };
  let hasHour = false;
  days.forEach(d => {
    if (!d.det?.hourMins) return;
    hasHour = true;
    Object.entries(d.det.hourMins).forEach(([h, m]) => {
      const hr = parseInt(h);
      if      (hr >= 5  && hr < 11) slots.morning   += m;
      else if (hr >= 11 && hr < 17) slots.afternoon += m;
      else if (hr >= 17 && hr < 22) slots.evening   += m;
      else                           slots.night     += m;
    });
  });

  return { days, totalMins, studyDays, sessions, bestDay, genreMins, slots, hasHour };
}

function getPrevWeekGenres(weekKey) {
  const mon = new Date(weekKey + 'T00:00:00');
  mon.setDate(mon.getDate() - 7);
  return analyzeWeek(dkey(mon)).genreMins;
}

function getNewBadgesThisWeek(weekKey) {
  const dates  = getWeekDates(weekKey);
  const start  = dates[0].getTime();
  const end    = new Date(dates[6]); end.setHours(23,59,59,999);
  return BADGES.filter(b => {
    const ts = earnedBadges[b.id];
    return ts && ts >= start && ts <= end.getTime();
  });
}

function buildSuggestions(an, weekKey) {
  const { days, totalMins, bestDay, slots, hasHour } = an;
  const sugs = [];

  if (totalMins === 0) {
    sugs.push(['🌱', '今週は学習記録がありませんでした。来週はまず1分でも記録してみましょう！']);
    return sugs;
  }

  // ゼロ日の指摘（2日以上あれば）
  const zeroDays = days.filter(d => d.mins === 0);
  if (zeroDays.length >= 2) {
    const names = zeroDays.slice(0,2).map(d => DOW_FULL[dowIndex(d.date)]);
    sugs.push(['📅', `${names.join('・')}の学習がゼロでした。来週は少しだけでも記録すると連続性が生まれます。`]);
  }

  // ベスト曜日の活用
  if (bestDay.mins > 0) {
    sugs.push(['💪', `${DOW_FULL[dowIndex(bestDay.date)]}（${bestDay.mins}分）が今週のベストでした。来週もその曜日を大切にしましょう。`]);
  }

  // 時間帯タイプ
  if (hasHour) {
    const slotMap = { morning:'朝型🌅', afternoon:'昼型☀', evening:'夕型🌆', night:'夜型🌙' };
    const best = Object.entries(slots).reduce((b,[k,v])=>v>b.v?{k,v}:b,{k:'',v:-1});
    if (best.v > 0) sugs.push(['⏰', `${slotMap[best.k]}のあなた。来週も同じ時間帯に習慣化すると、より深い集中が期待できます。`]);
  }

  // 累計達成
  if (totalMins >= 300) {
    sugs.push(['🏆', `今週は${fmtMins(totalMins)}、素晴らしい集中力でした！この勢いをキープしていきましょう。`]);
  } else if (totalMins >= 60) {
    sugs.push(['🔥', `今週は${fmtMins(totalMins)}の学習でした。来週は少しだけ上を目指してみましょう！`]);
  }

  return sugs.slice(0, 3);
}

// ── UI ───────────────────────────────────────────────────
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setReviewDot(show) {
  const btn = document.getElementById('review-btn');
  if (!btn) return;
  const dot = btn.querySelector('.review-notif-dot');
  if (show && !dot) { const d=document.createElement('div'); d.className='review-notif-dot'; btn.appendChild(d); }
  else if (!show && dot) dot.remove();
}

function openReviewModal(wk) {
  rvWeekKey   = wk;
  rvGoalMins  = weeklyReviews[wk]?.goal?.targetMins  || 0;
  rvGoalBadge = weeklyReviews[wk]?.goal?.targetBadge || '';
  rvViewMode  = 'current';

  const dates = getWeekDates(wk);
  document.getElementById('review-week-label').textContent =
    `${dates[0].getMonth()+1}/${dates[0].getDate()}（月）〜 ${dates[6].getMonth()+1}/${dates[6].getDate()}（日）`;

  renderReviewFooter(false);
  renderReviewBody();
  document.getElementById('review-overlay').classList.add('open');
  setReviewDot(false);
}

function renderReviewFooter(isPast) {
  const footer = document.getElementById('review-footer');
  if (isPast) {
    footer.innerHTML = `<button class="review-btn-secondary" id="review-back-btn">← 今週の振り返りに戻る</button>`;
    document.getElementById('review-back-btn').addEventListener('click', () => openReviewModal(rvWeekKey));
  } else {
    const isExisting = !!weeklyReviews[rvWeekKey];
    footer.innerHTML = `
      <button class="review-btn-secondary" id="review-skip-btn">後で見る</button>
      <button class="review-btn-primary"   id="review-save-btn">${isExisting ? '更新して閉じる' : '保存して完了'}</button>
    `;
    document.getElementById('review-skip-btn').addEventListener('click', skipReview);
    document.getElementById('review-save-btn').addEventListener('click', saveAndCloseReview);
  }
}

function renderReviewBody() {
  const body = document.getElementById('review-body');
  const an   = analyzeWeek(rvWeekKey);
  const prev = getPrevWeekGenres(rvWeekKey);
  const newBadges = getNewBadgesThisWeek(rvWeekKey);
  const sugs = buildSuggestions(an, rvWeekKey);
  const saved = weeklyReviews[rvWeekKey] || {};
  const quote = pickQuote('morning');
  const { days, totalMins, studyDays, sessions, bestDay, genreMins, slots, hasHour } = an;

  let html = '';

  // ─ Section 1: サマリー ───────────────────────────────
  html += `<div class="review-section">
    <div class="review-section-title">今週のサマリー</div>`;

  if (totalMins === 0) {
    html += `<div style="color:var(--text-dim);font-size:.83rem;padding:8px 0;text-align:center;line-height:1.8">
      今週の学習記録がまだありません。<br>少しデータが溜まると分析できます 📈
    </div>`;
  } else {
    html += `<div class="review-stats-grid">
      <div class="review-stat"><div class="review-stat-val">${fmtMins(totalMins)}</div><div class="review-stat-lbl">総学習時間</div></div>
      <div class="review-stat"><div class="review-stat-val">${sessions}</div><div class="review-stat-lbl">セッション数</div></div>
      <div class="review-stat"><div class="review-stat-val">${studyDays}/7</div><div class="review-stat-lbl">学習日数</div></div>
    </div>`;
    if (bestDay.mins > 0) {
      html += `<div class="review-best-day">🏆 ベスト集中日: <strong>${DOW_FULL[dowIndex(bestDay.date)]}（${bestDay.mins}分）</strong></div>`;
    }
    html += `<div style="font-size:.77rem;color:var(--text-dim);margin-top:8px">🔥 現在の連続記録: <strong style="color:${data.streak>=7?'var(--red)':'var(--gold)'}">${data.streak}日</strong></div>`;
    if (newBadges.length) {
      html += `<div style="font-size:.68rem;color:var(--text-dim);margin-top:10px;margin-bottom:4px">今週獲得したバッジ:</div>
      <div class="review-new-badges">${newBadges.map(b=>`<div class="review-badge-chip">${b.icon} ${b.name}</div>`).join('')}</div>`;
    }
  }
  html += `</div>`;

  // ─ Section 2: ジャンル分析 ──────────────────────────
  html += `<div class="review-section">
    <div class="review-section-title">ジャンル別分析</div>`;

  const ge = Object.entries(genreMins)
    .map(([gid,m])=>({ gid,m, genre:genres.find(g=>g.id===gid) }))
    .filter(e=>e.genre).sort((a,b)=>b.m-a.m);

  if (!ge.length) {
    html += `<div style="color:var(--text-dim);font-size:.82rem">ジャンルデータがありません</div>`;
  } else {
    const maxM = ge[0].m;
    html += ge.map((e,i) => {
      const barW  = Math.round((e.m/maxM)*100);
      const pMins = prev[e.gid] || 0;
      const trend = e.m > pMins ? `<span style="color:#4ade80;font-size:.62rem">↑</span>`
                  : e.m < pMins ? `<span style="color:var(--red);font-size:.62rem">↓</span>`
                  : `<span style="color:var(--text-dim);font-size:.62rem">→</span>`;
      const color = (e.genre.color || 'var(--cyan)') + (i===0 ? '' : '88');
      return `<div class="review-bar-row">
        <div class="review-bar-label">${e.genre.emoji} ${e.genre.name}</div>
        <div class="review-bar-track"><div class="review-bar-fill" data-w="${barW}" style="background:${color}"></div></div>
        <div class="review-bar-val">${e.m}分 ${trend}</div>
      </div>`;
    }).join('');
    const mvp = ge[0];
    const pct = totalMins > 0 ? Math.round((mvp.m/totalMins)*100) : 0;
    html += `<div class="review-mvp-badge">⭐ MVP: <strong>${mvp.genre.emoji} ${mvp.genre.name}</strong> — ${mvp.m}分（${pct}%）</div>`;
  }
  html += `</div>`;

  // ─ Section 3: 時間帯 ────────────────────────────────
  html += `<div class="review-section">
    <div class="review-section-title">時間帯パターン</div>`;

  if (totalMins === 0) {
    html += `<div style="color:var(--text-dim);font-size:.82rem">データがありません</div>`;
  } else if (!hasHour) {
    // 曜日別ミニバーグラフ（代替表示）
    const maxD = Math.max(...days.map(d=>d.mins), 1);
    html += `<div style="font-size:.7rem;color:var(--text-dim);margin-bottom:8px">曜日別学習量:</div>
    <div style="display:flex;gap:4px;align-items:flex-end;height:56px;padding:0 2px">
      ${days.map((d,i)=>{
        const h = Math.max(Math.round((d.mins/maxD)*50), d.mins>0?4:0);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:100%;max-width:26px;height:${h||3}px;background:${d.mins>0?'var(--cyan)':'rgba(255,255,255,.08)'};border-radius:3px;margin-left:auto;margin-right:auto"></div>
          <div style="font-size:.55rem;color:var(--text-dim)">${DOW_LABELS[i]}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:.65rem;color:var(--text-dim);margin-top:8px;font-style:italic">時間帯の詳細は今後のセッションから蓄積されます</div>`;
  } else {
    const slotDefs = [
      {k:'morning',   e:'🌅', l:'朝', sub:'5〜11時'},
      {k:'afternoon', e:'☀️', l:'昼', sub:'11〜17時'},
      {k:'evening',   e:'🌆', l:'夕', sub:'17〜22時'},
      {k:'night',     e:'🌙', l:'夜', sub:'22〜5時'},
    ];
    const bestSlot = Object.entries(slots).reduce((b,[k,v])=>v>b.v?{k,v}:b,{k:'',v:-1}).k;
    html += `<div class="review-time-grid">
      ${slotDefs.map(s=>{
        const isBest = s.k===bestSlot && slots[s.k]>0;
        return `<div class="review-time-cell${isBest?' highlight':''}">
          <span class="review-time-emoji">${s.e}</span>
          <span class="review-time-slot-label">${s.l}<br><span style="font-size:.52rem">${s.sub}</span></span>
          <span class="review-time-val">${slots[s.k]||0}分</span>
        </div>`;
      }).join('')}
    </div>
    ${bestSlot ? `<div style="font-size:.77rem;color:var(--cyan);margin-top:8px">${slotDefs.find(s=>s.k===bestSlot).e} あなたは${slotDefs.find(s=>s.k===bestSlot).l}型タイプです！</div>` : ''}`;
  }
  html += `</div>`;

  // ─ Section 4: 振り返り入力 ──────────────────────────
  const refl = saved.reflection || {};
  html += `<div class="review-section">
    <div class="review-section-title">振り返り入力</div>
    <div class="review-input-group">
      <label class="review-input-label">💪 今週、一番頑張ったことは？</label>
      <input class="review-input" id="rv-best" type="text" maxlength="100" placeholder="例: 毎日少しでも記録できた" value="${escHtml(refl.bestThing||'')}">
    </div>
    <div class="review-input-group">
      <label class="review-input-label">🎯 来週、何に集中したい？</label>
      <input class="review-input" id="rv-next" type="text" maxlength="100" placeholder="例: 英語を毎日30分続ける" value="${escHtml(refl.nextFocus||'')}">
    </div>
  </div>`;

  // ─ Section 4.5: 今週の褒めログ（自分への記録）───────
  const weekLogs = getPraiseLogsForWeek(rvWeekKey);
  html += `<div class="review-section">
    <div class="review-section-title">今週の褒めログ</div>`;
  if (weekLogs.length === 0) {
    html += `<div class="review-praise-empty">この週は褒めログがまだありません。<br>今日のセッションを完了したら、ひとこと残してみよう。</div>`;
  } else {
    html += `<div class="review-praise-list">` +
      weekLogs.map(l => {
        const [_y, _m, _d] = l.dateKey.split('-');
        const dateLbl = `${parseInt(_m)}/${parseInt(_d)}`;
        const time = l.createdAt
          ? new Date(l.createdAt).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})
          : '';
        return `<div class="review-praise-card">
          <div class="review-praise-card-date">💛 ${dateLbl}${time ? ' &nbsp;'+time : ''}</div>
          <div class="review-praise-card-text">${escHtml(l.text)}</div>
        </div>`;
      }).join('') +
      `</div>`;
  }
  html += `</div>`;

  // ─ Section 5: アドバイス ────────────────────────────
  html += `<div class="review-section">
    <div class="review-section-title">来週へのアドバイス</div>`;
  sugs.forEach(([icon, text]) => {
    html += `<div class="review-suggestion"><div class="review-sug-icon">${icon}</div><div>${text}</div></div>`;
  });
  if (quote) {
    html += `<div style="margin-top:10px;padding:11px 14px;background:rgba(255,255,255,.03);border-radius:11px;border-left:3px solid rgba(6,182,212,.35)">
      <div style="font-size:.82rem;font-style:italic;color:rgba(255,255,255,.85)">「${quote.text}」</div>
      ${quote.author ? `<div style="font-size:.65rem;color:var(--text-dim);margin-top:4px">— ${quote.author}</div>` : ''}
    </div>`;
  }
  html += `</div>`;

  // ─ Section 6: 来週の目標 ────────────────────────────
  html += `<div class="review-section">
    <div class="review-section-title">来週の目標（任意）</div>
    <div style="font-size:.7rem;color:var(--text-dim);margin-bottom:7px">目標学習時間:</div>
    <div class="review-goal-presets" id="rv-presets">
      ${[30,60,120,180,300].map(m=>`<button class="review-preset-btn${rvGoalMins===m?' selected':''}" data-mins="${m}">${m>=60?Math.floor(m/60)+'時間'+(m%60?m%60+'分':''):m+'分'}</button>`).join('')}
      <button class="review-preset-btn${rvGoalMins===0?' selected':''}" data-mins="0">設定しない</button>
    </div>
    <div style="font-size:.7rem;color:var(--text-dim);margin-bottom:7px">達成したいバッジ（任意）:</div>
    <div class="review-badge-picker" id="rv-badge-picker">
      ${BADGES.filter(b=>!earnedBadges[b.id]).slice(0,8).map(b=>
        `<div class="rbp-item${rvGoalBadge===b.id?' picked':''}" data-bid="${b.id}">
          <div class="rbp-icon">${b.icon}</div>
          <div class="rbp-name">${b.name}</div>
        </div>`
      ).join('')}
    </div>
  </div>`;

  body.innerHTML = html;

  // バーアニメーション
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      body.querySelectorAll('.review-bar-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    });
  });

  // 目標プリセットバインド
  document.getElementById('rv-presets').querySelectorAll('.review-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rvGoalMins = parseInt(btn.dataset.mins);
      document.getElementById('rv-presets').querySelectorAll('.review-preset-btn')
        .forEach(b => b.classList.toggle('selected', parseInt(b.dataset.mins) === rvGoalMins));
    });
  });

  // バッジ選択バインド
  document.getElementById('rv-badge-picker').querySelectorAll('.rbp-item').forEach(el => {
    el.addEventListener('click', () => {
      rvGoalBadge = rvGoalBadge === el.dataset.bid ? '' : el.dataset.bid;
      document.getElementById('rv-badge-picker').querySelectorAll('.rbp-item')
        .forEach(e => e.classList.toggle('picked', e.dataset.bid === rvGoalBadge));
    });
  });
}

function saveAndCloseReview() {
  if (!rvWeekKey) return;
  const _isFirstSaveForWeek = !weeklyReviews[rvWeekKey];   // 同週の再保存は重複加算しない
  const an = analyzeWeek(rvWeekKey);
  weeklyReviews[rvWeekKey] = {
    weekKey:    rvWeekKey,
    createdAt:  Date.now(),
    reflection: {
      bestThing: document.getElementById('rv-best')?.value?.trim() || '',
      nextFocus: document.getElementById('rv-next')?.value?.trim() || '',
    },
    goal:     { targetMins: rvGoalMins, targetBadge: rvGoalBadge },
    snapshot: { totalMins: an.totalMins, sessions: an.sessions, studyDays: an.studyDays },
  };
  saveReviews();
  reviewStatus.skips = 0;
  saveReviewStatus();
  document.getElementById('review-overlay').classList.remove('open');
  setReviewDot(false);
  // 自信ゲージ: 新規保存のときだけ +5
  if (_isFirstSaveForWeek) addConfidence(5, 'weekly_review');
}

function skipReview() {
  reviewStatus.skips = (reviewStatus.skips || 0) + 1;
  reviewStatus.lastSkipped = rvWeekKey;
  saveReviewStatus();
  document.getElementById('review-overlay').classList.remove('open');
  setReviewDot(true);
}

// ── 過去レビュー一覧 ─────────────────────────────────────
function showPastReviews() {
  rvViewMode = 'past';
  renderReviewFooter(true);
  const body = document.getElementById('review-body');
  const keys = Object.keys(weeklyReviews).sort().reverse();
  if (!keys.length) {
    body.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text-dim);font-size:.85rem;line-height:1.9">
      まだ振り返りの記録がありません。<br>今週の振り返りを完了すると、ここに記録されます。
    </div>`; return;
  }
  body.innerHTML = keys.map(wk => {
    const r = weeklyReviews[wk];
    const dates = getWeekDates(wk);
    const label = `${dates[0].getMonth()+1}/${dates[0].getDate()}〜${dates[6].getMonth()+1}/${dates[6].getDate()}`;
    return `<div class="past-review-item" data-wk="${wk}">
      <div class="past-review-date">📊 ${label}</div>
      <div class="past-review-stats">総学習 ${r.snapshot?.totalMins||0}分 &middot; ${r.snapshot?.sessions||0}セッション &middot; ${r.snapshot?.studyDays||0}日</div>
      ${r.reflection?.bestThing ? `<div class="past-review-refl">「${escHtml(r.reflection.bestThing)}」</div>` : ''}
    </div>`;
  }).join('');
  body.querySelectorAll('.past-review-item').forEach(item => {
    item.addEventListener('click', () => openReviewModal(item.dataset.wk));
  });
}

// ── 自動トリガー ─────────────────────────────────────────
function getReviewTarget() {
  const now = new Date(), dow = now.getDay(), h = now.getHours();
  if (dow === 0 && h >= 20) return getWeekKey(now);      // 日曜20時以降→今週
  if (dow === 1) {                                        // 月曜→先週
    const d = new Date(now); d.setDate(d.getDate()-7); return getWeekKey(d);
  }
  return null;
}

function checkWeeklyReviewTrigger() {
  // 通知ドット: 前の週がまだ未レビューなら表示
  const prevD = new Date(); prevD.setDate(prevD.getDate()-7);
  const prevWk = getWeekKey(prevD);
  if (!weeklyReviews[prevWk]) setReviewDot(true);

  const target = getReviewTarget();
  if (!target) return;
  if (weeklyReviews[target]) { setReviewDot(false); return; }

  const isForced = (reviewStatus.skips || 0) >= 4;
  if (!isForced && reviewStatus.lastSkipped === target) return;

  setTimeout(() => showReviewAutoPrompt(target), 2200);
}

function showReviewAutoPrompt(wk) {
  const now = new Date();
  const msg = now.getDay()===0 ? '今週の学習を振り返りませんか？' : '先週の学習を振り返りませんか？';
  document.getElementById('review-prompt-msg').textContent = msg;
  const prompt = document.getElementById('review-prompt');
  prompt.classList.add('show');

  document.getElementById('review-prompt-open').onclick = () => {
    prompt.classList.remove('show');
    openReviewModal(wk);
  };
  document.getElementById('review-prompt-dismiss').onclick = () => {
    prompt.classList.remove('show');
    reviewStatus.lastSkipped = wk;
    reviewStatus.skips = (reviewStatus.skips||0) + 1;
    saveReviewStatus();
    setReviewDot(true);
  };
}

// ── イベントリスナー ──────────────────────────────────────
document.getElementById('review-btn').addEventListener('click', () => {
  const target = getReviewTarget() || getWeekKey(new Date());
  openReviewModal(target);
});
document.getElementById('review-close-btn').addEventListener('click', () =>
  document.getElementById('review-overlay').classList.remove('open'));
document.getElementById('review-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('review-overlay'))
    document.getElementById('review-overlay').classList.remove('open');
});
document.getElementById('review-past-btn').addEventListener('click', showPastReviews);

// ═══════════════════════════════════════════════════════
//  SKILL TREE SYSTEM
// ═══════════════════════════════════════════════════════

function checkSkillUnlocks() {
  const newlyUnlocked = [];
  genres.forEach(g => {
    SKILL_THRESHOLDS.forEach((t, j) => {
      const key = `${g.id}_${j}`;
      if (!skillData[key] && (g.minutes || 0) >= t.mins) {
        skillData[key] = Date.now();
        newlyUnlocked.push({ genreId: g.id, skillIdx: j, genre: g, threshold: t });
      }
    });
  });
  if (newlyUnlocked.length > 0) {
    saveSkillData();
    renderSkillCount();
  }
  return { newlyUnlocked };
}

function renderSkillCount() {
  const el = document.getElementById('skill-count-label');
  if (!el) return;
  const total = genres.length * 5;
  const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
  el.textContent = `🌳 スキル ${unlocked} / ${total} 解放`;
}

function buildSkillTreeSVG(animate) {
  const N = genres.length;
  const COL_W = 110, ROW_H = 88;
  const SVG_W = Math.max(460, N * COL_W + 80);
  const ROOT_Y = 46, ROOT_X = SVG_W / 2;
  const GENRE_Y = ROOT_Y + ROW_H;
  const SVG_H = GENRE_Y + ROW_H + 5 * ROW_H + 46;
  const R_ROOT = 20, R_GENRE = 20, R_SKILL = 16;
  const gxs = genres.map((_, i) => (SVG_W / N) * (i + 0.5));

  const aC = (ms) => animate ? ` class="skill-node sk-appear" style="animation-delay:${ms}ms"` : ' class="skill-node"';

  let p = [];

  p.push(`<defs>
    <filter id="skf-c" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="skf-g" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`);

  // Connection lines
  for (let i = 0; i < N; i++) {
    p.push(`<line x1="${ROOT_X}" y1="${ROOT_Y + R_ROOT}" x2="${gxs[i]}" y2="${GENRE_Y - R_GENRE}" stroke="rgba(255,255,255,.1)" stroke-width="1.5" stroke-dasharray="4 4"/>`);
    const anyUnlocked = SKILL_THRESHOLDS.some((_, j) => skillData[`${genres[i].id}_${j}`]);
    const lc0 = anyUnlocked ? 'rgba(6,182,212,.3)' : 'rgba(255,255,255,.08)';
    p.push(`<line x1="${gxs[i]}" y1="${GENRE_Y + R_GENRE}" x2="${gxs[i]}" y2="${GENRE_Y + ROW_H - R_SKILL}" stroke="${lc0}" stroke-width="1.5"/>`);
    for (let j = 0; j < 4; j++) {
      const y1 = GENRE_Y + ROW_H + j * ROW_H + R_SKILL;
      const y2 = GENRE_Y + ROW_H + (j + 1) * ROW_H - R_SKILL;
      const lc = skillData[`${genres[i].id}_${j + 1}`] ? 'rgba(6,182,212,.3)' : 'rgba(255,255,255,.08)';
      p.push(`<line x1="${gxs[i]}" y1="${y1}" x2="${gxs[i]}" y2="${y2}" stroke="${lc}" stroke-width="1.5"/>`);
    }
  }

  // Root node
  p.push(`<g${aC(0)} data-node="root">
    <circle cx="${ROOT_X}" cy="${ROOT_Y}" r="${R_ROOT}" fill="rgba(6,182,212,.15)" stroke="#06b6d4" stroke-width="1.5" filter="url(#skf-c)"/>
    <text x="${ROOT_X}" y="${ROOT_Y}" text-anchor="middle" dominant-baseline="central" font-size="14">⚔</text>
  </g>`);

  // Genre nodes
  for (let i = 0; i < N; i++) {
    const g = genres[i];
    const x = gxs[i];
    const uc = SKILL_THRESHOLDS.filter((_, j) => skillData[`${g.id}_${j}`]).length;
    const isMaxed = uc === 5;
    const isAny   = uc > 0;
    const fill   = isMaxed ? 'rgba(251,191,36,.18)'   : isAny ? 'rgba(6,182,212,.15)'    : 'rgba(255,255,255,.04)';
    const stroke = isMaxed ? '#fbbf24'                : isAny ? (g.color || '#06b6d4')   : 'rgba(255,255,255,.2)';
    const filt   = isMaxed ? ' filter="url(#skf-g)"' : isAny ? ' filter="url(#skf-c)"' : '';
    const nm = g.name.length > 6 ? g.name.slice(0, 5) + '…' : g.name;
    p.push(`<g${aC(100 + i * 60)} data-node="genre" data-genre="${g.id}">
      <circle cx="${x}" cy="${GENRE_Y}" r="${R_GENRE}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${filt}/>
      <text x="${x}" y="${GENRE_Y}" text-anchor="middle" dominant-baseline="central" font-size="14">${g.emoji}</text>
      <text x="${x}" y="${GENRE_Y + 28}" text-anchor="middle" font-size="9" fill="rgba(232,232,240,.5)" font-family="'Noto Sans JP',sans-serif">${nm}</text>
    </g>`);
  }

  // Skill nodes (row by row for cascade order)
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < N; i++) {
      const g = genres[i];
      const x = gxs[i];
      const skillY = GENRE_Y + ROW_H + j * ROW_H;
      const key = `${g.id}_${j}`;
      const isUnlocked = !!skillData[key];
      const isMax = j === 4 && isUnlocked;
      const t = SKILL_THRESHOLDS[j];
      const fill   = isMax      ? 'rgba(251,191,36,.15)' : isUnlocked ? 'rgba(6,182,212,.12)' : 'rgba(255,255,255,.03)';
      const stroke = isMax      ? '#fbbf24'              : isUnlocked ? '#06b6d4'              : 'rgba(255,255,255,.12)';
      const filt   = isMax      ? ' filter="url(#skf-g)"' : isUnlocked ? ' filter="url(#skf-c)"' : '';
      const emoji  = isUnlocked ? t.emoji : '🔒';
      const delay  = 200 + N * 60 + j * 80 + i * 40;
      p.push(`<g${aC(delay)} data-node="skill" data-genre="${g.id}" data-skill="${j}">
        <circle cx="${x}" cy="${skillY}" r="${R_SKILL}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${filt}/>
        <text x="${x}" y="${skillY}" text-anchor="middle" dominant-baseline="central" font-size="11">${emoji}</text>
      </g>`);
    }
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', SVG_W);
  svg.setAttribute('height', SVG_H);
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  svg.innerHTML = p.join('\n');
  return svg;
}

function renderSkillTree(animate) {
  const wrapper = document.getElementById('skill-svg-wrapper');
  const oldSvg = wrapper.querySelector('svg');
  if (oldSvg) oldSvg.remove();

  const svg = buildSkillTreeSVG(animate);
  wrapper.appendChild(svg);

  svg.querySelectorAll('.skill-node').forEach(node => {
    node.addEventListener('click', () => {
      const type = node.dataset.node;
      if (type === 'root')  showSkillNodeDetail('root', null, null);
      else if (type === 'genre') showSkillNodeDetail('genre', node.dataset.genre, null);
      else showSkillNodeDetail('skill', node.dataset.genre, parseInt(node.dataset.skill));
    });
  });

  const total = genres.length * 5;
  const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
  document.getElementById('skill-panel-sub').textContent = `${unlocked} / ${total} スキル解放済み`;
}

function showSkillNodeDetail(type, genreId, skillIdx) {
  const detail  = document.getElementById('skill-detail');
  const emoji   = document.getElementById('sd-emoji');
  const name    = document.getElementById('sd-name');
  const desc    = document.getElementById('sd-desc');
  const status  = document.getElementById('sd-status');
  const progFill = document.getElementById('sd-prog-fill');

  if (type === 'root') {
    emoji.textContent = '⚔';
    name.textContent  = 'Growth Quest';
    desc.textContent  = 'あなたの成長の旅。各ジャンルで学習を積み重ねるとスキルが解放されていきます。';
    const total    = genres.length * 5;
    const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
    status.textContent = `${unlocked} / ${total} スキル解放済み`;
    status.className   = 'sd-status st-unlocked';
    progFill.style.width = `${total > 0 ? (unlocked / total) * 100 : 0}%`;
  } else if (type === 'genre') {
    const g = genres.find(x => x.id === genreId);
    if (!g) return;
    emoji.textContent = g.emoji;
    name.textContent  = g.name;
    const uc = SKILL_THRESHOLDS.filter((_, j) => skillData[`${g.id}_${j}`]).length;
    if (uc === 5) {
      desc.textContent   = `累計学習 ${g.minutes || 0}分 ／ 全スキル解放！`;
      status.textContent = '✦ 達人級 — すべてのスキルを習得';
      status.className   = 'sd-status st-maxed';
      progFill.style.width = '100%';
    } else {
      desc.textContent = `累計学習 ${g.minutes || 0}分 ／ ${uc} / 5 スキル解放`;
      const next = SKILL_THRESHOLDS[uc];
      const rem  = Math.max(0, next.mins - (g.minutes || 0));
      status.textContent = `次のスキル「${next.name}」まであと ${rem}分`;
      status.className   = uc > 0 ? 'sd-status st-unlocked' : 'sd-status st-locked';
      progFill.style.width = `${Math.min(100, ((g.minutes || 0) / 3000) * 100)}%`;
    }
  } else {
    const g = genres.find(x => x.id === genreId);
    const t = SKILL_THRESHOLDS[skillIdx];
    if (!g || !t) return;
    const key = `${g.id}_${skillIdx}`;
    const isUnlocked = !!skillData[key];
    emoji.textContent = isUnlocked ? t.emoji : '🔒';
    name.textContent  = `${g.emoji} ${t.name}`;
    desc.textContent  = isUnlocked ? t.desc : `${g.name} を ${t.mins}分学習すると解放されます。`;
    if (isUnlocked) {
      const d = new Date(skillData[key]);
      status.textContent = `✦ 解放済み (${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()})`;
      status.className   = skillIdx === 4 ? 'sd-status st-maxed' : 'sd-status st-unlocked';
    } else {
      const rem = Math.max(0, t.mins - (g.minutes || 0));
      status.textContent = `あと ${rem}分で解放`;
      status.className   = 'sd-status st-locked';
    }
    const pct = Math.min(100, ((g.minutes || 0) / t.mins) * 100);
    progFill.style.width = `${pct}%`;
  }
  detail.classList.add('visible');
}

function renderNewSkillsInKoku(newlyUnlocked) {
  if (!newlyUnlocked || !newlyUnlocked.length) return;
  const result = document.getElementById('koku-result');
  const sec = document.createElement('div');
  sec.id = 'koku-skill-section';
  sec.innerHTML = `
    <div class="koku-skill-label">🌳 スキル解放！</div>
    <div class="koku-skill-list">
      ${newlyUnlocked.map(u => `<span class="koku-skill-chip">${u.threshold.emoji} ${u.genre.name} ─ ${u.threshold.name}</span>`).join('')}
    </div>
  `;
  result.appendChild(sec);
}

function openSkillModal() {
  document.getElementById('skill-overlay').classList.add('open');
  document.getElementById('skill-detail').classList.remove('visible');
  const animate = !skillTreeAnimated;
  skillTreeAnimated = true;
  renderSkillTree(animate);
}

// ═══════════════════════════════════════════════════════
//  AVATAR EVOLUTION SYSTEM
// ═══════════════════════════════════════════════════════

const AVATAR_STAGES = [
  { title:'見習い',  minLv:1,  maxLv:4,  c1:'#9898aa', c2:'#666677' },
  { title:'学徒',    minLv:5,  maxLv:9,  c1:'#67e8f9', c2:'#06b6d4' },
  { title:'修行者',  minLv:10, maxLv:19, c1:'#06b6d4', c2:'#0891b2' },
  { title:'賢者',    minLv:20, maxLv:49, c1:'#e63946', c2:'#c1121f' },
  { title:'大賢者',  minLv:50, maxLv:Infinity, c1:'#fbbf24', c2:'#d97706' },
];

function getAvatarStageIndex(level) {
  for (let i = AVATAR_STAGES.length - 1; i >= 0; i--) {
    if (level >= AVATAR_STAGES[i].minLv) return i;
  }
  return 0;
}

let _avId = 0;

function buildEvolutionBadgeSVG(stageIdx, w, h) {
  w = w || 44; h = h || 44;
  const idx = Math.min(stageIdx, AVATAR_STAGES.length - 1);
  const stage = AVATAR_STAGES[idx];
  const uid = 'evb' + (++_avId);
  const badges = [
    {
      glyph: '見',
      path: '<rect x="23" y="18" width="19" height="24" rx="3" fill="#d8d8e6"/><rect x="26" y="21" width="10" height="2" fill="#9898aa"/><rect x="26" y="26" width="12" height="2" fill="#9898aa"/><rect x="26" y="31" width="8" height="2" fill="#9898aa"/>'
    },
    {
      glyph: '学',
      path: '<path d="M42 15 25 38" stroke="#e8fbff" stroke-width="4" stroke-linecap="round"/><path d="M41 15c8 2 13 7 15 14-7 0-12-2-15-7-2 6-6 10-12 13 0-8 4-15 12-20Z" fill="#baf7ff"/><circle cx="25" cy="38" r="3" fill="#fbbf24"/>'
    },
    {
      glyph: '修',
      path: '<path d="M19 20h13l6 4h12v24H37l-6-4H19V20Z" fill="#dff7fb"/><path d="M32 20v24M38 24v24" stroke="#0891b2" stroke-width="2"/><path d="M24 28h5M42 32h5M23 37h6M42 41h4" stroke="#06b6d4" stroke-width="2" stroke-linecap="round"/>'
    },
    {
      glyph: '賢',
      path: '<path d="m37 13 5 14 15 1-12 9 4 15-12-8-12 8 4-15-12-9 15-1 5-14Z" fill="#ffd6db"/><path d="m37 20 3 8 9 1-7 5 2 9-7-5-7 5 2-9-7-5 9-1 3-8Z" fill="#e63946"/>'
    },
    {
      glyph: '極',
      path: '<path d="M18 44h38l-3-22-9 10-7-16-7 16-9-10-3 22Z" fill="#ffe08a"/><rect x="20" y="44" width="34" height="6" rx="2" fill="#d97706"/><circle cx="21" cy="22" r="4" fill="#fff2bd"/><circle cx="37" cy="15" r="4" fill="#fff2bd"/><circle cx="53" cy="22" r="4" fill="#fff2bd"/>'
    }
  ];
  const badge = badges[idx];

  return `<svg class="av-evolution-badge" viewBox="0 0 74 74" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${stage.title}バッジ">
    <defs>
      <linearGradient id="${uid}g" x1="12" y1="8" x2="62" y2="66" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${stage.c1}"/>
        <stop offset="100%" stop-color="${stage.c2}"/>
      </linearGradient>
      <filter id="${uid}s" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="${stage.c1}" flood-opacity=".25"/>
      </filter>
    </defs>
    <rect x="7" y="7" width="60" height="60" rx="14" fill="rgba(255,255,255,.045)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
    <rect x="11" y="11" width="52" height="52" rx="12" fill="url(#${uid}g)" opacity=".86" filter="url(#${uid}s)"/>
    <rect x="15" y="15" width="44" height="44" rx="10" fill="#12121f" opacity=".55"/>
    ${badge.path}
    <text x="37" y="60" text-anchor="middle" fill="#f8fbff" font-size="15" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${badge.glyph}</text>
  </svg>`;
}

// ── ピクセルアート共通レンダラー ──────────────────────────
function _buildPixelSprite(rows, pal, w, h) {
  const PS = 5; // 1ドット = 5×5 (viewBox 80×100)
  const uid = 'pxa' + (++_avId);
  const rects = [];
  rows.forEach((row, ry) => {
    for (let cx = 0; cx < 16; cx++) {
      const fill = pal[row[cx]];
      if (fill) rects.push(
        `<rect x="${cx*PS}" y="${ry*PS}" width="${PS}" height="${PS}" fill="${fill}"/>`
      );
    }
  });
  return `<svg viewBox="0 0 80 100" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="image-rendering:pixelated;display:block"><g>
${rects.join('')}<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 1;0 0" keyTimes="0;.25;.5;.75;1" dur="2.4s" repeatCount="indefinite"/></g></svg>`;
}

// ── 見習い タイプA（男性風・短髪）───────────────────────
function buildPixelAvatarSVG_0A(w, h) {
  const P = {
    h:'#6B3A1F', H:'#A05A2A', // 髪 / 髪ハイライト
    s:'#F2C88A', S:'#D9A060', // 肌 / 肌影
    e:'#1E1E2E', w:'#EEF4FF', // 目 / 目の輝き
    m:'#CC6060',               // 口
    c:'#8A8878', L:'#AAA898', C:'#686858', // シャツ / 明 / 暗
    p:'#4A4A56',               // ズボン
    b:'#3A2820', B:'#231810', // ブーツ / 底
  };
  // 16×20 グリッド (各行=16文字)
  const R = [
    '................', //  0 空白
    '.....hhhhhh.....', //  1 髪
    '....hHhhhhhh....', //  2 髪（H=左ハイライト）
    '....hsssssSh....', //  3 髪フレーム＋肌（S=右影）
    '....sssssSSs....', //  4 顔（SS=右陰影）
    '....sewssweS....', //  5 目（e=瞳,w=輝き,S=右影）
    '....sssssSSs....', //  6 顔
    '....ssmmmmss....', //  7 口（微笑み）
    '.....ssssss.....', //  8 あご
    '...cLcccccCCc...', //  9 肩（L=左明,CC=右暗）
    '..cLccccccCCcC..', // 10 腕（左右に張り出し）
    '..cLccccccCCcC..', // 11 腕
    '...cLcccccCCc...', // 12 胴体
    '...cLcccccCCc...', // 13 胴体下
    '....pppppppp....', // 14 ズボン
    '....ppp..ppp....', // 15 足
    '....ppp..ppp....', // 16 足
    '....bbb..bbb....', // 17 ブーツ
    '....bBb..bBb....', // 18 ブーツ底
    '................', // 19 空白
  ];
  return _buildPixelSprite(R, P, w, h);
}

// ── 見習い タイプB（女性風・ボウ付き）──────────────────
function buildPixelAvatarSVG_0B(w, h) {
  const P = {
    h:'#6B3A1F', H:'#A05A2A', // 髪 / 髪ハイライト
    r:'#E05080',               // リボン（ピンク）
    s:'#F2C88A', S:'#D9A060', // 肌 / 肌影
    e:'#1E1E2E', w:'#EEF4FF', // 目 / 目の輝き
    m:'#CC6060',               // 口
    c:'#C09870', L:'#D8B898', C:'#9A7858', // シャツ(暖色) / 明 / 暗
    p:'#4A4A56',               // ズボン
    b:'#3A2820', B:'#231810', // ブーツ / 底
  };
  const R = [
    '.....rr..rr.....', //  0 リボン（両サイド）
    '.....hhhhhh.....', //  1 髪
    '....hHhhhhhh....', //  2 髪
    '....hssssssh....', //  3 髪フレーム（左右対称）
    '....sssssSSs....', //  4 顔（SS=右陰影）
    '....sewssweS....', //  5 目
    '....sssssSSs....', //  6 顔
    '....ssmmmmss....', //  7 口
    '....hsssssSh....', //  8 あご＋髪サイド（長め演出）
    '...cLcccccCCc...', //  9 シャツ（暖色）
    '..cLccccccCCcC..', // 10 腕
    '..cLccccccCCcC..', // 11 腕
    '...cLcccccCCc...', // 12 胴体
    '...cLcccccCCc...', // 13 胴体下
    '....pppppppp....', // 14 ズボン
    '....ppp..ppp....', // 15 足
    '....ppp..ppp....', // 16 足
    '....bbb..bbb....', // 17 ブーツ
    '....bBb..bBb....', // 18 ブーツ底
    '................', // 19 空白
  ];
  return _buildPixelSprite(R, P, w, h);
}

// ── 見習い タイプC（中性的・ボブカット）────────────────
function buildPixelAvatarSVG_0C(w, h) {
  const P = {
    h:'#2A2020', H:'#4A3020', // 髪（ほぼ黒）/ 髪ハイライト（ダークブラウン）
    s:'#F2C88A', S:'#D9A060', // 肌 / 肌影
    e:'#1E1E2E', w:'#EEF4FF', // 目 / 目の輝き
    m:'#CC6060',               // 口
    c:'#6A5A8A', L:'#8A78AA', C:'#4A3A6A', // チュニック（紫）/ 明 / 暗
    p:'#4A4A56',               // ズボン
    b:'#3A2820', B:'#231810', // ブーツ / 底
  };
  // 16×20 グリッド — ボブカット: 行3・行8両方に髪サイドあり
  const R = [
    '................', //  0 空白
    '.....hhhhhh.....', //  1 髪トップ（コンパクト・直線的）
    '....hHhhhhhh....', //  2 髪（H=左ハイライト・黒髪の艶）
    '....hssssssh....', //  3 髪サイド＋肌（左右対称）
    '....sssssSSs....', //  4 顔（SS=右影）
    '....sewssweS....', //  5 目（e=瞳,w=輝き）
    '....sssssSSs....', //  6 顔
    '....ssmmmmss....', //  7 口（やさしい微笑み）
    '....hsssssSh....', //  8 あご＋髪サイド（ボブ: 顎ライン）
    '...cLcccccCCc...', //  9 チュニック（紫・L=左明,CC=右暗）
    '..cLccccccCCcC..', // 10 腕
    '..cLccccccCCcC..', // 11 腕
    '...cLcccccCCc...', // 12 胴体
    '...cLcccccCCc...', // 13 胴体下
    '....pppppppp....', // 14 ズボン
    '....ppp..ppp....', // 15 足
    '....ppp..ppp....', // 16 足
    '....bbb..bbb....', // 17 ブーツ
    '....bBb..bBb....', // 18 ブーツ底
    '................', // 19 空白
  ];
  return _buildPixelSprite(R, P, w, h);
}

function buildAvatarSVG(stageIdx, w, h) {
  w = w || 60; h = h || 75;
  if (stageIdx === 0) {
    if (avatarType === 'B') return buildPixelAvatarSVG_0B(w, h);
    if (avatarType === 'C') return buildPixelAvatarSVG_0C(w, h);
    return buildPixelAvatarSVG_0A(w, h);
  }
  const cfg = AVATAR_STAGES[Math.min(stageIdx, AVATAR_STAGES.length - 1)];
  const { c1, c2 } = cfg;
  const uid = 'av' + (++_avId);
  const parts = [];

  // 大賢者: 虹オーラリング
  if (stageIdx === 4) {
    parts.push(`<defs>
      <linearGradient id="${uid}rg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f97316"/>
        <stop offset="33%" stop-color="#a855f7"/>
        <stop offset="66%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#4ade80"/>
      </linearGradient>
    </defs>
    <circle cx="40" cy="48" r="44" fill="none" stroke="url(#${uid}rg)" stroke-width="2.5" opacity="0.55" stroke-dasharray="5 3"/>
    <circle cx="40" cy="48" r="37" fill="none" stroke="url(#${uid}rg)" stroke-width="1.5" opacity="0.3"/>`);
  }

  // 賢者+: 帽子
  if (stageIdx >= 3) {
    parts.push(`<polygon points="40,3 22,22 58,22" fill="${c1}" opacity="0.9"/>
    <rect x="20" y="20" width="40" height="5" rx="2.5" fill="${c2}"/>`);
  }

  // 賢者+: 杖
  if (stageIdx >= 3) {
    parts.push(`<line x1="12" y1="98" x2="12" y2="14" stroke="#d97706" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="12" cy="11" r="7" fill="#fbbf24"/>
    <circle cx="12" cy="11" r="3" fill="white" opacity="0.6"/>`);
  }

  // 頭（全段階）
  parts.push(`<circle cx="40" cy="22" r="14" fill="${c1}"/>
  <circle cx="35.5" cy="20.5" r="2" fill="${c2}"/>
  <circle cx="44.5" cy="20.5" r="2" fill="${c2}"/>
  <path d="M36,27 Q40,31 44,27" stroke="${c2}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);

  // 体（修行者以上: ローブ。それ未満: シンプル）
  if (stageIdx >= 2) {
    parts.push(`<path d="M27,38 Q22,62 20,88 L60,88 Q58,62 53,38 Z" fill="${c1}"/>
    <line x1="40" y1="40" x2="38" y2="88" stroke="${c2}" stroke-width="1.5"/>
    <rect x="16" y="78" width="12" height="9" rx="4" fill="${c2}"/>
    <rect x="52" y="78" width="12" height="9" rx="4" fill="${c2}"/>`);
  } else {
    parts.push(`<rect x="28" y="38" width="24" height="30" rx="5" fill="${c1}"/>
    <rect x="17" y="38" width="12" height="10" rx="5" fill="${c1}"/>
    <rect x="51" y="38" width="12" height="10" rx="5" fill="${c1}"/>
    <rect x="29" y="65" width="10" height="16" rx="5" fill="${c2}"/>
    <rect x="41" y="65" width="10" height="16" rx="5" fill="${c2}"/>`);
  }

  // 学徒/修行者: 本
  if (stageIdx >= 1 && stageIdx < 3) {
    parts.push(`<rect x="54" y="33" width="14" height="18" rx="2" fill="#fde68a"/>
    <rect x="54" y="33" width="3.5" height="18" rx="1.5" fill="#d97706"/>`);
  }

  // 修行者: ペン
  if (stageIdx === 2) {
    parts.push(`<rect x="16" y="27" width="3" height="22" rx="1.5" fill="#e8e8f0"/>
    <polygon points="17.5,49 15,56 20,56" fill="${c1}"/>`);
  }

  // 賢者+: 本の山
  if (stageIdx >= 3) {
    parts.push(`<rect x="54" y="34" width="14" height="17" rx="2" fill="#fde68a"/>
    <rect x="54" y="34" width="3.5" height="17" rx="1.5" fill="#d97706"/>
    <rect x="55" y="51" width="13" height="14" rx="2" fill="#a5f3fc"/>
    <rect x="55" y="51" width="3.5" height="14" rx="1.5" fill="#0891b2"/>`);
  }

  // 大賢者: キラキラ
  if (stageIdx === 4) {
    parts.push(`<text x="2"  y="14" font-size="9" fill="#fbbf24" opacity="0.9">✦</text>
    <text x="67" y="20" font-size="8" fill="#f97316" opacity="0.8">✦</text>
    <text x="5"  y="83" font-size="7" fill="#a855f7" opacity="0.75">✦</text>
    <text x="65" y="85" font-size="7" fill="#06b6d4" opacity="0.75">✦</text>`);
  }

  return `<svg viewBox="0 0 80 100" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">${parts.join('')}</svg>`;
}

// ── アバター詳細: 画像ファイルで表示（fallback: ドット絵）──────
// 装備合成: カテゴリ別オーバーレイ配置（base 画像に対する % 指定）
//   scale = オーバーレイの幅（高さは aspect-ratio 1:1 で同値）
//   cx/cy = オーバーレイ中心の位置（base 内座標, 0..100%）
const AVATAR_EQUIP_LAYOUT = {
  back: { scale: 110, cx: 50, cy: 50 },  // 背面: ベースより少し大きく中央
  body: { scale:  70, cx: 50, cy: 55 },  // 胴: 体の中央やや下
  head: { scale:  50, cx: 50, cy: 16 },  // 頭: 上部
  hand: { scale:  45, cx: 68, cy: 58 },  // 手: 右寄り中段
  pet:  { scale:  40, cx: 22, cy: 88 },  // ペット: 左下足元
};

function buildRichAvatarSVG_0(type) {
  const srcs = {
    A:'assets/avatar/adventurer-a-fixed.png',
    B:'assets/avatar/adventurer-b-fixed-v3.png',
    C:'assets/avatar/adventurer-c-fixed.png'
  };
  const src = srcs[type] || srcs.A;
  const fallback = buildAvatarSVG(0, 160, 200);
  // 装備中の各カテゴリをオーバーレイとして組み立て
  const equipped = (typeof getEquippedItems === 'function') ? getEquippedItems() : {};
  const overlays = EQUIPMENT_CATEGORIES.map(cat => {
    const item = equipped[cat];
    const lay  = AVATAR_EQUIP_LAYOUT[cat];
    if (!item || !item.imagePath || !lay) return '';
    return `<img src="${item.imagePath}" alt=""
      class="av-equip-overlay av-equip-layer-${cat}"
      style="width:${lay.scale}%;left:${lay.cx}%;top:${lay.cy}%"
      onerror="this.style.display='none'">`;
  }).join('');
  return `<div class="av-char-img-wrap">
    <div class="av-char-canvas">
      <img src="${src}" alt="" class="av-char-img"
        onerror="this.parentElement.style.display='none';this.parentElement.parentElement.querySelector('.av-char-fallback').style.display='flex'">
      ${overlays}
    </div>
    <div class="av-char-fallback" style="display:none">${fallback}</div>
  </div>`;
}

function buildRichAvatarSVG(stageIdx) {
  // 全進化段階でPNG画像を表示（stageIdx問わず共通）
  return buildRichAvatarSVG_0(avatarType);
}

// ── Avatar ストレージ ──────────────────────────────────
function loadAvatarData() {
  try { return JSON.parse(localStorage.getItem('gq_avatar') || '{"history":[]}'); }
  catch { return { history: [] }; }
}
function saveAvatarData() { localStorage.setItem('gq_avatar', JSON.stringify(avatarData)); }

let avatarData = loadAvatarData();

// ── アバタータイプ (A/B/C) ───────────────────────────────
let avatarType = localStorage.getItem('gq_av_type') || 'A';
function saveAvatarType() { localStorage.setItem('gq_av_type', avatarType); }

function checkAvatarEvolution() {
  const curIdx  = getAvatarStageIndex(data.level);
  const hist    = avatarData.history;
  const lastIdx = hist.length ? hist[hist.length - 1].stage : -1;

  if (curIdx > lastIdx) {
    for (let s = lastIdx + 1; s <= curIdx; s++) {
      hist.push({
        stage: s,
        title: AVATAR_STAGES[s].title,
        level: data.level,
        date:  todayKey(),
      });
    }
    saveAvatarData();
    lastAvatarEvolution = true;
    renderAvatarBtn();
    return true;
  }

  if (hist.length === 0) {
    hist.push({ stage: curIdx, title: AVATAR_STAGES[curIdx].title, level: data.level, date: todayKey() });
    saveAvatarData();
  }
  renderAvatarBtn();
  return false;
}

// アバター円アイコン: 各キャラ静止画から「顔（首から上）」を切り抜く設定。
// size=background-size, pos=background-position（PNG頭部解析で算出）
const AV_FACE_FRAME = {
  A: { src: 'assets/avatar/adventurer-a-face.png' },
  B: { src: 'assets/avatar/adventurer-b-face-v3.png' },
  C: { src: 'assets/avatar/adventurer-c-face.png' },
};

function renderAvatarBtn() {
  const btn = document.getElementById('avatar-btn');
  if (!btn) return;
  // ヘッダーは円アイコン: キャラ静止画の顔だけを切り抜いて表示。avatarType に追従
  const f = AV_FACE_FRAME[avatarType] || AV_FACE_FRAME.A;
  btn.innerHTML = '';
  btn.style.backgroundImage    = `url('${f.src}')`;
  btn.style.backgroundSize     = 'cover';
  btn.style.backgroundPosition = 'center';
}

// ── Avatar モーダル ────────────────────────────────────
function fmtMinsHint(mins) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  }
  return `${mins}分`;
}

function openAvatarModal() {
  document.getElementById('avatar-overlay').classList.add('open');
  renderAvatarModal();
  document.getElementById('avatar-panel').scrollTop = 0;
}

function renderAvatarModal() {
  const si       = getAvatarStageIndex(data.level);
  const stage    = AVATAR_STAGES[si];
  const next     = AVATAR_STAGES[si + 1];

  document.getElementById('avatar-display-large').innerHTML = buildRichAvatarSVG(si);

  // タイプ選択UI（進化段階に関わらず常時表示）
  const typeSel = document.getElementById('avatar-type-selector');
  typeSel.innerHTML = `
    <div class="av-type-label">アバタータイプ</div>
    <div class="av-type-btns">
      <button class="av-type-btn${avatarType==='A'?' active':''}" data-avtype="A">冒険者A<br><span style="font-size:.65rem;opacity:.7">男性風・短髪</span></button>
      <button class="av-type-btn${avatarType==='B'?' active':''}" data-avtype="B">冒険者B<br><span style="font-size:.65rem;opacity:.7">女性風・リボン</span></button>
      <button class="av-type-btn${avatarType==='C'?' active':''}" data-avtype="C">冒険者C<br><span style="font-size:.65rem;opacity:.7">中性的・ボブカット</span></button>
    </div>`;

  // 次進化までの分数を計算
  let minsToNext = null;
  if (next) {
    let lvl = data.level, xp = data.xp, total = 0;
    while (lvl < next.minLv) {
      total += (xpForLevel(lvl) - xp);
      xp = 0; lvl++;
    }
    minsToNext = total;
  }

  const earnedCount = Object.keys(earnedBadges).length;

  document.getElementById('avatar-stage-info').innerHTML = `
    <div class="av-title" style="color:${stage.c1};text-shadow:0 0 20px ${stage.c1}60">${stage.title}</div>
    <div class="av-subtitle">Lv ${data.level} &nbsp;·&nbsp; ${data.xp} / ${xpForLevel(data.level)} XP</div>
    <div class="av-next-hint">${
      next
        ? `🌟 次の進化「${next.title}」まであと <strong>${fmtMinsHint(minsToNext)}</strong>の学習`
        : '✨ 最高段階「大賢者」に到達！'
    }</div>
    <div class="av-stat-row">
      <div class="av-stat-item">
        <div class="av-stat-val" style="color:var(--cyan)">${data.totalMinutes}分</div>
        <div class="av-stat-lbl">累計学習時間</div>
      </div>
      <div class="av-stat-item">
        <div class="av-stat-val" style="color:var(--gold)">${earnedCount}</div>
        <div class="av-stat-lbl">獲得バッジ数</div>
      </div>
    </div>
  `;

  // 進化の軌跡タイムライン
  const hist = avatarData.history;
  let journeyHTML = '';
  if (hist.length) {
    journeyHTML = '<div class="av-journey-label">進化の軌跡</div>';
    journeyHTML += [...hist].reverse().map((h, i) => {
      const s       = AVATAR_STAGES[h.stage];
      const isCur   = i === 0;
      return `<div class="av-journey-item">
        <div class="av-journey-badge-wrap">${buildEvolutionBadgeSVG(h.stage, 46, 46)}</div>
        <div class="av-journey-meta">
          <div class="av-journey-title" style="color:${isCur ? s.c1 : 'var(--text-dim)'}">${s.title}</div>
          <div class="av-journey-date">Lv ${h.level} &nbsp;·&nbsp; ${h.date}</div>
          ${isCur ? '<div class="av-journey-cur">← 現在</div>' : ''}
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('avatar-journey').innerHTML = journeyHTML;

  // 現在の装備セクション
  renderAvatarEquipmentSection();
}

// アバター画面の「現在の装備」セクションを描画
function renderAvatarEquipmentSection() {
  const el = document.getElementById('avatar-equipment');
  if (!el) return;
  const equipped = getEquippedItems();
  el.innerHTML = '<div class="av-equipment-label">現在の装備</div>'
    + EQUIPMENT_CATEGORIES.map(cat => {
      const item = equipped[cat];
      if (!item) {
        return `<div class="av-eq-row">
          <div class="av-eq-cat">${CATEGORY_LABEL[cat]}</div>
          <div class="av-eq-info"><span class="av-eq-empty">未装備</span></div>
        </div>`;
      }
      return `<div class="av-eq-row">
        <div class="av-eq-cat">${CATEGORY_LABEL[cat]}</div>
        <div class="av-eq-icon">${renderItemIcon(item, 22)}</div>
        <div class="av-eq-info">
          <div class="av-eq-name">${item.name}
            <span class="eq-rarity-tag eq-rarity-${item.rarity}">${RARITY_LABELS[item.rarity]}</span>
          </div>
          <div class="av-eq-effect">${item.effect.desc}</div>
        </div>
      </div>`;
    }).join('');
}

// アバターモーダルが開いていれば再描画（装備セクション＋画像合成も）。
// 閉じてれば何もしない
function refreshAvatarEquipmentIfOpen() {
  const ov = document.getElementById('avatar-overlay');
  if (ov && ov.classList.contains('open')) renderAvatarModal();
}

document.getElementById('avatar-btn').addEventListener('click', openAvatarModal);
document.getElementById('avatar-close-btn').addEventListener('click', () =>
  document.getElementById('avatar-overlay').classList.remove('open'));
document.getElementById('avatar-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('avatar-overlay'))
    document.getElementById('avatar-overlay').classList.remove('open');
});
// アバタータイプ切り替え（イベント委譲）
document.getElementById('avatar-panel').addEventListener('click', e => {
  const btn = e.target.closest('[data-avtype]');
  if (!btn) return;
  avatarType = btn.dataset.avtype;
  saveAvatarType();
  renderAvatarBtn();   // ヘッダーのアイコン更新
  renderAvatarModal(); // モーダル内のアバター＋ボタン状態更新
  document.getElementById('avatar-panel').scrollTo({ top: 0, behavior: 'smooth' });
});

// ═══════════════════════════════════════════════════════
//  SUGOROKU — EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.getElementById('board-btn').addEventListener('click', openBoardModal);
document.getElementById('board-close-btn').addEventListener('click', () => {
  document.getElementById('board-overlay').classList.remove('open');
});
document.getElementById('board-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('board-overlay'))
    document.getElementById('board-overlay').classList.remove('open');
});

// ═══════════════════════════════════════════════════════
//  SKILL TREE — EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.getElementById('skill-btn').addEventListener('click', openSkillModal);
document.getElementById('skill-close-btn').addEventListener('click', () => {
  document.getElementById('skill-overlay').classList.remove('open');
});
document.getElementById('skill-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('skill-overlay'))
    document.getElementById('skill-overlay').classList.remove('open');
});

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
applySettings();
// すごろく遡及初期化: 初回ロード時、既存セッション数分だけマスを進める
if (!sugorokuData.initialized) {
  sugorokuData.pos = Math.min(data.sessions, 99);
  sugorokuData.initialized = true;
  saveSugorokuData();
}
renderXP();
renderStats();
renderGenreSelector();
renderCalendar();
renderDailyQuote();
checkBadges();
checkAvatarEvolution();
checkSkillUnlocks();
checkWeeklyReviewTrigger();

// ─── LAUNCH SCREEN ────────────────────────────────
(function() {
  const container = document.getElementById('launch-particles');
  const colors = ['#06b6d4','#818cf8','#e63946','#f4a261','#4ade80'];
  for (let i = 0; i < 18; i++) {
    const d = document.createElement('div');
    d.className = 'lp-dot';
    const size = 3 + Math.random() * 5;
    d.style.cssText = [
      `width:${size}px`, `height:${size}px`,
      `left:${5 + Math.random() * 90}%`,
      `top:${20 + Math.random() * 65}%`,
      `background:${colors[i % colors.length]}`,
      `--dur:${3 + Math.random() * 4}s`,
      `--delay:${Math.random() * 2}s`,
    ].join(';');
    container.appendChild(d);
  }
  const ls = document.getElementById('launch-screen');
  setTimeout(() => {
    ls.classList.add('fade-out');
    setTimeout(() => { ls.style.display = 'none'; }, 650);
  }, 2400);
})();

// ═══════════════════════════════════════════════════════
//  EQUIPMENT — MODAL UI（装備モーダル）
//  既存ヘルパ getOwnedItems / getEquippedItems / equipItem /
//  unequipItem / isEquipped / renderItemIcon を活用。
// ═══════════════════════════════════════════════════════
function renderEquipmentModal() {
  // ── 現在の装備（5スロット）─
  const slotList = document.getElementById('equipment-slot-list');
  const equipped = getEquippedItems();
  slotList.innerHTML = EQUIPMENT_CATEGORIES.map(cat => {
    const item = equipped[cat];
    if (!item) {
      return `<div class="eq-slot">
        <div class="eq-slot-cat">${CATEGORY_LABEL[cat]}</div>
        <div class="eq-slot-info"><span class="eq-slot-empty">未装備</span></div>
      </div>`;
    }
    return `<div class="eq-slot">
      <div class="eq-slot-cat">${CATEGORY_LABEL[cat]}</div>
      <div class="eq-slot-icon">${renderItemIcon(item, 28)}</div>
      <div class="eq-slot-info">
        <div class="eq-slot-name">${item.name}
          <span class="eq-rarity-tag eq-rarity-${item.rarity}">${RARITY_LABELS[item.rarity]}</span>
        </div>
        <div class="eq-slot-meta">${item.effect.desc}</div>
      </div>
      <button class="eq-act-btn" data-unequip="${cat}">外す</button>
    </div>`;
  }).join('');

  // ── 所持アイテム一覧 ─
  const ownedList = document.getElementById('equipment-owned-list');
  const owned = getOwnedItems();
  if (owned.length === 0) {
    ownedList.innerHTML = `<div class="eq-empty-state">
      まだ装備アイテムを持っていません。<br>
      まずはテストで <code>addItemToInventory('cap_focus')</code> を実行してください。
    </div>`;
    return;
  }
  ownedList.innerHTML = EQUIPMENT_CATEGORIES.map(cat => {
    const items = owned.filter(it => it.category === cat);
    if (items.length === 0) return '';
    return `<div class="eq-category-group">
      <div class="eq-category-label">${CATEGORY_LABEL[cat]}</div>
      ${items.map(item => {
        const eq = isEquipped(item.id);
        return `<div class="eq-slot">
          <div class="eq-slot-icon">${renderItemIcon(item, 28)}</div>
          <div class="eq-slot-info">
            <div class="eq-slot-name">${item.name}
              <span class="eq-rarity-tag eq-rarity-${item.rarity}">${RARITY_LABELS[item.rarity]}</span>
            </div>
            <div class="eq-slot-meta">${item.effect.desc}</div>
          </div>
          ${eq
            ? '<button class="eq-act-btn equipped" disabled>装備中</button>'
            : `<button class="eq-act-btn" data-equip="${item.id}">装備する</button>`}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function openEquipmentModal() {
  document.getElementById('equipment-overlay').classList.add('open');
  renderEquipmentModal();
}
function closeEquipmentModal() {
  document.getElementById('equipment-overlay').classList.remove('open');
}

document.getElementById('equipment-btn').addEventListener('click', openEquipmentModal);
document.getElementById('equipment-close-btn').addEventListener('click', closeEquipmentModal);
document.getElementById('equipment-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('equipment-overlay')) closeEquipmentModal();
});
// 装備/外す（イベント委譲）
document.getElementById('equipment-modal-panel').addEventListener('click', e => {
  const equipBtn   = e.target.closest('[data-equip]');
  const unequipBtn = e.target.closest('[data-unequip]');
  if (equipBtn)   {
    equipItem(equipBtn.dataset.equip);
    renderEquipmentModal();
    refreshAvatarEquipmentIfOpen();
    return;
  }
  if (unequipBtn) {
    unequipItem(unequipBtn.dataset.unequip);
    renderEquipmentModal();
    refreshAvatarEquipmentIfOpen();
    return;
  }
});

// ── 装備獲得演出モーダル ─────────────────────────────
function showEquipmentGetModal(item) {
  if (!item) return;
  const overlay = document.getElementById('equipment-get-overlay');
  const panel   = document.getElementById('equipment-get-panel');

  // レア度クラスをパネルに付与（背景発光が切り替わる）
  panel.className = 'gq-panel rarity-' + item.rarity;

  // アイコンは毎回再生成（バウンスアニメを再生するため）
  document.getElementById('eq-get-icon-wrap').innerHTML =
    `<div class="eq-get-icon">${renderItemIcon(item, 56)}</div>`;

  document.getElementById('eq-get-name').textContent = item.name;

  const rarityEl = document.getElementById('eq-get-rarity-tag');
  rarityEl.className = 'eq-get-rarity-tag rarity-' + item.rarity;
  rarityEl.textContent = RARITY_LABELS[item.rarity];

  document.getElementById('eq-get-effect').textContent = '◇ ' + item.effect.desc;
  document.getElementById('eq-get-flavor').textContent =
    item.flavorText || '冒険の助けとなる、ひとつの出会い。';

  overlay.classList.add('open');
}
function closeEquipmentGetModal() {
  document.getElementById('equipment-get-overlay').classList.remove('open');
}
document.getElementById('eq-get-close-btn').addEventListener('click', closeEquipmentGetModal);
document.getElementById('equipment-get-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('equipment-get-overlay')) closeEquipmentGetModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'
      && document.getElementById('equipment-get-overlay').classList.contains('open')) {
    closeEquipmentGetModal();
  }
});

// ═══════════════════════════════════════════════════════
//  DASHBOARD — ウィジェット ドラッグ並べ替え（ステップ1: 動作のみ）
//  Pointer Events でマウス/タッチ両対応。グリップ上でだけドラッグ開始。
//  ※ 並び順の保存・復元はステップ2で実装予定
// ═══════════════════════════════════════════════════════
(function initWidgetReorder() {
  const app = document.getElementById('app');
  if (!app) return;
  let dragEl = null;

  // 並べ替え対象ウィジェットの既知IDリスト（HTMLのデフォルト順）
  const KNOWN_IDS = [
    'xp-panel', 'daily-quest-card', 'daily-quote-card', 'genre-card', 'mode-panel',
    'timer-card', 'stats-strip', 'calendar-panel'
  ];
  const STORAGE_KEY = 'gq_widget_order';

  // 現在のDOM順でウィジェットIDを配列として返す
  const getWidgets = () => Array.from(app.querySelectorAll('.widget'));
  const getCurrentOrder = () => getWidgets().map(w => w.id).filter(id => KNOWN_IDS.includes(id));

  // 並び順を localStorage に保存
  function saveWidgetOrder() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getCurrentOrder()));
  }

  // 保存された並び順を復元する（フォールバック付き）
  function loadWidgetOrder() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { saved = null; }
    if (!Array.isArray(saved)) return; // 保存データなし → デフォルトのまま

    // 既知IDだけ残し、未知IDは無視
    const validSaved = saved.filter(id => KNOWN_IDS.includes(id));

    // 保存に含まれていない既知IDを末尾に補完
    const missing = KNOWN_IDS.filter(id => !validSaved.includes(id));
    const orderedIds = [...validSaved, ...missing];

    // DOM を orderedIds の順に並べ直す
    for (const id of orderedIds) {
      const el = document.getElementById(id);
      if (el) app.appendChild(el); // 末尾に移動するとリスト順になる
    }
  }

  // リセットボタン：保存を消してデフォルト順に戻す
  function resetWidgetOrder() {
    localStorage.removeItem(STORAGE_KEY);
    for (const id of KNOWN_IDS) {
      const el = document.getElementById(id);
      if (el) app.appendChild(el);
    }
  }

  // ページ読み込み時に復元
  loadWidgetOrder();

  // リセットボタンにイベントを紐づけ
  const resetBtn = document.getElementById('reset-widget-order-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetWidgetOrder);

  // 各ウィジェットの位置を { id: DOMRect } で記録する
  function snapPositions() {
    const map = new Map();
    getWidgets().forEach(w => map.set(w, w.getBoundingClientRect()));
    return map;
  }

  // FLIP: 移動前の位置 → DOM更新 → 差分をtransformで補正 → transitionで0へ戻す
  function flipAnimate(before) {
    getWidgets().forEach(w => {
      if (w === dragEl) return;
      const bRect = before.get(w);
      if (!bRect) return;
      const aRect = w.getBoundingClientRect();
      const dy = bRect.top - aRect.top;
      if (Math.abs(dy) < 1) return; // ほぼ動いていなければスキップ
      w.style.transition = 'none';
      w.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        w.style.transition = 'transform 220ms ease-out';
        w.style.transform = '';
      });
    });
  }

  let hintEl = null; // 現在 drop-hint が付いているウィジェット

  function setDropHint(target) {
    if (hintEl === target) return;
    if (hintEl) hintEl.classList.remove('drop-hint');
    hintEl = target;
    if (hintEl) hintEl.classList.add('drop-hint');
  }

  function onPointerMove(e) {
    if (!dragEl) return;
    const y = e.clientY;
    // ポインタ位置より下に中心がある最初のウィジェットを探す
    let after = null;
    for (const w of getWidgets()) {
      if (w === dragEl) continue;
      const box = w.getBoundingClientRect();
      if (y < box.top + box.height / 2) { after = w; break; }
    }
    // 挿入ヒント（隙間）を表示
    setDropHint(after);
    // after が null なら末尾へ。既に正しい位置なら何もしない
    if (after !== dragEl.nextElementSibling) {
      const before = snapPositions();
      app.insertBefore(dragEl, after);
      flipAnimate(before);
    }
  }

  function endDrag() {
    if (dragEl) dragEl.classList.remove('dragging');
    setDropHint(null); // ヒントを消す
    // FLIPアニメ用のtransitionを残さずクリーン
    getWidgets().forEach(w => { w.style.transition = ''; w.style.transform = ''; });
    dragEl = null;
    saveWidgetOrder(); // ドラッグ完了時に順番を保存
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
  }

  function onGripDown(e) {
    if (e.button > 0) return;           // 右/中クリックは無視
    const widget = e.currentTarget.closest('.widget');
    if (!widget) return;
    dragEl = widget;
    widget.classList.add('dragging');
    e.currentTarget.setPointerCapture(e.pointerId); // 指/カーソルが外れても追従
    e.preventDefault();
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  }

  getWidgets().forEach(w => {
    const grip = w.querySelector('.widget-grip');
    if (grip) grip.addEventListener('pointerdown', onGripDown);
  });
})();

// ═══════════════════════════════════════════════════════
//  ONBOARDING TUTORIAL — 初回チュートリアル
//  - 初回起動時のみ自動表示
//  - localStorage: gq_tutorial_seen = '1' で抑制
//  - 設定モーダルから再表示可能
// ═══════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  { icon:'⚔', title:'Growth Quest へようこそ',
    body:'このアプリは、学習や自己成長を冒険に変えるアプリです。' },
  { icon:'📚', title:'まずはジャンルを選ぼう',
    body:'英語、投資、救急、読書、アプリ開発など、今日取り組むテーマを選びます。' },
  { icon:'⏱', title:'STARTを押して冒険開始',
    body:'5分でもOK。始めた時点で、もう一歩前進です。' },
  { icon:'✨', title:'完了すると成長',
    body:'XP、すごろく、装備、バッジなどで努力が見える形になります。' },
  { icon:'🌱', title:'自信は証拠から育つ',
    body:'小さな行動の積み重ねが、未来の自分を作ります。' },
];

let tutorialStep = 0;

function renderTutorial() {
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return;
  document.getElementById('tutorial-icon').textContent = step.icon;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-body').textContent = step.body;

  // ステップドット更新
  document.querySelectorAll('.tut-dot').forEach((d, i) => {
    d.classList.toggle('active', i === tutorialStep);
    d.classList.toggle('passed', i < tutorialStep);
  });

  // 戻るボタン: 最初なら非表示
  document.getElementById('tutorial-prev-btn').disabled = (tutorialStep === 0);

  // 次へボタン: 最終ステップなら「冒険を始める」へ変身
  const nextBtn = document.getElementById('tutorial-next-btn');
  const isLast  = (tutorialStep === TUTORIAL_STEPS.length - 1);
  if (isLast) {
    nextBtn.textContent = '⚔ 冒険を始める';
    nextBtn.classList.add('start');
  } else {
    nextBtn.textContent = '次へ →';
    nextBtn.classList.remove('start');
  }
}

function openTutorial() {
  tutorialStep = 0;
  renderTutorial();
  document.getElementById('tutorial-overlay').classList.add('open');
}
function closeTutorial() {
  document.getElementById('tutorial-overlay').classList.remove('open');
  // 一度でも閉じたら「見た」扱い → 次回以降は自動表示しない
  localStorage.setItem('gq_tutorial_seen', '1');
}
function tutorialNext() {
  if (tutorialStep < TUTORIAL_STEPS.length - 1) {
    tutorialStep++;
    renderTutorial();
  } else {
    closeTutorial();   // 最終ステップで「冒険を始める」→ 閉じる
  }
}
function tutorialPrev() {
  if (tutorialStep > 0) {
    tutorialStep--;
    renderTutorial();
  }
}

// イベントリスナー
document.getElementById('tutorial-next-btn').addEventListener('click', tutorialNext);
document.getElementById('tutorial-prev-btn').addEventListener('click', tutorialPrev);
document.getElementById('tutorial-skip-btn').addEventListener('click', closeTutorial);
// 背景クリックでも閉じる
document.getElementById('tutorial-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('tutorial-overlay')) closeTutorial();
});
// キーボード操作（←→ / Enter / Space / Esc）
document.addEventListener('keydown', e => {
  const ov = document.getElementById('tutorial-overlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (e.key === 'Escape')      { e.preventDefault(); closeTutorial(); }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); tutorialPrev(); }
  else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); tutorialNext();
  }
});

// 設定モーダルからの再表示
const _showTutBtn = document.getElementById('show-tutorial-btn');
if (_showTutBtn) {
  _showTutBtn.addEventListener('click', () => {
    // 設定モーダルを閉じてからチュートリアルを開く
    document.getElementById('settings-overlay').classList.remove('open');
    setTimeout(openTutorial, 320);   // 設定のフェードアウト後
  });
}

// 初回起動時の自動表示（ローンチ画面が消えた後）
if (!localStorage.getItem('gq_tutorial_seen')) {
  setTimeout(openTutorial, 3200);   // ローンチ 2400ms + fade 650ms より後
}
