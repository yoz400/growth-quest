// ═══════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════
/* ===== OverlayManager: オーバーレイの交通整理（同時に操作できるのは1つ） ===== */
const Overlay = (() => {
  const stack = [];
  const lastFocus = new Map();
  const closeHooks = new Map();

  const DEFS = {
    'login-bonus-overlay':    { openClass: 'open', dismissible: false },
    'koku-overlay':           { openClass: 'active', dismissible: true },
    'genre-overlay':          { openClass: 'open', dismissible: true },
    'badges-overlay':         { openClass: 'open', dismissible: true },
    'equipment-overlay':      { openClass: 'open', dismissible: true },
    'equipment-get-overlay':  { openClass: 'open', dismissible: true },
    'board-overlay':          { openClass: 'open', dismissible: true },
    'skill-overlay':          { openClass: 'open', dismissible: true },
    'review-overlay':         { openClass: 'open', dismissible: true },
    'avatar-overlay':         { openClass: 'open', dismissible: true },
    'words-overlay':          { openClass: 'open', dismissible: true },
    'settings-overlay':       { openClass: 'open', dismissible: true },
    'praise-overlay':         { openClass: 'open', dismissible: true },
    'guide-tutorial-overlay': { openClass: 'open', dismissible: false },
    'guild-overlay':          { openClass: 'open', dismissible: true },
    'vow-blessing-overlay':   { openClass: 'open', dismissible: true },
    'fairy-overlay':          { openClass: 'open', dismissible: true },
    'fairy-guide-overlay':    { openClass: 'open', dismissible: true },
    'tutorial-overlay':       { openClass: 'open', dismissible: true },
    'summon-overlay':         { openClass: 'open', dismissible: false },
  };
  const OVERLAY_IDS = Object.keys(DEFS);
  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const def = id => ({ openClass: 'open', dismissible: true, ...(DEFS[id] || {}) });
  const el = id => document.getElementById(id);

  function setInert(target, value) {
    if (target && target instanceof HTMLElement) target.inert = value;
  }

  function isInTopPath(node, topEl) {
    return node === topEl || node.contains(topEl);
  }

  function syncPageInert(topEl) {
    const hasOverlay = stack.length > 0;
    const app = document.getElementById('app');
    Array.from(document.body.children).forEach(child => {
      if (child.tagName === 'SCRIPT') return;
      setInert(child, hasOverlay && (!topEl || !isInTopPath(child, topEl)));
    });
    if (!app) return;
    Array.from(app.children).forEach(child => {
      setInert(child, hasOverlay && (!topEl || !isInTopPath(child, topEl)));
    });
  }

  function syncInert() {
    const top = stack[stack.length - 1];
    const topEl = top ? el(top) : null;
    stack.forEach(id => {
      const overlay = el(id);
      if (!overlay) return;
      overlay.inert = id !== top;
      overlay.setAttribute('aria-hidden', id === top ? 'false' : 'true');
    });
    syncPageInert(topEl);
  }

  function getFocusable(overlay) {
    return Array.from(overlay.querySelectorAll(FOCUSABLE))
      .filter(node => node.offsetParent !== null || node === document.activeElement);
  }

  function focusFirst(id) {
    const overlay = el(id);
    const first = overlay ? getFocusable(overlay)[0] : null;
    if (first) first.focus();
  }

  function open(id, { onClose } = {}) {
    const overlay = el(id);
    if (!overlay) return;
    if (stack.includes(id)) return;
    lastFocus.set(id, document.activeElement);
    if (onClose) closeHooks.set(id, onClose);
    stack.push(id);
    overlay.classList.add(def(id).openClass);
    overlay.setAttribute('aria-hidden', 'false');
    syncInert();
    setTimeout(() => focusFirst(id), 0);
  }

  function close(id) {
    const targetId = id || stack[stack.length - 1];
    if (!targetId) return;
    const i = stack.indexOf(targetId);
    if (i === -1) return;
    stack.splice(i, 1);
    const overlay = el(targetId);
    if (overlay) {
      overlay.classList.remove(def(targetId).openClass);
      overlay.setAttribute('aria-hidden', 'true');
      overlay.inert = false;
    }
    syncInert();
    const back = lastFocus.get(targetId);
    if (back && typeof back.focus === 'function') back.focus();
    lastFocus.delete(targetId);
    const hook = closeHooks.get(targetId);
    if (hook) {
      closeHooks.delete(targetId);
      hook();
    }
  }

  function closeAll() {
    while (stack.length) close();
  }

  function topId() {
    return stack[stack.length - 1] || null;
  }

  OVERLAY_IDS.forEach(id => el(id)?.setAttribute('aria-hidden', 'true'));

  document.addEventListener('keydown', e => {
    const top = topId();
    if (!top) return;
    if (e.key === 'Escape') {
      if (def(top).dismissible) {
        e.preventDefault();
        close(top);
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const overlay = el(top);
    const focusable = overlay ? getFocusable(overlay) : [];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!overlay.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  });

  return { open, close, closeAll, topId };
})();

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

// ── アイテム効果（バフ）の保管庫 ────────────────────────────
// アイテムを「使う」と、ここに一時的な効果（バフ）が積まれる。
// 効果が発動するタイミング（サイコロを振る・セッション完了 など）で
// 読み取って消費する仕組み。localStorage に保存して再読み込みでも残る。
//   diceBonus     … 次のサイコロの出目に足す数（1回使うと0に戻る）
//   advantage     … true なら次のサイコロを2回振って良い方を採用（1回で消費）
//   nextSessionXP … 次にセッションを完了したとき足すボーナスXP（1回で消費）
function loadItemBuffs() {
  const def = { diceBonus:0, advantage:false, nextSessionXP:0, fixedDice:0, bestOf3:false, sweep:false };
  try { return Object.assign({}, def, JSON.parse(localStorage.getItem('gq_item_buffs') || 'null') || {}); }
  catch { return def; }
}
function saveItemBuffs() { localStorage.setItem('gq_item_buffs', JSON.stringify(itemBuffs)); }
let itemBuffs = loadItemBuffs();

// ── 時限バフ（24時間など、時間で切れる効果）の保管庫 ──────────
// 📜龍の覚醒(全XP2倍) や 👑覇者の宣言(クエストXP2倍) が使う。
// activeBuffs[キー] = { mul: 倍率, expiresAt: 失効する時刻(ミリ秒) }
// 期限が切れていたら自動で無効（1倍）扱いになり、掃除される。
function loadActiveBuffs() {
  try { return JSON.parse(localStorage.getItem('gq_active_buffs') || 'null') || {}; }
  catch { return {}; }
}
function saveActiveBuffs() { localStorage.setItem('gq_active_buffs', JSON.stringify(activeBuffs)); }
let activeBuffs = loadActiveBuffs();

function getBuffMul(key) {
  const b = activeBuffs[key];
  if (!b) return 1;
  if (Date.now() > b.expiresAt) { delete activeBuffs[key]; saveActiveBuffs(); return 1; }
  return b.mul || 1;
}
function getActiveXpMultiplier()   { return getBuffMul('xpMul'); }     // 全XP倍率（龍の覚醒）
function getQuestXpMultiplier()    { return getBuffMul('questXpMul'); } // クエストXP倍率（覇者の宣言）
function grantTimedBuff(key, mul, hours) {
  activeBuffs[key] = { mul, expiresAt: Date.now() + hours * 3600000 };
  saveActiveBuffs();
  if (typeof renderActiveBuffs === 'function') renderActiveBuffs();
}

// ── 📖 アイテム図鑑：使ったアイテムの記録 ───────────────────
// itemDex[アイテムID] = { count: 使った回数, last: 最後に使った時刻 }
function loadItemDex() {
  try { return JSON.parse(localStorage.getItem('gq_item_dex') || 'null') || {}; }
  catch { return {}; }
}
function saveItemDex() { localStorage.setItem('gq_item_dex', JSON.stringify(itemDex)); }
let itemDex = loadItemDex();
function recordItemUse(id) {
  if (!id) return;
  const e = itemDex[id] || { count: 0, last: 0 };
  e.count += 1;
  e.last = Date.now();
  itemDex[id] = e;
  saveItemDex();
}

let sugorokuData = loadSugorokuData();
let pendingSugorokuRoll = null;
let _sgSpinInt = null, _sgSpinT1 = null, _sgSpinT2 = null, _sgAutoClose = null;
let sgAnimating   = false;         // 歩行アニメ実行中フラグ
let sgPendingWalk = null;          // { fromPos, rollTime } ─ 次の開放時にアニメ再生
let _sgPendingReward = null;       // 到着マスで出すGET演出（装備/アイテム）
let _sgJustRolled    = false;      // 今セッションでサイコロを振った→双六へ誘導

// ═══════════════════════════════════════════════════════
//  EQUIPMENT SYSTEM — DATA
//  ・ITEM_MASTER:   コード内定数（アイテム定義の一覧）
//  ・inventory:     localStorage（gq_inventory）所持アイテムid配列
//  ・equippedItems: localStorage（gq_equipped）カテゴリ→id（or null）
// ═══════════════════════════════════════════════════════
const EQUIPMENT_CATEGORIES = ['head', 'body', 'hand', 'back', 'pet'];
// 装備UIに出すカテゴリ（B-1：ペットはオトモン図鑑へ統合したので装備欄からは除外）
const EQUIPPABLE_CATEGORIES = ['head', 'body', 'hand', 'back'];

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

// effect は { type, value, desc } 形。効果は数値バフではなく「体験の変化」：
//   mood / quote_bias / motiv_style / dice_bonus / streak_protect / comment
// imagePath は PNG 用意後に差し替える。null のうちは emoji が表示される。
const ITEM_MASTER = [
  // ── head（頭装備）─────────────────────────────
  { id:'cap_focus',     name:'集中のキャップ',  category:'head', rarity:'common',
    emoji:'🧢', imagePath:'assets/equipment/head/cap_focus.png',
    effect:{ type:'mood', value:'ember', desc:'タイマーが焚き火の灯に包まれる' },
    flavorText:'被ると、ふと深呼吸したくなる。' },
  { id:'crown_scholar', name:'学者の冠',        category:'head', rarity:'legendary',
    emoji:'👑', imagePath:'assets/equipment/head/crown_scholar.png',
    effect:{ type:'motiv_style', value:'sage', desc:'ヘッダーの言葉が「賢者の格言」になる' },
    flavorText:'知の頂きに立つ者だけに許された輝き。' },

  // ── body（胴装備）─────────────────────────────
  { id:'vest_adventurer', name:'冒険者のベスト', category:'body', rarity:'common',
    emoji:'🦺', imagePath:'assets/equipment/body/vest_adventurer.png',
    effect:{ type:'quote_bias', value:'tale', desc:'「物語と英雄」の言葉に出会いやすくなる' },
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
    effect:{ type:'quote_bias', value:'fable', desc:'「空想の住人」の言葉に出会いやすくなる' },
    flavorText:'今日もどこかへ、何かを掴みに。' },
  { id:'cape_phoenix', name:'不死鳥のマント',    category:'back', rarity:'legendary',
    emoji:'🧥', imagePath:'assets/equipment/back/cape_phoenix.png',
    effect:{ type:'motiv_style', value:'hero', desc:'ヘッダーの言葉が「英雄の言葉」になる' },
    flavorText:'何度倒れても、また燃え上がる羽。' },

  // ── pet（ペット）──────────────────────────────
  { id:'pet_cat', name:'勉強猫',   category:'pet', rarity:'common',
    emoji:'🐈', imagePath:'assets/equipment/pet/pet_cat.svg',
    effect:{ type:'comment', value:'にゃ〜', desc:'たまに励ましてくれる' },
    flavorText:'いつの間にか、隣でひとやすみ。' },
  { id:'pet_owl', name:'物知り梟', category:'pet', rarity:'rare',
    emoji:'🦉', imagePath:'assets/equipment/pet/pet_owl.svg',
    effect:{ type:'comment', value:'…フム。今日の学びも、悪くなかったぞ。', desc:'博識な一言で締めてくれる' },
    flavorText:'静かな夜、君の問いに首をかしげる。' },

  // ═══════════ 追加アイテム（各カテゴリ +4個）═══════════
  // ── head（追加）─────────────────────────────
  { id:'hood_moonlight',  name:'月明かりのフード',  category:'head', rarity:'common',
    emoji:'🌙', imagePath:'assets/equipment/head/hood_moonlight.png',
    effect:{ type:'mood', value:'moonlight', desc:'タイマーが月夜の静けさに包まれる' },
    flavorText:'静かな夜でも、心の灯りは消えない。' },
  { id:'goggles_focus',   name:'集中ゴーグル',      category:'head', rarity:'rare',
    emoji:'🥽', imagePath:'assets/equipment/head/goggles_focus.png',
    effect:{ type:'mood', value:'deepsea', desc:'タイマーが深海の青に包まれる' },
    flavorText:'余計な景色を閉じて、大事なものだけを見る。' },
  { id:'tiara_starlight', name:'星読みのティアラ',  category:'head', rarity:'epic',
    emoji:'💫', imagePath:'assets/equipment/head/tiara_starlight.png',
    effect:{ type:'mood', value:'starlight', desc:'タイマーに星々の瞬きが宿る' },
    flavorText:'小さな努力の星座を、未来へつなげる。' },
  { id:'halo_dawn',       name:'夜明けの光輪',      category:'head', rarity:'legendary',
    emoji:'🌅', imagePath:'assets/equipment/head/halo_dawn.png',
    effect:{ type:'mood', value:'dawn', desc:'タイマーが夜明けの光に包まれる' },
    flavorText:'今日という冒険を、まぶしく始める者の証。' },

  // ── body(追加)─────────────────────────────
  { id:'jacket_morning',      name:'朝活ジャケット',  category:'body', rarity:'common',
    emoji:'🧥', imagePath:'assets/equipment/body/jacket_morning.png',
    effect:{ type:'motiv_style', value:'morning', desc:'ヘッダーの言葉が「朝の応援」になる' },
    flavorText:'袖を通すだけで、少しだけ早く動き出せる。' },
  { id:'apron_creator',       name:'創作のエプロン',  category:'body', rarity:'rare',
    emoji:'👕', imagePath:'assets/equipment/body/apron_creator.png',
    effect:{ type:'quote_bias', value:'artist', desc:'「表現者」の言葉に出会いやすくなる' },
    flavorText:'手を動かす人に、ひらめきは降りてくる。' },
  { id:'coat_guardian',       name:'守り人のコート',  category:'body', rarity:'epic',
    emoji:'🛡️', imagePath:'assets/equipment/body/coat_guardian.png',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'続けてきた日々を、静かに守る頼もしい一着。' },
  { id:'armor_constellation', name:'星座の軽鎧',      category:'body', rarity:'legendary',
    emoji:'🌌', imagePath:'assets/equipment/body/armor_constellation.png',
    effect:{ type:'mood', value:'galaxy', desc:'タイマーが銀河の輝きに包まれる' },
    flavorText:'積み重ねた時間が、胸元で星のように輝く。' },

  // ── hand（追加）─────────────────────────────
  { id:'mug_calm',         name:'ひと息のマグ',   category:'hand', rarity:'common',
    emoji:'☕', imagePath:'assets/equipment/hand/mug_calm.png',
    effect:{ type:'comment', value:'ひと息ついたら、また進もう。', desc:'たまに励ましてくれる' },
    flavorText:'休むことも、前に進むための準備。' },
  { id:'notebook_quest',   name:'冒険者のノート', category:'hand', rarity:'rare',
    emoji:'📓', imagePath:'assets/equipment/hand/notebook_quest.png',
    effect:{ type:'quote_bias', value:'classic', desc:'「古典・偉人」の言葉に出会いやすくなる' },
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
    effect:{ type:'motiv_style', value:'breeze', desc:'ヘッダーの言葉が「そよ風の応援」になる' },
    flavorText:'ほんの少しの追い風が、今日の一歩を軽くする。' },
  { id:'wings_small',        name:'小さな羽',         category:'back', rarity:'rare',
    emoji:'🪽', imagePath:'assets/equipment/back/wings_small.png',
    effect:{ type:'dice_bonus', value:1, desc:'すごろく出目+1' },
    flavorText:'飛べなくてもいい。昨日より少し浮けばいい。' },
  { id:'cloak_silence',      name:'静寂のクローク',   category:'back', rarity:'epic',
    emoji:'🌫️', imagePath:'assets/equipment/back/cloak_silence.png',
    effect:{ type:'mood', value:'silence', desc:'タイマーが澄んだ静寂に包まれる' },
    flavorText:'雑音を遠ざけ、集中だけをそっと包み込む。' },
  { id:'wings_phoenix_gold', name:'黄金不死鳥の翼',   category:'back', rarity:'legendary',
    emoji:'🔥', imagePath:'assets/equipment/back/wings_phoenix_gold.png',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'途切れそうな炎を、もう一度空へ舞い上げる。' },

  // ── pet（追加）──────────────────────────────
  { id:'pet_slime',  name:'ぷるぷるスライム', category:'pet', rarity:'common',
    emoji:'🫧', imagePath:'assets/equipment/pet/pet_slime.svg',
    effect:{ type:'comment', value:'ぷるん。今日もえらい！', desc:'たまに励ましてくれる' },
    flavorText:'何も言わずに、ぷるぷる応援してくれる。' },
  { id:'pet_rabbit', name:'朝駆けうさぎ',     category:'pet', rarity:'rare',
    emoji:'🐇', imagePath:'assets/equipment/pet/pet_rabbit.svg',
    effect:{ type:'comment', value:'ぴょんっと一歩、進めたね。', desc:'たまに励ましてくれる' },
    flavorText:'小さな足音で、やる気を連れてくる。' },
  { id:'pet_fox',    name:'知恵ぎつね',       category:'pet', rarity:'epic',
    emoji:'🦊', imagePath:'assets/equipment/pet/pet_fox.svg',
    effect:{ type:'comment', value:'いい道の選び方だったね。', desc:'賢いひとことをくれる' },
    flavorText:'近道ではなく、賢い道をそっと教えてくれる。' },
  { id:'pet_dragon', name:'ちびドラゴン',     category:'pet', rarity:'legendary',
    emoji:'🐉', imagePath:'assets/equipment/pet/pet_dragon.svg',
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
  recordItemMemory(itemId);   // 出会った瞬間を思い出として刻む
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

// ── アイテムの思い出（gq_item_memories）────────────────
// 入手した瞬間（日付・時間帯・何セッション目か）と、
// 装備して一緒に学んだ時間（分）をアイテムごとに記録する
function loadItemMemories() {
  try { return JSON.parse(localStorage.getItem('gq_item_memories') || '{}'); }
  catch { return {}; }
}
let itemMemories = loadItemMemories();
function saveItemMemories() {
  localStorage.setItem('gq_item_memories', JSON.stringify(itemMemories));
}

function dayPartLabel() {
  const h = new Date().getHours();
  if (h < 5)  return '真夜中';
  if (h < 11) return '朝';
  if (h < 17) return '昼下がり';
  if (h < 22) return '夕暮れ';
  return '夜';
}

function recordItemMemory(itemId) {
  if (itemMemories[itemId]) return;
  itemMemories[itemId] = {
    date: todayKey(),
    part: dayPartLabel(),
    sessions: (typeof data !== 'undefined' && data.sessions) || 0,
    mins: 0,
  };
  saveItemMemories();
}

// 装備中の全アイテムに「ともに歩んだ時間」を加算（セッション完了時に呼ぶ）
function addCompanionMinutes(mins) {
  if (!mins || mins <= 0) return;
  let changed = false;
  EQUIPMENT_CATEGORIES.forEach(cat => {
    const id = equippedItems[cat];
    if (!id) return;
    if (!itemMemories[id]) recordItemMemory(id);
    itemMemories[id].mins = (itemMemories[id].mins || 0) + mins;
    changed = true;
  });
  if (changed) saveItemMemories();
}

// 「2026年6月11日の夜、12回目の冒険のあとに現れた。」のような一文を作る
function itemMemoryText(itemId) {
  const m = itemMemories[itemId];
  if (!m) return '';
  const d = new Date(m.date + 'T00:00:00');
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  const sess = m.sessions > 0
    ? `${m.sessions}回目の冒険のあとに`
    : '冒険を始めたばかりの君のもとに';
  return `${dateStr}の${m.part}、${sess}現れた。`;
}

function companionTimeText(itemId) {
  const mins = (itemMemories[itemId] && itemMemories[itemId].mins) || 0;
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60), mm = mins % 60;
  return `ともに歩んだ時間 ${h > 0 ? h + '時間' : ''}${(mm > 0 || h === 0) ? mm + '分' : ''}`;
}

// 5時間（300分）以上ともに歩んだ装備には「絆」の輝き✨が宿る
const BOND_MINS = 300;
function isBondedItem(itemId) {
  return ((itemMemories[itemId] && itemMemories[itemId].mins) || 0) >= BOND_MINS;
}

// ── 装備の操作ヘルパ ─────────────────────────────────
// 装備する。マスターに無い／未所持なら false
function equipItem(itemId) {
  const item = getItemById(itemId);
  if (!item) return false;
  if (!hasItem(itemId)) return false;
  equippedItems[item.category] = itemId;
  saveEquipped();
  refreshEquipExperience();
  return true;
}

// カテゴリの装備を外す。無効カテゴリなら false
function unequipItem(category) {
  if (!EQUIPMENT_CATEGORIES.includes(category)) return false;
  equippedItems[category] = null;
  saveEquipped();
  refreshEquipExperience();
  return true;
}

// 装備変更を「体験」へ即反映（mood の光・ヘッダーの口調）
function refreshEquipExperience() {
  if (typeof applyEquipMood === 'function') applyEquipMood();
  if (typeof setHeaderMotivation === 'function') setHeaderMotivation();
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
  // B-1：ペットは装備ドロップではなく「卵から孵化」で入手するため抽選プールから除外
  return ITEM_MASTER.filter(m => m.category !== 'pet' && !inventory.includes(m.id));
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
    // ※ペットは getUnownedItems で除外済み（卵から孵化で入手）。装備ドロップでは出ない。
    refreshEquipmentModalIfOpen();
    if (typeof evaluateUnlocks === 'function') evaluateUnlocks();
    return item;
  }
  return null;
}

// ── 装備効果: 体験エフェクト ─────────────────────────────
// XP倍率は廃止。「装備すると世界が少し変わる」体験効果に全振り。
// type 一覧：
//   mood        … タイマーまわりの雰囲気（光・色）が変わる
//   quote_bias  … そのカテゴリの言葉に出会いやすくなる
//   motiv_style … ヘッダーの応援メッセージの口調が変わる
//   dice_bonus / streak_protect / comment … 従来どおり
function getEquippedEffectItem(type) {
  const equipped = getEquippedItems();
  for (const cat of EQUIPMENT_CATEGORIES) {
    const item = equipped[cat];
    if (item && item.effect && item.effect.type === type) return item;
  }
  return null;
}

// 装備効果 mood：タイマーまわりの雰囲気を変える（bodyにクラス付与）
const EQUIP_MOODS = ['ember','moonlight','deepsea','starlight','dawn','galaxy','silence'];
function applyEquipMood() {
  const b = document.body;
  if (!b) return;
  EQUIP_MOODS.forEach(m => b.classList.remove('eq-mood-' + m));
  const item = getEquippedEffectItem('mood');
  if (item && EQUIP_MOODS.includes(item.effect.value)) {
    b.classList.add('eq-mood-' + item.effect.value);
  }
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
  // 基本出目を決める（アイテム効果を反映）
  let baseDice;
  if (itemBuffs.fixedDice) {
    // 🧭運命の羅針盤：選んだ出目を確定で使用
    baseDice = Math.max(1, Math.min(6, itemBuffs.fixedDice));
    itemBuffs.fixedDice = 0; saveItemBuffs();
  } else {
    baseDice = rollDice(modeKey, mins, partial);
    if (itemBuffs.advantage) {
      // 🏮導きの灯：2回振って良い方
      baseDice = Math.max(baseDice, rollDice(modeKey, mins, partial));
      itemBuffs.advantage = false; saveItemBuffs();
    } else if (itemBuffs.bestOf3) {
      // ⏳時の砂：3回振って一番大きい出目
      baseDice = Math.max(baseDice, rollDice(modeKey, mins, partial), rollDice(modeKey, mins, partial));
      itemBuffs.bestOf3 = false; saveItemBuffs();
    }
  }
  // 基本出目 + 装備の dice_bonus + アイテムの一時ボーナスを加算
  const diceBonus = getEquipmentDiceBonus() + (itemBuffs.diceBonus || 0);
  if (itemBuffs.diceBonus) { itemBuffs.diceBonus = 0; saveItemBuffs(); }  // 使ったら0に戻す
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
        _sgPendingReward = granted;      // 到着マスで演出（即時には出さない）
        message = `🎁 装備獲得：${granted.emoji} ${granted.name}！ (+${bonusXP} XP)`;
      } else {
        // 全装備所持済み → 代替ボーナスXPで補償
        addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
        message = `🎁 全装備を発見済み！装備発見 +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
      }
    } else {
      message = `⭐ レア！${itemGained.emoji}「${itemGained.name}」を獲得！ (+${bonusXP} XP)`;
      sugorokuData.items.push({ ...itemGained, pos: newPos, date: Date.now() });
      _sgPendingReward = { name: itemGained.name, emoji: itemGained.emoji,
        rarity: itemGained.rare ? 'rare' : 'common',
        effect: { desc: `+${itemGained.xp} XP` },
        flavorText: 'すごろくで出会った、ひとつの縁。' };
    }
  } else if (cellType === 'item') {
    // 🥚 一定確率で「目覚めアイテム」を拾う（オトモンの孵化用）
    const wakeReward = window.Otomon ? window.Otomon.maybeGrantWakeItem(sugorokuData.stage) : null;
    if (wakeReward) {
      bonusXP = 8; evClass = 'ev-item';
      _sgPendingReward = wakeReward;
      message = `${wakeReward.emoji} 目覚めアイテム「${wakeReward.name}」を拾った！ ＋${bonusXP} XP`;
    } else {
      itemGained = sgPickItem(false);
      bonusXP = itemGained.xp;
      evClass = 'ev-item';
      if (itemGained.type === 'equipment') {
        const granted = grantRandomEquipmentItem();
        if (granted) {
          _sgPendingReward = granted;      // 到着マスで演出（即時には出さない）
          message = `🎁 装備獲得：${granted.emoji} ${granted.name}！ (+${bonusXP} XP)`;
        } else {
          // 全装備所持済み → 代替ボーナスXPで補償
          addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
          message = `🎁 全装備を発見済み！装備発見 +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
        }
      } else {
        message = `${itemGained.emoji}「${itemGained.name}」を獲得！ (+${bonusXP} XP)`;
        sugorokuData.items.push({ ...itemGained, pos: newPos, date: Date.now() });
        _sgPendingReward = { name: itemGained.name, emoji: itemGained.emoji,
          rarity: itemGained.rare ? 'rare' : 'common',
          effect: { desc: `+${itemGained.xp} XP` },
          flavorText: 'すごろくで出会った、ひとつの縁。' };
      }
    }
  } else if (cellType === 'event') {
    bonusXP = 20;
    evClass = 'ev-event';
    // 🥚 オトモンの卵を拾う（otomon.js 未読込でも落ちないよう存在チェック）
    const eggReward = window.Otomon ? window.Otomon.maybeDropEgg(sugorokuData.stage) : null;
    if (eggReward) {
      _sgPendingReward = eggReward;   // 到着マスのGET演出に流す
      message = `🥚 オトモンの卵「${eggReward.name}」を見つけた！ ボーナス +${bonusXP} XP`;
    } else {
      message = `✨ イベントマス！特別な学びの場。 ボーナス +${bonusXP} XP`;
    }
  } else if (cellType === 'checkpoint') {
    bonusXP = 15;
    evClass = 'ev-checkpoint';
    message = `🏁 チェックポイント ${cellNum}マス！ ボーナス +${bonusXP} XP`;
  } else {
    bonusXP = 5;
    evClass = 'ev-normal';
    message = `順調に進んでいます！ +${bonusXP} XP`;
  }

  // 🔦探索の灯：通り過ぎたマス（着地マスの手前まで）のアイテムも回収
  if (itemBuffs.sweep) {
    itemBuffs.sweep = false; saveItemBuffs();
    let swept = 0, sweptXP = 0;
    for (let p = prevPos + 1; p < newPos; p++) {
      const ct = BOARD_CELL_TYPES[sgGetCellNum(p)] || 'normal';
      if (ct === 'item' || ct === 'rare') {
        let it = sgPickItem(false);
        if (it.type === 'equipment') it = SUGOROKU_ITEMS.find(x => x.id === 'study_book') || it;
        sugorokuData.items.push({ ...it, pos: p, date: Date.now() });
        swept++; sweptXP += it.xp || 0;
      }
    }
    if (swept > 0) {
      addBonusXP(sweptXP);
      message += `<br>🔦 道中で ${swept}個 のアイテムを回収！ (+${sweptXP} XP)`;
    }
  }

  // 装備の dice_bonus が乗っている場合だけ出目の内訳を表示
  if (diceBonus > 0) {
    message = `🎲 出目 ${baseDice} + 装備ボーナス ${diceBonus} = ${finalDice}<br>` + message;
  }

  saveSugorokuData();
  sgPendingWalk = { fromPos: prevPos, rollTime: Date.now() };
  _sgJustRolled = true;
  return { roll, prevPos, newPos, cellNum, cellType, bonusXP, message, evClass };
}

function addBonusXP(xp) {
  if (!xp || xp <= 0) return;
  xp = Math.round(xp * getActiveXpMultiplier());   // 📜龍の覚醒中は全ボーナスXPも倍率
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
// 旧スプライトPNG方式は廃止。新ドット絵コマ（SVG）をホップさせて歩かせる

function sgMoveDir(fromN, toN) {
  const {x: x1, y: y1} = sgCellXY(fromN);
  const {x: x2, y: y2} = sgCellXY(toN);
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

// マスの上できらきら弾けるパーティクル（種別ごとに演出が違う）
function spawnSgBurst(cellN, color, type) {
  const wrap = document.getElementById('board-svg-wrapper');
  const p = getWalkerCellPos(cellN);
  if (!wrap || !p) return;
  const b = document.createElement('div');
  const cx = p.left + p.size / 2, cy = p.top + p.size / 2;
  b.style.left = cx + 'px'; b.style.top = cy + 'px';

  if (type === 'item') {
    // 金色コイン雨
    b.className = 'sg-burst sg-big';
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span');
      const ang = (i / 12) * Math.PI * 2;
      const dist = 18 + Math.random() * 18;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      s.style.background = i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#fde68a' : '#f59e0b';
      s.style.boxShadow = '0 0 10px #fbbf24';
      s.style.width = s.style.height = (7 + Math.random() * 5) + 'px';
      s.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      b.appendChild(s);
    }
  } else if (type === 'rare') {
    // 星のシャワー（多め・大きめ）
    b.className = 'sg-burst sg-big sg-star';
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 22 + Math.random() * 22;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      const colors = ['#fbbf24','#c4b5fd','#a5f3fc','#fde68a','#f9a8d4'];
      s.style.background = colors[i % colors.length];
      s.style.boxShadow = `0 0 12px ${s.style.background}`;
      s.style.width = s.style.height = (5 + Math.random() * 7) + 'px';
      s.style.borderRadius = '2px';
      s.style.transform = 'rotate(45deg)';
      s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      b.appendChild(s);
    }
    // 追加リップルリング
    const ring = document.createElement('div');
    ring.className = 'sg-arrive-ring';
    ring.style.setProperty('--ring-color', '#c4b5fd');
    b.appendChild(ring);
  } else if (type === 'checkpoint') {
    // 紙吹雪（カラフルな四角）
    b.className = 'sg-burst sg-confetti';
    const palette = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 20 + Math.random() * 20;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist - 10).toFixed(1) + 'px');
      s.style.setProperty('--rot', (90 + Math.random() * 180).toFixed(0) + 'deg');
      s.style.background = palette[i % palette.length];
      s.style.width = (5 + Math.random() * 4) + 'px';
      s.style.height = (7 + Math.random() * 5) + 'px';
      s.style.borderRadius = '1px';
      s.style.animationDelay = (Math.random() * 0.1).toFixed(2) + 's';
      b.appendChild(s);
    }
  } else if (type === 'event') {
    // エネルギー放射（渦巻き光線）
    b.className = 'sg-burst sg-big';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      const ang = (i / 10) * Math.PI * 2;
      const dist = 16 + Math.random() * 14;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      const colors = ['#ff8a93','#ffa0ac','#ff6b6b','#ffd93d'];
      s.style.background = colors[i % colors.length];
      s.style.boxShadow = `0 0 10px ${s.style.background}`;
      s.style.width = (4 + Math.random() * 4) + 'px';
      s.style.height = (10 + Math.random() * 8) + 'px';
      s.style.borderRadius = '3px';
      s.style.animationDelay = (Math.random() * 0.1).toFixed(2) + 's';
      b.appendChild(s);
    }
  } else {
    // デフォルト（到着・通常）
    b.className = 'sg-burst';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 15 + Math.random() * 14;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      s.style.background = color;
      s.style.boxShadow = '0 0 8px currentColor';
      s.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      b.appendChild(s);
    }
    // 到着リップル
    const ring = document.createElement('div');
    ring.className = 'sg-arrive-ring';
    ring.style.setProperty('--ring-color', color);
    b.appendChild(ring);
  }

  wrap.appendChild(b);
  setTimeout(() => b.remove(), type === 'rare' ? 1300 : 1000);
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
  // 選択中タイプの新ドット絵コマをそのまま歩かせる
  walkerEl.innerHTML = buildKomaSVG('100%', '100%');

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
  walkerEl.classList.add('koma-hop');
  walkerEl.style.left       = startP.left + 'px';
  walkerEl.style.top        = startP.top  + 'px';
  walkerEl.style.transition = 'none';
  walkerEl.style.display    = 'block';

  let prevN = fromPos > 0 ? fromCellN : 1;
  const totalSteps = path.length;

  for (let si = 0; si < totalSteps; si++) {
    const nextN = path[si];
    const dir   = sgMoveDir(prevN, nextN);
    const nextP = getWalkerCellPos(nextN);
    if (!nextP) break;

    const flip = dir === 'left' ? 'scaleX(-1)' : '';

    // スピード設計：最初タメ→中盤疾走→ゴール前2マスでスローイン
    const isFirst = si === 0;
    const isLast2 = si >= totalSteps - 2;
    const stepMs  = isFirst ? 640 : isLast2 ? 500 : 240;
    const easing  = isFirst ? 'ease-out' : isLast2 ? 'ease-in-out' : 'linear';

    // 最初の一歩：大きくジャンプ予備動作
    if (isFirst) {
      walkerEl.style.transform = flip ? flip + ' scaleY(1.4) scaleX(.75)' : 'scaleY(1.4) scaleX(.75)';
      await new Promise(r => setTimeout(r, 120));
    }

    walkerEl.style.transform = flip;
    walkerEl.style.transition = `left ${stepMs}ms ${easing}, top ${stepMs}ms ${easing}`;
    walkerEl.style.left = nextP.left + 'px';
    walkerEl.style.top  = nextP.top  + 'px';

    await new Promise(r => setTimeout(r, stepMs + 20));

    // 特別マスに乗った瞬間の演出（種別ごとに異なる）
    const _ct = BOARD_CELL_TYPES[nextN];
    if (_ct === 'item')            spawnSgBurst(nextN, '#ffd984', 'item');
    else if (_ct === 'rare')       spawnSgBurst(nextN, '#d8b4fe', 'rare');
    else if (_ct === 'event')      spawnSgBurst(nextN, '#ff8a93', 'event');
    else if (_ct === 'checkpoint') spawnSgBurst(nextN, '#ffb46a', 'checkpoint');
    prevN = nextN;
  }

  // 到着：正面向きに戻してホップ停止→着地バウンド→祝福バースト
  walkerEl.style.transition = 'none';
  walkerEl.style.transform = '';
  walkerEl.classList.remove('koma-hop');
  walkerEl.classList.add('koma-land');
  setTimeout(() => walkerEl.classList.remove('koma-land'), 600);
  spawnSgBurst(toCellN, '#7fe3f0', 'default');

  // ゾーン突入時にバナーを表示
  const fromZoneIdx = Math.floor((fromCellN - 1) / 10);
  const toZoneIdx   = Math.floor((toCellN - 1) / 10);
  if (toZoneIdx !== fromZoneIdx || fromPos === 0) {
    const newZ = SG_ZONES[toZoneIdx];
    const wrap = document.getElementById('board-svg-wrapper');
    if (wrap && newZ) {
      const banner = document.createElement('div');
      banner.className = 'sg-zone-banner';
      banner.textContent = `${newZ.emoji} ${newZ.name} へ突入！`;
      banner.style.color = newZ.accent;
      banner.style.background = `rgba(${newZ.rgb},.18)`;
      banner.style.border = `1px solid ${newZ.accent}55`;
      wrap.appendChild(banner);
      setTimeout(() => banner.remove(), 2600);
    }
  }

  await new Promise(r => setTimeout(r, 280));

  sgAnimating = false;
  walkerEl.style.display = 'none';
  renderBoard(); // ドット絵アバターを表示して再描画

  // 到着マスで「今手に入れたもの」のGET演出を出す
  if (_sgPendingReward) {
    const reward = _sgPendingReward;
    _sgPendingReward = null;
    setTimeout(() => showEquipmentGetModal(reward), 450);
  }
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

// ── すごろくゾーン定義（10マスごとに世界が変わる）──
const SG_ZONES = [
  { start:1,  end:10,  name:'草　原',   terrain:'grassland', emoji:'🌿', accent:'#86efac', rgb:'134,239,172' },
  { start:11, end:20,  name:'深い森',   terrain:'forest',    emoji:'🌲', accent:'#4ade80', rgb:'74,222,128'  },
  { start:21, end:30,  name:'洞　窟',   terrain:'cave',      emoji:'💎', accent:'#a78bfa', rgb:'167,139,250' },
  { start:31, end:40,  name:'古代遺跡', terrain:'ruins',     emoji:'🏛', accent:'#fb923c', rgb:'251,146,60'  },
  { start:41, end:50,  name:'砂　漠',   terrain:'desert',    emoji:'🌵', accent:'#fbbf24', rgb:'251,191,36'  },
  { start:51, end:60,  name:'大海原',   terrain:'ocean',     emoji:'🌊', accent:'#38bdf8', rgb:'56,189,248'  },
  { start:61, end:70,  name:'凍る雪山', terrain:'snow',      emoji:'❄️', accent:'#bae6fd', rgb:'186,230,253' },
  { start:71, end:80,  name:'天空の城', terrain:'sky',       emoji:'☁️', accent:'#c4b5fd', rgb:'196,181,253' },
  { start:81, end:90,  name:'火　山',   terrain:'volcano',   emoji:'🔥', accent:'#f87171', rgb:'248,113,113' },
  { start:91, end:100, name:'龍の城',   terrain:'dragon',    emoji:'🐉', accent:'#fbbf24', rgb:'220,38,38'   },
];

// ── 地形×タイプ別スポット絵文字 ──
const SPOT_ICONS = {
  grassland: { normal:'🌸', item:'🗺', event:'👤', rare:'⛩', checkpoint:'🏕', goal:'🌳' },
  forest:    { normal:'🍄', item:'🎁', event:'🌲', rare:'🌺', checkpoint:'🔥', goal:'🌳' },
  cave:      { normal:'🪨', item:'💎', event:'🌊', rare:'✨', checkpoint:'🏮', goal:'🌳' },
  ruins:     { normal:'🏛', item:'📜', event:'🪆', rare:'🗝', checkpoint:'⚔', goal:'🌳' },
  desert:    { normal:'🌵', item:'🏺', event:'🐍', rare:'💰', checkpoint:'⛺', goal:'🌳' },
  ocean:     { normal:'🌊', item:'🐚', event:'🐋', rare:'🏴', checkpoint:'⛵', goal:'🌳' },
  snow:      { normal:'❄', item:'🧊', event:'🐺', rare:'💫', checkpoint:'🏔', goal:'🌳' },
  sky:       { normal:'☁', item:'🎀', event:'🦅', rare:'🌈', checkpoint:'🏰', goal:'🌳' },
  volcano:   { normal:'🌋', item:'🔱', event:'🔥', rare:'💀', checkpoint:'🏯', goal:'🌳' },
  dragon:    { normal:'🐲', item:'💎', event:'⚡', rare:'👑', checkpoint:'🏯', goal:'🏆' },
};

// ── ゾーンパーティクル絵文字 ──
const ZONE_PARTICLES = {
  grassland: ['🌸','🍃','🌼','🌸','🍃'],
  forest:    ['🍂','🍃','🌿','🍂','🍃'],
  cave:      ['✨','💎','✦','✨','💫'],
  ruins:     ['✦','·','✦','·','✦'],
  desert:    ['·','·','·','·','·'],
  ocean:     ['🌊','💧','🫧','🌊','💧'],
  snow:      ['❄','❄','✦','❄','❄'],
  sky:       ['☁','☁','✨','☁','✦'],
  volcano:   ['🔥','✦','🔥','✦','✦'],
  dragon:    ['⚡','✦','⚡','✦','🔥'],
};

function buildBoardSVG() {
  const CS = 36, STEP = 38, PAD = 11, W = 400;
  const curCell = sgGetCellNum(sugorokuData.pos);
  const curZoneIdx = sugorokuData.pos > 0 ? Math.floor((curCell - 1) / 10) : -1;

  const TYPE_BG = {
    normal:     null,
    checkpoint: 'rgba(251,146,60,.22)',
    item:       'rgba(6,182,212,.18)',
    event:      'rgba(230,57,70,.18)',
    rare:       'rgba(251,191,36,.2)',
    goal:       'rgba(251,191,36,.3)',
  };
  const TYPE_STROKE = {
    normal:     null,
    checkpoint: 'rgba(251,146,60,.55)',
    item:       'rgba(6,182,212,.5)',
    event:      'rgba(230,57,70,.5)',
    rare:       'rgba(251,191,36,.6)',
    goal:       '#fbbf24',
  };
  const TYPE_EMOJI = { checkpoint:'🏁', item:'📦', event:'✨', rare:'⭐', goal:'🏆' };

  let parts = [`<defs>
    <style>
      .sg-pulse { animation: sgPulse .9s ease-in-out infinite; }
      .sg-pulse2 { animation: sgPulse 1.4s ease-in-out infinite .45s; }
      .sg-pulse3 { animation: sgPulse 1.9s ease-in-out infinite .9s; }
      @keyframes sgPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
    </style>
  </defs>`];

  // ── ゾーン背景（行ごとに世界観が変わる）──
  for (let zi = 0; zi < SG_ZONES.length; zi++) {
    const z = SG_ZONES[zi];
    const rowIdx = zi;
    const gy = 9 - rowIdx;
    const ry = PAD + gy * STEP - 1;
    const isCurZone = zi === curZoneIdx;
    const isPastZone = zi < curZoneIdx;
    const alpha = isCurZone ? 0.18 : isPastZone ? 0.10 : 0.07;
    // 帯状背景
    parts.push(`<rect x="${PAD-2}" y="${ry}" width="${9*STEP+CS+4}" height="${CS+2}" rx="7" fill="rgba(${z.rgb},${alpha})"/>`);
    // ゾーン境界線（上端）
    if (rowIdx > 0) {
      const lAlpha = isCurZone ? 0.45 : 0.18;
      parts.push(`<line x1="${PAD}" y1="${ry-1}" x2="${PAD+9*STEP+CS}" y2="${ry-1}" stroke="rgba(${z.rgb},${lAlpha})" stroke-width="1"/>`);
    }
    // ゾーン名の薄い透かし文字
    const wmX = PAD + (9*STEP + CS) / 2;
    const wmY = ry + CS/2 + 4;
    const wmAlpha = isCurZone ? 0.13 : 0.05;
    parts.push(`<text x="${wmX}" y="${wmY}" text-anchor="middle" dominant-baseline="central" font-size="20" fill="rgba(${z.rgb},${wmAlpha})" font-family="serif" font-weight="bold">${z.name}</text>`);
    // ゾーンエモジ（行の端）
    const isRtl = rowIdx % 2 === 1;
    const emX = isRtl ? PAD + 9*STEP + CS - 3 : PAD + 3;
    const emAnchor = isRtl ? 'end' : 'start';
    const emAlpha = isCurZone ? 0.85 : isPastZone ? 0.4 : 0.55;
    parts.push(`<text x="${emX}" y="${wmY}" text-anchor="${emAnchor}" dominant-baseline="central" font-size="10" opacity="${emAlpha}">${z.emoji}</text>`);
  }

  // ── 接続ライン ──
  for (let n = 1; n <= 99; n++) {
    const a = sgCellXY(n), b = sgCellXY(n + 1);
    const passed = n < curCell;
    const zi = Math.floor((n - 1) / 10);
    const zRgb = SG_ZONES[zi].rgb;
    parts.push(`<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="${passed ? `rgba(${zRgb},.45)` : 'rgba(255,255,255,.05)'}" stroke-width="${passed ? 2.5 : 1.5}"/>`);
  }

  // ── マス ──
  for (let n = 1; n <= 100; n++) {
    const { x, y, cx, cy } = sgCellXY(n);
    const type = BOARD_CELL_TYPES[n];
    const isCur = n === curCell && sugorokuData.pos > 0;
    const isPassed = n < curCell;
    const zi = Math.floor((n - 1) / 10);
    const z = SG_ZONES[zi];
    const hue = (n * 3.6 + 200) % 360;

    // 背景色：通過済み=虹色, 特別マス=タイプ色, 通常=ゾーン色
    const bg = isPassed
      ? `hsla(${hue},70%,62%,.15)`
      : (TYPE_BG[type] || `rgba(${z.rgb},.06)`);
    // 枠色
    const st = isCur
      ? z.accent
      : isPassed
        ? `hsla(${hue},70%,70%,.35)`
        : (TYPE_STROKE[type] || `rgba(${z.rgb},.22)`);
    const sw = isCur ? 2 : isPassed ? 1.2 : 1;

    parts.push(`<rect x="${x}" y="${y}" width="${CS}" height="${CS}" rx="6" fill="${bg}" stroke="${st}" stroke-width="${sw}"/>`);

    // マス番号
    const numOpacity = isPassed ? 0.2 : isCur ? 0 : 0.3;
    if (numOpacity > 0) {
      parts.push(`<text x="${x+CS-2}" y="${y+CS-2}" text-anchor="end" font-size="7" fill="rgba(232,232,240,${numOpacity})" font-family="sans-serif">${n}</text>`);
    }

    // 種別エモジ
    const em = TYPE_EMOJI[type];
    if (em && !isCur && !isPassed) {
      parts.push(`<text x="${cx}" y="${cy+1}" text-anchor="middle" dominant-baseline="central" font-size="13" opacity=".75">${em}</text>`);
    }

    // 未踏特別マスのキラキラ（ゾーンカラー版）
    if (!isCur && !isPassed && (type === 'item' || type === 'event' || type === 'checkpoint' || type === 'rare')) {
      const tw = type === 'item' ? '#ffe9a8' : type === 'event' ? '#ffb3ba'
               : type === 'rare' ? '#d8b4fe' : '#ffd2a8';
      parts.push(`<circle cx="${x+CS-6}" cy="${y+6}" r="2" fill="${tw}">
        <animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="${(n%8)*0.27}s" repeatCount="indefinite"/>
      </circle>`);
      if (type === 'rare') {
        parts.push(`<circle cx="${x+6}" cy="${y+CS-6}" r="1.6" fill="#a5f3fc">
          <animate attributeName="opacity" values="0;1;0" dur="1.4s" begin="${(n%5)*0.31}s" repeatCount="indefinite"/>
        </circle>`);
      }
    }

    // ゴール(100)：金のリング呼吸
    if (n === 100 && !isCur) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${CS/2-3}" fill="none" stroke="#fbbf24" stroke-width="1.5">
        <animate attributeName="r" values="${CS/2-5};${CS/2-2};${CS/2-5}" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".3;.85;.3" dur="2.6s" repeatCount="indefinite"/>
      </circle>`);
    }

    // 現在地マーカー（ゾーンカラーで三重リング）
    if (isCur) {
      const acc = z.accent;
      const rgb = z.rgb;
      // 外側に広がるパルスリング
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${CS/2+5}" fill="none" stroke="${acc}" stroke-width="1" class="sg-pulse3" opacity=".5"/>`);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${CS/2+2}" fill="none" stroke="${acc}" stroke-width="1.2" class="sg-pulse2" opacity=".7"/>`);
      // 現在マス本体
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${CS/2-1}" fill="rgba(${rgb},.25)" stroke="${acc}" stroke-width="2" class="sg-pulse"/>`);
      if (!sgAnimating) {
        const _av = buildKomaSVG(CS, CS);
        const _in = _av.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
        parts.push(`<svg x="${x}" y="${y}" width="${CS}" height="${CS}" viewBox="0 0 160 200" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet">${_in}</svg>`);
      }
    }
  }

  // ── 歩いた道のり：ゾーンカラーの足あとライン ──
  for (let i = 1; i <= curCell - 2; i++) {
    const a = sgCellXY(i), b = sgCellXY(i+1);
    const lh = (i * 3.6 + 200) % 360;
    const zi = Math.floor((i-1)/10);
    const zRgb = SG_ZONES[zi].rgb;
    parts.push(`<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}"
      stroke="rgba(${zRgb},.65)" stroke-width="3.5" stroke-linecap="round"/>`);
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', W);
  svg.innerHTML = parts.join('');
  return svg;
}

// ── アイテムの次セッション連携ヒント ──
const ITEM_NEXT_HINTS = {
  focus_gem:    ['💎 精神集中',     '次のセッション完了で +20 XP'],
  sage_staff:   ['🪄 知恵の加護',   '次のサイコロに +2'],
  study_book:   ['📕 知識の解放',   '自信ゲージが +15 育ちます'],
  lucky_coin:   ['🎲 幸運の目',     '次のサイコロに +1'],
  compass:      ['🧭 運命の羅針盤', '次の出目を 1〜6 から選べる'],
  torch:        ['🔦 探索の灯',     '通り道のアイテムを全部拾える'],
  crown:        ['👑 覇者の宣言',   '24時間クエスト達成XPが 2倍'],
  hourglass:    ['⏳ 時の砂',       '次のサイコロを3回振って最大'],
  shield:       ['🛡 鉄壁の守護',   '🧊フリーズが1つ増え連続記録を守る'],
  lantern:      ['🏮 導きの灯',     '次のサイコロを2回振り良い方を採用'],
  // ── レア ──
  legend_gem:   ['🌟 天運の輝き',   '+50 XP & 次のサイコロ +3'],
  dragon_scroll:['🐉 龍の覚醒',     '24時間すべてのXPが 2倍'],
  phoenix:      ['🪶 不死の加護',   '連続記録が復活＋🧊＋30 XP'],
  cosmic_orb:   ['🔮 宇宙ガチャ',   '強力バフ3つをランダムGET'],
  golden_key:   ['🗝 封印解放',     'ランダムな装備を1つ入手'],
};

// ── アイテムを「使う」ときの効果定義 ────────────────────────
// confirm … 使う前の確認ダイアログに出す効果説明
// apply() … 実際に効果を発動する関数。戻り値はトーストに出すメッセージ
//           （null を返すと専用トーストは出さない＝別のトーストに任せる）
// ここに無いアイテムは「近日実装予定」と表示され、消費されない。
const ITEM_EFFECTS = {
  // ── 一時バフ系（次のサイコロ・次のセッションに効く）──
  lucky_coin: {
    confirm: '次のサイコロの出目に +1',
    apply() { itemBuffs.diceBonus += 1; saveItemBuffs(); return '🎲 次のサイコロに +1！'; },
  },
  sage_staff: {
    confirm: '次のサイコロの出目に +2',
    apply() { itemBuffs.diceBonus += 2; saveItemBuffs(); return '🪄 次のサイコロに +2！'; },
  },
  lantern: {
    confirm: '次のサイコロを2回振って、良い方の出目を採用',
    apply() { itemBuffs.advantage = true; saveItemBuffs(); return '🏮 次のサイコロは2回振り！良い方を採用'; },
  },
  focus_gem: {
    confirm: '次にセッションを完了したとき +20 XP ボーナス',
    apply() { itemBuffs.nextSessionXP += 20; saveItemBuffs(); return '💎 次のセッション完了で +20XP を予約！'; },
  },
  // ── 即時系（使った瞬間に効果が出る）──
  study_book: {
    confirm: '自信ゲージを +15 育てる',
    apply() { addConfidence(15, 'item_study_book'); return null; },   // 自信トーストに任せる
  },
  shield: {
    confirm: '🧊フリーズを1つ補充（連続記録の保険）',
    apply() {
      data.freezeItems = Math.min(3, (data.freezeItems || 0) + 1);
      saveData(data);
      if (typeof renderStreak === 'function') renderStreak();
      return '🛡 フリーズ +1（連続記録を1日守れる）';
    },
  },
  // ── レア（強力な複合効果）──
  legend_gem: {
    confirm: '+50 XP ＆ 次のサイコロに +3 の二重バフ',
    apply() {
      addBonusXP(50);
      itemBuffs.diceBonus += 3; saveItemBuffs();
      return '🌟 +50XP ＆ 次のサイコロ +3！';
    },
  },
  phoenix: {
    confirm: 'ストリークを復活（0なら1へ）＋🧊フリーズ補充＋30 XP',
    apply() {
      if ((data.streak || 0) === 0) data.streak = 1;
      data.freezeItems = Math.min(3, (data.freezeItems || 0) + 1);
      saveData(data);
      addBonusXP(30);
      if (typeof renderStreak === 'function') renderStreak();
      return '🪶 不死の加護！連続記録が復活＋30XP';
    },
  },
  golden_key: {
    confirm: 'ランダムな装備を1つ解錠して入手',
    apply() {
      const g = grantRandomEquipmentItem();
      if (g) return `🗝 ${g.emoji}「${g.name}」を入手！`;
      addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
      return `🗝 全装備を所持済み！代わりに +${EQUIPMENT_DUPLICATE_COMPENSATION_XP}XP`;
    },
  },
  // ── サイコロ・移動系（次のサイコロに作用）──
  compass: {
    picker: true,                       // 専用の出目選択UIを開く（useItemで分岐）
    open() { openDicePicker(); },
  },
  hourglass: {
    confirm: '次のサイコロを3回振って、一番大きい出目を採用',
    apply() { itemBuffs.bestOf3 = true; saveItemBuffs(); return '⏳ 時の砂！次のサイコロは3回振って最大'; },
  },
  torch: {
    confirm: '次に進むとき、通り道のマスのアイテムも全部拾う',
    apply() { itemBuffs.sweep = true; saveItemBuffs(); return '🔦 探索の灯！次は道中のアイテムも回収'; },
  },
  // ── 時限バフ系（24時間つづく）──
  crown: {
    confirm: '24時間、クエスト達成XPが 2倍 になる',
    apply() { grantTimedBuff('questXpMul', 2, 24); return '👑 覇者の宣言！24時間クエストXP2倍'; },
  },
  dragon_scroll: {
    confirm: '24時間、すべてのXP獲得が 2倍 になる超強化',
    apply() { grantTimedBuff('xpMul', 2, 24); return '🐉 龍の覚醒！24時間ぜんぶのXPが2倍'; },
  },
  cosmic_orb: {
    confirm: 'ランダムな強力バフを 3つ 同時に獲得（中身はお楽しみ）',
    apply() { return applyCosmicGacha(); },
  },
};

// 🔮宇宙ガチャ：候補からランダムに3つ選んで発動
function applyCosmicGacha() {
  const pool = [
    { label: '全XP2倍(24h)',     run: () => grantTimedBuff('xpMul', 2, 24) },
    { label: 'クエストXP2倍(24h)', run: () => grantTimedBuff('questXpMul', 2, 24) },
    { label: '次サイコロ+3',      run: () => { itemBuffs.diceBonus += 3; saveItemBuffs(); } },
    { label: '即時+40XP',         run: () => addBonusXP(40) },
    { label: '🧊フリーズ+1',      run: () => { data.freezeItems = Math.min(3, (data.freezeItems || 0) + 1); saveData(data); if (typeof renderStreak === 'function') renderStreak(); } },
    { label: '自信+20',           run: () => addConfidence(20, 'item_cosmic') },
    { label: '次セッション+30XP',  run: () => { itemBuffs.nextSessionXP += 30; saveItemBuffs(); } },
  ];
  const idxs = pool.map((_, i) => i);
  const picks = [];
  for (let k = 0; k < 3 && idxs.length; k++) {
    const pi = idxs.splice(Math.floor(Math.random() * idxs.length), 1)[0];
    pool[pi].run();
    picks.push(pool[pi].label);
  }
  return '🔮 宇宙ガチャ！ ' + picks.join(' / ');
}

// 🧭運命の羅針盤：次の出目を選ぶ小モーダル
function openDicePicker() {
  closeDicePicker();
  const ov = document.createElement('div');
  ov.id = 'dice-picker-overlay';
  ov.innerHTML =
    '<div class="dpk-card">' +
      '<div class="dpk-title">🧭 運命の羅針盤</div>' +
      '<div class="dpk-sub">次のサイコロの出目を選んでください</div>' +
      '<div class="dpk-grid">' +
        [1,2,3,4,5,6].map(n => `<button class="dpk-btn" onclick="pickFixedDice(${n})">${n}</button>`).join('') +
      '</div>' +
      '<button class="dpk-cancel" onclick="closeDicePicker()">やめる</button>' +
    '</div>';
  document.body.appendChild(ov);
}
function closeDicePicker() {
  const e = document.getElementById('dice-picker-overlay');
  if (e) e.remove();
}

// 📖 アイテム図鑑モーダル
function openItemDex() {
  closeItemDex();
  const all = SUGOROKU_ITEMS.filter(it => it.id !== 'equipment_drop');
  const usedCount = all.filter(it => (itemDex[it.id] || {}).count > 0).length;
  const cards = all.map(it => {
    const e = itemDex[it.id];
    const hint = ITEM_NEXT_HINTS[it.id];
    if (e && e.count > 0) {
      return `<div class="dex-card${it.rare ? ' is-rare' : ''}">
        <div class="dex-emoji">${it.emoji}</div>
        <div class="dex-name">${it.name}</div>
        <div class="dex-eff">${hint ? hint[1] : ''}</div>
        <div class="dex-count">×${e.count} 使用</div>
      </div>`;
    }
    return `<div class="dex-card is-locked">
      <div class="dex-emoji">❔</div>
      <div class="dex-name">？？？</div>
      <div class="dex-eff">まだ使っていない</div>
    </div>`;
  }).join('');
  const ov = document.createElement('div');
  ov.id = 'item-dex-overlay';
  ov.innerHTML = `<div class="dex-wrap">
    <div class="dex-head">
      <div class="dex-title">📖 アイテム図鑑</div>
      <button class="dex-close" onclick="closeItemDex()" aria-label="閉じる">✕</button>
    </div>
    <div class="dex-prog">コンプ率 <b>${usedCount} / ${all.length}</b> 種</div>
    <div class="dex-grid">${cards}</div>
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) closeItemDex(); });
  document.body.appendChild(ov);
}
function closeItemDex() {
  const e = document.getElementById('item-dex-overlay');
  if (e) e.remove();
}
function pickFixedDice(n) {
  itemBuffs.fixedDice = n; saveItemBuffs();
  const i = sugorokuData.items.findIndex(it => it.id === 'compass');
  if (i > -1) sugorokuData.items.splice(i, 1);
  recordItemUse('compass');           // 📖図鑑に記録
  playItemUseEffect({ id: 'compass', emoji: '🧭' });  // 🎆演出
  saveSugorokuData();
  renderBoard();
  closeDicePicker();
  showItemToast(`🧭 運命の羅針盤！次の出目は ${n} に確定`);
}

// ── RPG冒険マップ エリアビュー ──
function buildAreaView() {
  const cur = sugorokuData.pos > 0 ? sgGetCellNum(sugorokuData.pos) : 0;
  const zi  = cur > 0 ? Math.floor((cur - 1) / 10) : 0;
  const zone = SG_ZONES[zi];

  // ゾーンヘッダー更新
  const header = document.getElementById('ba-zone-header');
  if (header) {
    header.className = `ba-zone-header zt-${zone.terrain}`;
    header.style.cssText = `--za:${zone.accent};--zr:${zone.rgb};`;
    const iconEl  = document.getElementById('ba-zone-icon');
    const labelEl = document.getElementById('ba-zone-label');
    if (iconEl)  iconEl.textContent = zone.emoji;
    if (labelEl) { labelEl.textContent = zone.name; labelEl.style.color = zone.accent; }
    const pts = document.getElementById('ba-particles');
    if (pts) {
      const emojis = ZONE_PARTICLES[zone.terrain] || ['·','·','·','·','·'];
      pts.innerHTML = emojis.map((e, i) =>
        `<span class="bap p${i}">${e}</span>`).join('');
    }
  }

  let row = document.getElementById('ba-path-row');
  if (!row) {
    const areaView = document.getElementById('board-area-view');
    if (!areaView) return;
    areaView.innerHTML = `
      <div id="ba-zone-header" class="ba-zone-header zt-${zone.terrain}" style="--za:${zone.accent};--zr:${zone.rgb};">
        <div class="ba-particles" id="ba-particles"></div>
        <div class="ba-zone-info">
          <span id="ba-zone-icon">${zone.emoji}</span>
          <span id="ba-zone-label" style="color:${zone.accent}">${zone.name}</span>
        </div>
      </div>
      <div id="ba-path-scroll"><div id="ba-path-row"></div></div>
      <div id="board-next-rewards"></div>`;
    const pts2 = document.getElementById('ba-particles');
    if (pts2) {
      const emojis2 = ZONE_PARTICLES[zone.terrain] || ['·','·','·','·','·'];
      pts2.innerHTML = emojis2.map((e, i) => `<span class="bap p${i}">${e}</span>`).join('');
    }
    row = document.getElementById('ba-path-row');
    if (!row) return;
  }

  if (cur === 0) {
    row.innerHTML = `<div class="rp-prompt">
      <div class="rp-prompt-dice">🎲</div>
      <div>サイコロを振って冒険を始めよう！</div>
    </div>`;
    return;
  }

  const BADGE = { item:'宝　箱', event:'イベント', rare:'★ レア', checkpoint:'キャンプ', goal:'GOAL' };
  const start  = Math.max(1, cur - 2);
  const end    = Math.min(100, cur + 6);
  const avatar = buildKomaSVG(50, 50);

  let html = '';
  for (let n = start; n <= end; n++) {
    const type  = BOARD_CELL_TYPES[n] || 'normal';
    const isCur = n === cur;
    const isPast = n < cur;
    const isNxt  = n === cur + 1;
    const czi    = Math.floor((n - 1) / 10);
    const czone  = SG_ZONES[czi];
    const sicons = SPOT_ICONS[czone.terrain] || SPOT_ICONS.grassland;
    const icon   = sicons[type] || sicons.normal;

    // コネクタ（スポット間）
    if (n > start) {
      const isZoneChange = n > 1 && (n - 1) % 10 === 0;
      if (isZoneChange) {
        // ゾーン境界ゲート
        html += `<div class="rp-gate" style="color:${czone.accent};border-color:rgba(${czone.rgb},.4)">${czone.emoji}</div>`;
      } else {
        const walked = (n - 1) < cur;
        const connBg = walked ? `background:rgba(${czone.rgb},.42)` : '';
        html += `<div class="rp-conn${walked ? ' walked' : ''}" style="${connBg}"></div>`;
      }
    }

    // スポット本体のスタイル
    const spotStyle = isCur
      ? `border-color:${czone.accent};background:rgba(${czone.rgb},.14);--gl-lo:rgba(${czone.rgb},.28);--gl-hi:rgba(${czone.rgb},.62)`
      : isPast
        ? `border-color:rgba(${czone.rgb},.13);background:rgba(${czone.rgb},.04)`
        : `border-color:rgba(${czone.rgb},.3);background:rgba(${czone.rgb},.06)`;

    const cls = `rp-spot${isCur ? ' is-cur' : isPast ? ' is-past' : isNxt ? ' is-nxt' : ''}`;

    let inner = `<span class="rp-n">${n}</span>`;

    if (isCur && !sgAnimating) {
      inner += `<div class="rp-av">${avatar}</div>`;
    } else if (isPast) {
      inner += `<div class="rp-ic rp-ic-done">✓</div>`;
    } else {
      inner += `<div class="rp-ic">${icon}</div>`;
    }

    if (type !== 'normal' && !isCur) {
      inner += `<div class="rp-bd tp-${type}">${BADGE[type]||''}</div>`;
    }

    if (isCur) {
      inner += `<div class="rp-cl" style="color:${czone.accent}">▲ 現在地</div>`;
    }

    html += `<div class="${cls}" style="${spotStyle}">${inner}</div>`;
  }

  row.innerHTML = html;

  // 現在地を中央にスクロール
  setTimeout(() => {
    const curEl = row.querySelector('.is-cur');
    const sc = document.getElementById('ba-path-scroll');
    if (curEl && sc) {
      sc.scrollLeft = curEl.offsetLeft - sc.offsetWidth / 2 + curEl.offsetWidth / 2;
    }
  }, 60);
}

// ── 次の報酬プレビューチップ ──
function buildNextRewards() {
  const el = document.getElementById('board-next-rewards');
  if (!el) return;
  const curCell = sugorokuData.pos > 0 ? sgGetCellNum(sugorokuData.pos) : 0;

  if (curCell === 0) {
    el.innerHTML = '';
    return;
  }

  const TYPE_EMOJI  = { checkpoint:'🏁', item:'📦', event:'✨', rare:'⭐', goal:'🏆' };
  const TYPE_LABEL  = { checkpoint:'チェックポイント', item:'アイテム', event:'イベント', rare:'レアイベント', goal:'ゴール！' };
  const rewards = [];
  const typeSeen = new Set();

  for (let n = curCell + 1; n <= 100 && rewards.length < 3; n++) {
    const type = BOARD_CELL_TYPES[n] || 'normal';
    if (type === 'normal' || typeSeen.has(type)) continue;
    typeSeen.add(type);
    rewards.push({ n, type, dist: n - curCell });
  }

  el.innerHTML = rewards.map(r =>
    `<div class="bnr-chip tp-${r.type}">
      <span class="bnr-dist">あと${r.dist}マス</span>
      ${TYPE_EMOJI[r.type]} ${TYPE_LABEL[r.type]}
    </div>`
  ).join('');
}

// ── 世界地図トグル ──
function toggleBoardMap() {
  const content = document.getElementById('board-map-content');
  const toggle  = document.getElementById('board-map-toggle');
  const isExp   = content.classList.contains('expanded');
  if (isExp) {
    content.classList.remove('expanded');
    toggle.classList.remove('expanded');
    toggle.textContent = '🗺 世界地図を見る ▾';
  } else {
    content.classList.add('expanded');
    toggle.classList.add('expanded');
    toggle.textContent = '🗺 世界地図を閉じる ▴';
    // SVGを描画（初回または再開時）
    const wrapper = document.getElementById('board-svg-wrapper');
    wrapper.querySelectorAll(':scope > svg').forEach(el => el.remove());
    wrapper.appendChild(buildBoardSVG());
  }
}

// 効果中の時限バフ（龍の覚醒・覇者の宣言など）を board 内に表示
function renderActiveBuffs() {
  const av = document.getElementById('board-area-view');
  if (!av || !av.parentNode) return;
  let strip = document.getElementById('board-active-buffs');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'board-active-buffs';
    av.parentNode.insertBefore(strip, av.nextSibling);
  }
  const now  = Date.now();
  const defs = { xpMul: ['🐉 龍の覚醒', '全XP2倍'], questXpMul: ['👑 覇者の宣言', 'クエストXP2倍'] };
  const chips = [];
  Object.keys(activeBuffs).forEach(k => {
    const b = activeBuffs[k];
    if (!b || now > b.expiresAt) return;
    const d = defs[k] || [k, '効果中'];
    const mins = Math.max(1, Math.round((b.expiresAt - now) / 60000));
    const left = mins >= 60 ? `${Math.round(mins / 60)}時間` : `${mins}分`;
    chips.push(`<span class="bab-chip">${d[0]}・${d[1]}<span class="bab-left">残り${left}</span></span>`);
  });
  strip.innerHTML = chips.length ? `<div class="bab-label">✨ 効果中</div>${chips.join('')}` : '';
  strip.style.display = chips.length ? '' : 'none';
}

// 🎆 アイテム使用エフェクト演出（中央にアイコン＋テーマのパーティクル）
const ITEM_FX = {
  // id: [中央アイコン, パーティクル絵文字, 画面フラッシュ色]
  dragon_scroll:[ '🐉', ['🔥','🔥','✨','🔥','💥','🔥'], 'rgba(239,68,68,.28)' ],
  cosmic_orb:   [ '🔮', ['🌟','✨','💫','🌌','⭐','✨'], 'rgba(139,92,246,.28)' ],
  legend_gem:   [ '🌟', ['✨','💎','✨','⭐','💎','✨'], 'rgba(251,191,36,.26)' ],
  phoenix:      [ '🪶', ['🔥','🪶','✨','🔥','🪶','💫'], 'rgba(251,146,60,.26)' ],
  golden_key:   [ '🗝', ['✨','🔑','⭐','✨','🗝','✨'], 'rgba(251,191,36,.24)' ],
  crown:        [ '👑', ['✨','👑','⭐','✨','💛','✨'], 'rgba(251,191,36,.22)' ],
  compass:      [ '🧭', ['🧭','✨','➡','✨','🧭','✨'], 'rgba(125,150,255,.22)' ],
};
function playItemUseEffect(item) {
  if (!item) return;
  const fx = ITEM_FX[item.id] || [item.emoji || '✨', ['✨','✨','💫','✨','⭐','✨'], 'rgba(125,150,255,.18)'];
  const ov = document.createElement('div');
  ov.className = 'item-fx-overlay';
  let parts = '';
  for (let i = 0; i < fx[1].length; i++) {
    const ang = (i / fx[1].length) * 360 + (Math.random() * 30 - 15);
    const dist = 90 + Math.random() * 70;
    const delay = (Math.random() * 0.12).toFixed(2);
    parts += `<span class="ifx-p" style="--a:${ang}deg;--d:${dist}px;animation-delay:${delay}s">${fx[1][i]}</span>`;
  }
  ov.innerHTML = `<div class="ifx-flash" style="background:radial-gradient(circle, ${fx[2]} 0%, transparent 65%)"></div>
    <div class="ifx-core">${fx[0]}</div>${parts}`;
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 1400);
}

// アイテム使用トースト（confidence-toast の表示枠を再利用）
function showItemToast(msg) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.remove('levelup');
  void t.offsetWidth;          // アニメ再生のため reflow
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function useItem(itemId) {
  const idx = sugorokuData.items.findIndex(it => it.id === itemId);
  if (idx === -1) return;
  const item = sugorokuData.items[idx];
  const eff = ITEM_EFFECTS[item.id];

  // まだ効果を実装していないアイテムは消費せず案内のみ
  if (!eff) {
    alert(`${item.emoji}「${item.name}」の効果は近日実装予定です。\nもう少しだけお待ちください！`);
    return;
  }

  // 🧭羅針盤など、専用の選択UIを持つアイテムはそちらに任せる（消費もUI側で行う）
  if (eff.picker) { eff.open(); return; }

  if (!confirm(`${item.emoji}「${item.name}」を使いますか？\n\n効果：${eff.confirm}`)) return;

  const msg = eff.apply();            // 効果発動（戻り値はトースト文言／null可）
  recordItemUse(item.id);             // 📖図鑑に記録
  playItemUseEffect(item);            // 🎆使用エフェクト演出
  sugorokuData.items.splice(idx, 1);  // 使ったアイテムを消す
  saveSugorokuData();
  renderBoard();
  if (msg) showItemToast(msg);
}

function renderBoard() {
  const wrapper = document.getElementById('board-svg-wrapper');

  // アニメ開始判断（SVGを組む前に sgAnimating をセット）
  let animFromPos = null;
  if (sgPendingWalk && !sgAnimating) {
    const { fromPos, rollTime } = sgPendingWalk;
    if (Date.now() - rollTime < 60000) {
      animFromPos = fromPos;
      sgAnimating = true;
    }
    sgPendingWalk = null;
  }

  // ① エリアビューと報酬プレビューを更新
  buildAreaView();
  buildNextRewards();

  // ② 世界地図は展開中の時だけ再描画
  const mapContent = document.getElementById('board-map-content');
  if (mapContent && mapContent.classList.contains('expanded')) {
    wrapper.querySelectorAll(':scope > svg').forEach(el => el.remove());
    wrapper.appendChild(buildBoardSVG());
  }

  // ③ ヘッダーのマス情報を更新
  const stage = sgGetStage(sugorokuData.pos);
  const cell  = sgGetCellNum(sugorokuData.pos);
  document.getElementById('board-panel-sub').textContent =
    `ステージ ${stage}  ·  マス ${cell} / 100`;

  // ③.5 効果中の時限バフを表示
  renderActiveBuffs();

  // ④ 取得アイテム一覧（ヒント付きカード表示）
  const title = document.getElementById('board-items-title');
  const list  = document.getElementById('board-items-list');
  if (sugorokuData.items.length === 0) {
    title.style.display = 'none';
    list.innerHTML = '';
  } else {
    title.style.display = '';
    list.innerHTML = sugorokuData.items.map(it => {
      const hint = ITEM_NEXT_HINTS[it.id];
      const hintHtml = hint
        ? `<div class="bic-hint-tag">${hint[0]}</div><div class="bic-hint">${hint[1]}</div>`
        : '';
      const ready = !!ITEM_EFFECTS[it.id];   // 効果実装済みかどうか
      const btn = ready
        ? `<button class="bic-use-btn" onclick="useItem('${it.id}')">使う</button>`
        : `<button class="bic-use-btn is-soon" onclick="useItem('${it.id}')">近日</button>`;
      return `<div class="board-item-card${it.rare ? ' is-rare' : ''}">
        <div class="bic-icon">${it.emoji}</div>
        <div class="bic-body">
          <div class="bic-name">${it.name}</div>
          <div class="bic-pos">マス ${it.pos} で取得</div>
          ${hintHtml}
        </div>
        ${btn}
      </div>`;
    }).join('');
  }

  // ⑤ 歩行アニメーション起動
  if (animFromPos !== null) {
    setTimeout(() => startWalkAnimation(animFromPos, sugorokuData.pos), 180);
  }
}

function openBoardModal() {
  Overlay.open('board-overlay', { onClose: handleBoardClose });
  renderBoard();
  // 歩行アニメが無い場合（アバターA以外など）のフォールバック：到着演出を出す
  setTimeout(() => {
    if (!sgAnimating && _sgPendingReward) {
      const reward = _sgPendingReward;
      _sgPendingReward = null;
      showEquipmentGetModal(reward);
    }
  }, 900);
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
    <div class="koku-sg-reward" id="${evId}-reward" style="display:none"></div>
    <div class="koku-sg-pos" id="${evId}-pos" style="display:none">ステージ${stage} · マス ${sgGetCellNum(newPos)} / 100</div>
    <div class="koku-sg-countdown" id="${ctId}" style="display:none">タップして閉じる</div>
  `;
  kokuResult.appendChild(sec);

  const diceEl = document.getElementById(diceId);
  const statEl = document.getElementById(statId);
  const evEl   = document.getElementById(evId);
  const posEl  = document.getElementById(evId + '-pos');
  const ctEl   = document.getElementById(ctId);

  const FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const NUMS  = ['1','2','3','4','5','6'];
  let fi = 0;
  const spinStart = Date.now();
  const SPIN_DUR  = 1500;

  // スロットマシン風：だんだんゆっくりになって止まる
  function _spinStep() {
    const elapsed = Date.now() - spinStart;
    if (elapsed >= SPIN_DUR) {
      // 止まる
      const faceStr = roll > 6 ? String(roll) : FACES[roll - 1];
      diceEl.textContent = faceStr;
      diceEl.classList.remove('spinning');
      diceEl.classList.add('stopped');
      // 画面シェイク
      const kokuEl = document.getElementById('koku-overlay');
      if (kokuEl) { kokuEl.classList.add('sg-shake'); setTimeout(() => kokuEl.classList.remove('sg-shake'), 400); }
      // LUCKY! ポップアップ
      if (roll >= 5) {
        const lucky = document.createElement('div');
        lucky.className = 'sg-lucky-pop';
        lucky.textContent = roll === 6 ? '🎉 MAX!!' : '✨ LUCKY!';
        diceEl.parentNode.style.position = 'relative';
        diceEl.parentNode.appendChild(lucky);
        setTimeout(() => lucky.remove(), 1200);
      }
      statEl.textContent = `${roll} が出ました！ ${roll}マス進みました`;
      return;
    }
    diceEl.textContent = FACES[fi++ % 6];
    // 二次曲線で減速（55ms→255ms）
    const prog = elapsed / SPIN_DUR;
    const delay = Math.floor(55 + prog * prog * 210);
    _sgSpinT1 = setTimeout(_spinStep, delay);
  }
  _sgSpinT1 = setTimeout(_spinStep, 55);

  _sgSpinT2 = setTimeout(() => {
    evEl.style.display = '';
    // 今手に入れたもの（装備/アイテム）を告の中にインライン表示
    if (_sgPendingReward) {
      const rw = _sgPendingReward; _sgPendingReward = null;
      const rewardEl = document.getElementById(evId + '-reward');
      if (rewardEl) {
        rewardEl.innerHTML = `🎁 GET! ${renderItemIcon(rw, 24)} <b>${rw.name}</b>`
          + (rw.effect && rw.effect.desc ? ` <span style="opacity:.8">（${rw.effect.desc}）</span>` : '');
        rewardEl.style.display = '';
      }
    }
    posEl.style.display = '';
    ctEl.style.display = '';
    ctEl.addEventListener('click', closeKoku);
    // 5秒カウントダウン後に自動クローズ
    let sec2 = 5;
    ctEl.textContent = `タップして閉じる (${sec2}秒)`;
    _sgAutoClose = setInterval(() => {
      sec2--;
      if (!document.getElementById('koku-overlay').classList.contains('active')) { clearInterval(_sgAutoClose); _sgAutoClose = null; return; }
      if (sec2 <= 0) { clearInterval(_sgAutoClose); _sgAutoClose = null; closeKoku(); }
      else ctEl.textContent = `タップして閉じる (${sec2}秒)`;
    }, 1000);
  }, 2300);
}

// ═══════════════════════════════════════════════════════
//  SKILL TREE — DATA
// ═══════════════════════════════════════════════════════
// 成長ラダー（5段階）— 時間ではなく「何を得たか」で実る
// 妖精の問いに答え、その成長段階を選ぶと、その実(ノード)が解放される
const SKILL_THRESHOLDS = [
  { mins: 0, name: '出会い', emoji: '🌱', desc: '知らなかったことを、知れた。学びの芽が出た瞬間。',
    q: '今日、新しく「知れた」ことは？' },
  { mins: 0, name: 'できた', emoji: '🔑', desc: 'できなかったことが、できるようになった。扉が開いた。',
    q: '今日、「できなかったことができた」のは？' },
  { mins: 0, name: '上達',   emoji: '⚙️', desc: 'できることを、もっと上手くできるようになった。',
    q: '今日、「前より上手くできた」ことは？' },
  { mins: 0, name: '自在',   emoji: '🧭', desc: '応用・実践で、自在に使いこなせるようになった。',
    q: '今日、「応用・実践で使えた」ことは？' },
  { mins: 0, name: '伝える', emoji: '👨‍🏫', desc: '得意を、人に教えられるレベルに到達した。最高位。',
    q: '今日、「人に教えられそう」と思えたことは？' },
];

// ── 成長の実（スキルノートのメモ）── localStorage: gq_skill_notes
function loadSkillNotes() {
  try { return JSON.parse(localStorage.getItem('gq_skill_notes') || '{}'); } catch { return {}; }
}
function saveSkillNotes() { localStorage.setItem('gq_skill_notes', JSON.stringify(skillNotes)); }
let skillNotes = loadSkillNotes();

// 成長の実をならせる：ノードを解放し、メモを記録する
function addSkillFruit(genreId, stageIdx, text) {
  if (!genreId || stageIdx == null) return false;
  const key = `${genreId}_${stageIdx}`;
  if (!skillData[key]) { skillData[key] = Date.now(); saveSkillData(); }
  if (!skillNotes[key]) skillNotes[key] = [];
  skillNotes[key].push({ text: (text||'').trim(), createdAt: new Date().toISOString() });
  saveSkillNotes();
  renderSkillCount();
  if (typeof evaluateUnlocks === 'function') evaluateUnlocks();
  if (typeof renderOnboarding === 'function') renderOnboarding();
  return true;
}

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
  // 📜龍の覚醒中はXPだけ倍率をかける（学習時間の統計はそのまま）
  data.xp += Math.round(minutes * getActiveXpMultiplier());
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
  const lvEl = document.getElementById('level-label'); if (lvEl) lvEl.textContent = `Lv ${data.level}`;
  const xnEl = document.getElementById('xp-numbers');  if (xnEl) xnEl.textContent = `${data.xp} / ${needed} XP`;
  const xbEl = document.getElementById('xp-bar');      if (xbEl) xbEl.style.width = pct + '%';
  const ttEl = document.getElementById('total-time-label'); if (ttEl) ttEl.textContent = `累計学習 ${data.totalMinutes}分`;
  // ヘッダー内のコンパクトXPゲージ
  const hLv = document.getElementById('hx-lv');   if (hLv) hLv.textContent = `Lv ${data.level}`;
  const hNm = document.getElementById('hx-num');  if (hNm) hNm.textContent = `${data.xp} / ${needed} XP`;
  const hFl = document.getElementById('hx-fill'); if (hFl) hFl.style.width = pct + '%';
  renderSkillCount();
  renderConfidence();  // 自信ゲージも同時に更新
}

// ── ヘッダーの「今日のひとこと」モチベ ─────────────────────
const MOTIV_LINES = [
  '小さな一歩が、未来を変える。',
  '今日の5分が、明日の自分をつくる。',
  'やる気は、始めると後からついてくる。',
  '完璧じゃなくていい。続けることが力。',
  '昨日の自分を、少しだけ超えていこう。',
  '焦らない。でも、止まらない。',
  '努力は、裏切らずに積み重なる。',
  '今この瞬間が、一番若い日。',
  'できない日があってもいい。また始めればいい。',
  '集中した時間は、誰にも奪えない財産。',
  '一歩ずつ。それが最速の道。',
  '今日も、自分を信じて進もう。',
  '行動した分だけ、世界は広がる。',
  'コツコツが、いつか大きな差になる。',
];
// 装備効果 motiv_style 用：口調別の応援メッセージ
const MOTIV_STYLES = {
  sage: [   // 学者の冠：賢者の格言
    '急がば回れ。遠回りこそ、いちばんの近道じゃ。',
    '知は、今日の一歩にしか宿らぬ。',
    '迷うのは、進んでおる証拠じゃよ。',
    '昨日の自分こそ、超えるべき好敵手じゃ。',
    '休むこともまた、修行のうちじゃ。',
    '小さな積み重ねが、やがて山となる。',
  ],
  hero: [   // 不死鳥のマント：英雄の言葉
    'さあ、今日の冒険を始めよう。',
    'その一歩が、伝説の始まりだ。',
    '倒れてもいい。立ち上がる姿が英雄だ。',
    '恐れを連れたまま、進め。',
    '君の物語は、君にしか書けない。',
    '今日の5分が、明日の剣になる。',
  ],
  morning: [   // 朝活ジャケット：朝の応援
    'おはよう。今日も小さく始めよう。',
    '朝の5分は、夜の30分に勝る。',
    '目覚めた今が、いちばんの好機。',
    '太陽より先に、心に火を灯そう。',
    '今日の予定に「自分の成長」をひとつ。',
    '深呼吸して、さあ一歩目。',
  ],
  breeze: [   // 追い風のスカーフ：そよ風の応援
    'がんばりすぎなくて、いいからね。',
    '今日は今日の風が吹く。',
    'ひと息ついたら、また進もう。',
    'あなたのペースが、いちばんの正解。',
    '5分だけ。それで十分えらい。',
    'できた分だけ、ちゃんと前進。',
  ],
};
function setHeaderMotivation() {
  const el = document.getElementById('header-motiv');
  if (!el) return;
  const d = new Date();
  const dayIdx = Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000); // 年内通算日
  // 装備効果 motiv_style：装備中はその口調のメッセージプールに切り替わる
  const styleItem = (typeof getEquippedEffectItem === 'function') ? getEquippedEffectItem('motiv_style') : null;
  const pool = (styleItem && MOTIV_STYLES[styleItem.effect.value]) || MOTIV_LINES;
  el.textContent = '“' + pool[dayIdx % pool.length] + '”';
}

// ── 自信ゲージ（XPと独立、努力の積み上げを別軸で可視化）─────────
const CONFIDENCE_MESSAGES = {
  session_complete:   '自信が少し育ちました',
  session_5min:       '小さな一歩が、未来の自分を作ります',
  first_today:        '今日の始まり、よく動き出しましたね',
  resume_after_break: '戻ってきたことが、もう成長です',
  weekly_review:      '振り返りは、自信を確かなものにします',
  praise_log:         'これは未来の自信の証拠です',
  guild_quest:        'ギルドの依頼を、また一つ果たしました',
  item_study_book:    '📕 学びの本が、あなたの自信を育てました',
  item_cosmic:        '🔮 宇宙の意志が、あなたを後押しします',
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
let _praiseSessionGenre  = '';

function openPraiseModal(dateKey) {
  _praiseSessionDate = dateKey || todayKey();
  const ta = document.getElementById('praise-text');
  ta.value = '';
  updatePraiseCounter();
  document.getElementById('praise-save-btn').disabled = true;
  Overlay.open('praise-overlay');
  setTimeout(() => ta.focus(), 240);
}
function closePraiseModal() {
  Overlay.close('praise-overlay');
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
  if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault(); savePraise();    // Cmd/Ctrl + Enter で保存
  }
});

// ═══════════════════════════════════════════════════════
//  世界樹の妖精（セッション後の問いかけ → スキルツリーが実る）
// ═══════════════════════════════════════════════════════
let _fairyGenreId = '';
let _fairyDateKey = '';
let _fairyStage   = null;

function openFairyModal(genreId, dateKey) {
  _fairyGenreId = genreId || currentGenreId;
  _fairyDateKey = dateKey || todayKey();
  _fairyStage   = null;
  const g = genres.find(x => x.id === _fairyGenreId);

  const genreEl = document.getElementById('fairy-genre');
  genreEl.textContent = g ? `🌳 ${g.emoji} ${g.name} の樹に実ります` : '';

  // 段階チップを描画（既に実っている段階には ✓）
  const stagesEl = document.getElementById('fairy-stages');
  stagesEl.innerHTML = SKILL_THRESHOLDS.map((t, i) => {
    const done = g && skillData[`${g.id}_${i}`];
    return `<button class="fairy-stage${done ? ' done' : ''}" data-stage="${i}">
      <span class="fairy-stage-emoji">${t.emoji}</span>
      <span class="fairy-stage-name">${t.name}${done ? ' ✓' : ''}</span>
    </button>`;
  }).join('');
  stagesEl.querySelectorAll('.fairy-stage').forEach(btn => {
    btn.addEventListener('click', () => {
      _fairyStage = parseInt(btn.dataset.stage);
      stagesEl.querySelectorAll('.fairy-stage').forEach(b =>
        b.classList.toggle('selected', parseInt(b.dataset.stage) === _fairyStage));
      updateFairySave();
    });
  });

  // 🎒 アイテム使用リンク：持っているアイテムがある時だけ表示し、
  // タップで妖精を閉じてすごろく盤面（＝アイテムを使う場所）へジャンプ
  const itemLink = document.getElementById('fairy-item-link');
  if (itemLink) {
    const n = (typeof sugorokuData !== 'undefined' && sugorokuData.items) ? sugorokuData.items.length : 0;
    if (n > 0) {
      itemLink.style.display = '';
      itemLink.innerHTML = `🎒 アイテムを使う <span class="fil-count">${n}個</span> →`;
      itemLink.onclick = () => { closeFairyModal(); openBoardModal(); };
    } else {
      itemLink.style.display = 'none';
    }
  }

  const ta = document.getElementById('fairy-text');
  ta.value = '';
  document.getElementById('fairy-save-btn').disabled = true;
  Overlay.open('fairy-overlay');
  setTimeout(() => ta.focus(), 240);
}

function updateFairySave() {
  const text = (document.getElementById('fairy-text').value || '').trim();
  document.getElementById('fairy-save-btn').disabled = !(text.length > 0 && _fairyStage != null);
}

function closeFairyModal() {
  Overlay.close('fairy-overlay');
}

function saveFairy() {
  const btn  = document.getElementById('fairy-save-btn');
  const text = (document.getElementById('fairy-text').value || '').trim();
  if (!text || _fairyStage == null || btn.disabled) return;
  btn.disabled = true;

  // ① 世界樹に実らせる（ノード解放＋メモ記録）
  addSkillFruit(_fairyGenreId, _fairyStage, text);

  // ② 既存のセッション後リフレクション報酬も維持（褒めログ・自信・クエスト）
  const dateKey = _fairyDateKey || todayKey();
  if (!praiseLogs[dateKey]) praiseLogs[dateKey] = [];
  praiseLogs[dateKey].push({ text, createdAt: new Date().toISOString() });
  savePraiseLogs();
  const gained = addDailyConfidenceOnce('praise_log', 2, 'praise_log', dateKey);
  completeQuest('praise_self');

  closeFairyModal();
  // スキルツリーが開いていれば再描画
  if (document.getElementById('skill-overlay')?.classList.contains('open')) renderSkillTree();

  const t = SKILL_THRESHOLDS[_fairyStage];
  const g = genres.find(x => x.id === _fairyGenreId);
  setTimeout(() => showFairyToast(t, g), gained ? 5600 : 700);
}

function showFairyToast(stage, g) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🌳 ${g ? g.emoji + ' ' + g.name : ''} の樹に実がなった<br>` +
    `<span style="opacity:.85;font-weight:400">${stage.emoji} ${stage.name} — ${stage.desc.split('。')[0]}</span>`;
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 3800);
}

document.getElementById('fairy-text').addEventListener('input', updateFairySave);
document.getElementById('fairy-save-btn').addEventListener('click', saveFairy);
document.getElementById('fairy-skip-btn').addEventListener('click', closeFairyModal);
document.getElementById('fairy-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('fairy-overlay')) closeFairyModal();
});
document.addEventListener('keydown', e => {
  const ov = document.getElementById('fairy-overlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveFairy(); }
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
  // 👑覇者の宣言中はクエスト達成XPに倍率をかける
  if (quest.xp > 0)         addBonusXP(Math.round(quest.xp * getQuestXpMultiplier()));
  if (quest.confidence > 0) addConfidence(quest.confidence, 'daily_quest');
  renderDailyQuests();
  setTimeout(() => showQuestDoneToast(quest), quest.confidence > 0 ? 3000 : 0);
  return true;
}

let questDoneCollapsed = true;   // 達成した依頼はデフォルト折りたたみ

function questItemHTML(q, isDone) {
  return `<div class="quest-item${isDone ? ' done' : ''}">
      <div class="quest-check">${isDone ? '✓' : '○'}</div>
      <div class="quest-body">
        <div class="quest-title">${q.label}</div>
        <div class="quest-desc">${q.desc}</div>
        <div class="quest-reward">${isDone ? '達成！' : '報酬'}：XP +${q.xp} / 自信 +${q.confidence}</div>
      </div>
    </div>`;
}

function renderDailyQuests() {
  const wrap = document.getElementById('quest-list');
  if (!wrap) return;
  const today   = todayKey();
  const done    = dailyQuests[today] || {};
  const todo    = DAILY_QUESTS.filter(q => !done[q.id]);
  const cleared = DAILY_QUESTS.filter(q =>  done[q.id]);

  // 未実施を上に表示
  let html = todo.map(q => questItemHTML(q, false)).join('');

  // 未実施が無ければ祝福メッセージ
  if (todo.length === 0) {
    html += `<div class="quest-allclear">🎉 今日のクエストは、すべて達成！</div>`;
  }

  // 達成した依頼は折りたたみ（デフォルト閉じ・タップで開閉）
  if (cleared.length > 0) {
    html += `<div class="quest-done-fold">
      <button class="quest-fold-toggle" id="quest-fold-toggle" aria-expanded="${!questDoneCollapsed}">
        <span class="qft-caret">${questDoneCollapsed ? '▸' : '▾'}</span>
        <span>達成した依頼（${cleared.length}）</span>
      </button>
      <div class="quest-done-list"${questDoneCollapsed ? ' style="display:none"' : ''}>
        ${cleared.map(q => questItemHTML(q, true)).join('')}
      </div>
    </div>`;
  }

  wrap.innerHTML = html;
}

// 「達成した依頼」の開閉（#quest-list は再描画されても要素自体は残るのでイベント委譲）
document.getElementById('quest-list')?.addEventListener('click', e => {
  if (e.target.closest('#quest-fold-toggle')) {
    questDoneCollapsed = !questDoneCollapsed;
    renderDailyQuests();
  }
});

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

// ═══════════════════════════════════════════════════════
//  選択肢クエスト（ナッジコース）
//  学習以外の「価値観に沿った小さな行動」へ戻るためのデイリークエスト。
//  コースを選ぶと表示。1日1回・先に保存→XP付与で連打/重複を防止。
// ═══════════════════════════════════════════════════════
const NUDGE_COURSES = [
  {
    id: 'hero',
    name: '平凡な人間が英雄になるまで',
    emoji: '🦸',
    desc: '自分を丁寧に扱うことから、英雄の一日は始まる。身だしなみ・運動・記録・挑戦の4本柱。',
    quests: [
      { id:'groom',  label:'朝の身だしなみリセット', xp:20,
        msg:'今日の自分を雑に扱わない。顔・髪・肌を整えるところから始めよう。',
        hint:'☑ 顔を洗う ☑ 髪を整える ☑ 保湿する ☑ 日焼け止めを塗る' },
      { id:'move5',  label:'5分ムーブ', xp:20,
        msg:'5分だけ身体を動かす。血流が戻ると、行動力も戻る。' },
      { id:'care',   label:'丁寧ログ', xp:20, input:true,
        msg:'今日、自分を丁寧に扱えた行動を1つ記録しよう。小さな実績が自己信頼になる。',
        placeholder:'例：ゆっくり湯船につかった' },
      { id:'side5',  label:'副業5分タッチ', xp:30,
        msg:'完成じゃなくて接触でいい。今日も選択肢を増やす行動を1つ。' },
    ],
    comeback: { id:'comeback', label:'復帰の一手', xp:50,
      msg:'途切れても終わりじゃない。戻ってきた時点で、また始まっている。',
      choices:['顔を洗う','水を飲む','1分歩く','1行書く','部屋を1か所整える','AIに相談する'] },
  },
  {
    id: 'habit',
    name: '小さな習慣の魔法',
    emoji: '✨',
    desc: '誰でも今日から始められる、ごく小さな積み重ね。ハードルは限界まで低く、効果はじわじわ大きく。',
    quests: [
      { id:'water',  label:'起き抜けの水を一杯', xp:10,
        msg:'朝いちばんの一杯が、からだのスイッチを入れる。' },
      { id:'breath', label:'1分だけ深呼吸', xp:10,
        msg:'吸って、ゆっくり吐いて。それだけで頭はリセットされる。' },
      { id:'tidy',   label:'机の上をひとつ片づける', xp:15,
        msg:'視界がひとつ片づくと、頭もひとつ片づく。' },
      { id:'thanks', label:'ありがとうを一回言う', xp:15,
        msg:'誰かにでも、自分にでも。感謝はいちばん手軽な幸福のスイッチ。' },
      { id:'baton',  label:'明日の自分へバトン', xp:20, input:true,
        msg:'明日の最初の一歩をひとこと書いておこう。朝の迷いが消える。',
        placeholder:'例：朝起きたら英単語を5個だけ見る' },
    ],
    comeback: { id:'comeback', label:'おかえりの一歩', xp:50,
      msg:'休んだ分だけ、ちゃんと充電できてる。小さくひとつだけ、戻ってこよう。',
      choices:['水を飲む','深呼吸する','窓を開ける','1行書く','5分だけ座る'] },
  },
];

function loadNudgeDone() { try { return JSON.parse(localStorage.getItem('gq_nudge_done') || '{}'); } catch { return {}; } }
function saveNudgeDone() {
  const keys = Object.keys(nudgeDone).sort();
  while (keys.length > 90) delete nudgeDone[keys.shift()];   // 90日より古い記録は掃除
  localStorage.setItem('gq_nudge_done', JSON.stringify(nudgeDone));
}
let nudgeDone = loadNudgeDone();
let nudgeCourseId = localStorage.getItem('gq_nudge_course') || '';

function currentNudgeCourse() { return NUDGE_COURSES.find(c => c.id === nudgeCourseId) || null; }

// 復帰クエストを出す条件：前日に未達成がある／最後の記録から2日以上空いた
function shouldShowComeback(course) {
  const today = todayKey();
  if (nudgeDone[today] && nudgeDone[today]['comeback']) return true;   // 今日すでに達成→表示は維持
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yRec = nudgeDone[dkey(y)];
  if (yRec) return course.quests.some(q => !yRec[q.id]);
  const dates = Object.keys(nudgeDone).filter(k => k < today).sort();
  if (!dates.length) return false;   // まだ使い始め
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  const gap = Math.round((new Date(today + 'T00:00:00') - last) / 86400000);
  return gap >= 2;
}

function completeNudge(questId, payload) {
  const course = currentNudgeCourse(); if (!course) return false;
  const today = todayKey();
  if (nudgeDone[today] && nudgeDone[today][questId]) return false;   // 1日1回・連打ガード
  const q = (questId === 'comeback') ? course.comeback : course.quests.find(x => x.id === questId);
  if (!q) return false;
  if (!nudgeDone[today] || typeof nudgeDone[today] !== 'object') nudgeDone[today] = {};
  nudgeDone[today][questId] = payload || true;   // 先に保存＝以後の同日呼び出しはガード
  saveNudgeDone();
  addBonusXP(q.xp);
  showNudgeToast(q);
  renderNudgeCard();
  return true;
}

function showNudgeToast(q) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🧭 ${q.label} 達成！ <b>+${q.xp}XP</b><br>` +
                `<span style="opacity:.85;font-weight:400">${q.msg}</span>`;
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 3200);
}

// 「今日のクエスト」カード内に統合表示する。
// コース未選択時はスリムな1行だけ（タップでコース選択が開く）
let _nudgePickerOpen = false;
let nudgeDoneCollapsed = true;   // 達成したナッジクエストはデフォルト折りたたみ
function renderNudgeCard() {
  const body = document.getElementById('nudge-body');
  if (!body) return;

  if (nudgeCourseId === 'off') nudgeCourseId = '';   // 旧「隠す」設定からの移行
  const course = currentNudgeCourse();

  // コース未選択 → 控えめな誘い1行（タップで選択肢が開く）
  if (!course) {
    if (!_nudgePickerOpen) {
      body.innerHTML = `<button class="nudge-invite" id="nudge-invite">＋ 🧭 選択肢クエストを追加（生活の小さな行動もクエストに）</button>`;
      document.getElementById('nudge-invite').addEventListener('click', () => {
        _nudgePickerOpen = true; renderNudgeCard();
      });
      return;
    }
    body.innerHTML = `
      <div class="nudge-divider"><span>🧭 コースを選ぶ</span></div>
      ${NUDGE_COURSES.map(c => `
        <div class="nudge-course">
          <div class="nudge-course-name">${c.emoji} ${c.name}</div>
          <div class="nudge-course-desc">${c.desc}</div>
          <div class="nudge-course-meta">${c.quests.map(q => q.label).join(' ・ ')}</div>
          <button class="nudge-course-btn" data-course="${c.id}">このコースで始める</button>
        </div>`).join('')}
      <button class="nudge-off-btn" id="nudge-picker-close">閉じる</button>`;
    body.querySelectorAll('[data-course]').forEach(b => b.addEventListener('click', () => {
      nudgeCourseId = b.dataset.course;
      localStorage.setItem('gq_nudge_course', nudgeCourseId);
      _nudgePickerOpen = false;
      renderNudgeCard();
    }));
    document.getElementById('nudge-picker-close').addEventListener('click', () => {
      _nudgePickerOpen = false; renderNudgeCard();
    });
    return;
  }

  const today = todayKey();
  const done = nudgeDone[today] || {};
  // 基本クエストとの間に、コース名入りの細い区切り線
  let html = `<div class="nudge-divider">
    <span>${course.emoji} ${course.name}</span>
    <button class="nudge-switch-mini" id="nudge-switch">変更</button>
  </div>`;

  // 各クエストを「未達成」「達成済み」に振り分け（達成済みは折りたたむ）
  const undoneParts = [];
  const doneParts = [];

  // 復帰の一手（条件を満たした日だけ）
  if (shouldShowComeback(course)) {
    const cb = course.comeback;
    const cbDone = done['comeback'];
    const cbHTML = `<div class="quest-item nudge-comeback${cbDone ? ' done' : ''}">
      <div class="quest-check">${cbDone ? '✓' : '🕯'}</div>
      <div class="quest-body">
        <div class="quest-title">${cb.label} <span class="nudge-xp">+${cb.xp}XP</span></div>
        <div class="quest-desc">${cb.msg}</div>
        ${cbDone
          ? `<div class="quest-reward">達成！${typeof cbDone === 'object' && cbDone.choice ? `「${escHtml(cbDone.choice)}」から再開` : ''}</div>`
          : `<div class="nudge-choices">${cb.choices.map(ch => `<button class="nudge-choice" data-ch="${escHtml(ch)}">${ch}</button>`).join('')}</div>`}
      </div>
    </div>`;
    (cbDone ? doneParts : undoneParts).push(cbHTML);
  }

  course.quests.forEach(q => {
    const d = done[q.id];
    const isDone = !!d;
    let extra = '';
    if (q.input && !isDone) {
      extra = `<div class="nudge-input-row">
        <input class="nudge-input" id="nudge-in-${q.id}" type="text" maxlength="120" placeholder="${q.placeholder || ''}">
        <button class="nudge-save" data-q="${q.id}">記録する</button>
      </div>`;
    } else if (q.input && isDone && typeof d === 'object' && d.text) {
      extra = `<div class="quest-reward">📝 ${escHtml(d.text)}</div>`;
    }
    const itemHTML = `<div class="quest-item${isDone ? ' done' : ''}">
      <div class="quest-check nudge-check" data-q="${q.id}" data-input="${q.input ? '1' : ''}">${isDone ? '✓' : '○'}</div>
      <div class="quest-body">
        <div class="quest-title">${q.label} <span class="nudge-xp">+${q.xp}XP</span></div>
        <div class="quest-desc">${q.msg}</div>
        ${q.hint ? `<div class="nudge-hint">${q.hint}</div>` : ''}
        ${extra}
      </div>
    </div>`;
    (isDone ? doneParts : undoneParts).push(itemHTML);
  });

  html += undoneParts.join('');
  if (undoneParts.length === 0) {
    html += `<div class="quest-allclear">🎉 今日の選択肢クエストは、すべて達成！</div>`;
  }
  // 達成したクエストは折りたたみ（デフォルト閉じ・タップで開閉）
  if (doneParts.length > 0) {
    html += `<div class="quest-done-fold">
      <button class="quest-fold-toggle" id="nudge-fold-toggle" aria-expanded="${!nudgeDoneCollapsed}">
        <span class="qft-caret">${nudgeDoneCollapsed ? '▸' : '▾'}</span>
        <span>達成したクエスト（${doneParts.length}）</span>
      </button>
      <div class="quest-done-list"${nudgeDoneCollapsed ? ' style="display:none"' : ''}>
        ${doneParts.join('')}
      </div>
    </div>`;
  }

  body.innerHTML = html;

  // 達成クエストの折りたたみ開閉
  document.getElementById('nudge-fold-toggle')?.addEventListener('click', () => {
    nudgeDoneCollapsed = !nudgeDoneCollapsed;
    renderNudgeCard();
  });

  // ○をタップで達成（入力型はテキスト必須）
  body.querySelectorAll('.nudge-check').forEach(el => el.addEventListener('click', () => {
    const qid = el.dataset.q;
    if (el.dataset.input) {
      const inp = document.getElementById('nudge-in-' + qid);
      const txt = (inp && inp.value || '').trim();
      if (!txt) { inp && inp.focus(); return; }
      completeNudge(qid, { text: txt });
    } else {
      completeNudge(qid);
    }
  }));
  body.querySelectorAll('.nudge-save').forEach(b => b.addEventListener('click', () => {
    const inp = document.getElementById('nudge-in-' + b.dataset.q);
    const txt = (inp && inp.value || '').trim();
    if (!txt) { inp && inp.focus(); return; }
    completeNudge(b.dataset.q, { text: txt });
  }));
  body.querySelectorAll('.nudge-choice').forEach(b => b.addEventListener('click', () =>
    completeNudge('comeback', { choice: b.dataset.ch })));
  document.getElementById('nudge-switch')?.addEventListener('click', () => {
    nudgeCourseId = '';
    localStorage.setItem('gq_nudge_course', '');
    _nudgePickerOpen = true;
    renderNudgeCard();
  });
}
renderNudgeCard();

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
  updateModeFill(0);   // モードを切り替えたらゲージをリセット
}

// 3つのモードボタンを「連続したエネルギーゲージ」として描画。
// 経過分で 左(〜25分)→中(〜50分)→右(〜90分) と順に満タン。
// 120分で“破裂寸前”、180分で“虹色”オーバーチャージ。
const MODE_GAUGE_SEGS = [['pomodoro',0,25],['deep',25,50],['flow',50,90]];
function updateModeFill(elapsedSec) {
  const m = (elapsedSec || 0) / 60;
  MODE_GAUGE_SEGS.forEach(([mode, lo, hi]) => {
    const t = document.querySelector(`.mode-tab[data-mode="${mode}"]`);
    if (!t) return;
    const fill = t.querySelector('.mode-fill');
    if (!fill) return;
    const p = Math.max(0, Math.min(1, (m - lo) / (hi - lo))) * 100;
    fill.style.width = p + '%';
    t.classList.toggle('charging', p > 0 && p < 100);
    t.classList.toggle('charged', p >= 100);
  });
  const tabs = document.querySelector('.mode-tabs');
  if (tabs) {
    tabs.classList.toggle('overcharge', m >= 120);  // 破裂寸前
    tabs.classList.toggle('rainbow', m >= 180);     // 虹色
  }
}

const stopBtn = document.getElementById('stop-btn');

function startTimer() {
  if (timerState === 'idle') {
    // ── START ──
    const guideWasOpen = document.getElementById('guide-tutorial-overlay')?.classList.contains('open');
    if (guideWasOpen) closeGuideTutorial(true);
    if (breakInterval) {
      clearInterval(breakInterval);
      breakInterval = null;
      breakBanner.classList.remove('visible');
    }
    sessionStartHour = new Date().getHours();
    timerStartWall = Date.now();
    timerPausedSec = 0;
    timerState = 'running';
    if (window.Otomon) window.Otomon.onTimerStart();   // 🥚 お供オトモンの応援
    startBtn.textContent = '一時停止';
    startBtn.classList.add('running');
    stopBtn.style.display = 'inline-flex';
    sessionMinutes = 0;
    startAnim();
    intervalId = setInterval(tick, 1000);
    requestNotifPermission();
    // デイリークエスト: STARTを押した時点で1日1回達成
    completeQuest('start_5min');
    if (guideWasOpen) setTimeout(showGuideStartToast, 180);

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

// ── 🛡 止め忘れ防止：長すぎるセッションは確認する ───────────
// フローモードは「自分で止めるまで」計測し続けるため、止め忘れると
// (Date.now() - timerStartWall) がどこまでも伸び、「27時間」のような
// 異常値が1回のセッションとして記録されてしまう。一定時間を超えたら
// 停止時に一度だけ確認し、実際の集中時間に直せるようにする。
const OVERLONG_SESSION_MIN = 8 * 60;   // 8時間超 = 止め忘れの疑い
function resolveOverlongSession(rawMins) {
  if (rawMins <= OVERLONG_SESSION_MIN) return rawMins;
  const h = Math.floor(rawMins / 60), m = rawMins % 60;
  const wantsFix = confirm(
    `⏱ 今回 ${h}時間${m}分 計測されています。\n` +
    `タイマーの止め忘れかもしれません。\n\n` +
    `「OK」→ 実際に集中した時間に直す\n` +
    `「キャンセル」→ この時間のまま記録する`
  );
  if (!wantsFix) return rawMins;                 // そのまま記録
  const ans = prompt(
    '実際に集中していた時間を「分」で入力してください。\n' +
    '（このセッションを記録しないなら 0）',
    '60'
  );
  if (ans === null) return rawMins;              // 入力キャンセル → そのまま
  const v = Math.floor(Number(ans));
  if (!Number.isFinite(v) || v < 0) return rawMins;
  return v;
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
  updateModeFill(0);
  document.getElementById('anim-stage').classList.remove('paused');
  stopAnim();
  resetTabTitle();
  updatePiP('--:--');

  // 1分以上経過していればXP付与（1分未満は何も起きなかった扱い＝告も出さない）
  // 🛡 止め忘れ対策：長すぎる場合は確認して実時間に直す
  const mins = resolveOverlongSession(Math.floor(sessionMinutes / 60));
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

    // 装備中アイテムに「ともに歩んだ時間」を刻む
    addCompanionMinutes(mins);

    // タイムログに「学習」ブロックを自動反映（完了時刻から逆算）
    try { if (typeof autoLogStudyBlock === 'function') autoLogStudyBlock(mins); } catch (e) {}

    // 自信ゲージ加算（XPとは別軸）
    addConfidence(3, 'session_complete');
    if (mins >= 5)          addConfidence(1, 'session_5min');
    if (_isFirstToday)      addConfidence(2, 'first_today');
    if (_isResumeFromBreak) { addConfidence(5, 'resume_after_break'); data.streakWasBroken = false; saveData(data); }

    const cfg = MODES[currentMode];
    if (currentMode === 'flow') {
      // フローモードは自分で終えるのが「完了」→ 達成の告（すごろくも振る）
      const _sgResult = doSugorokuRoll(currentMode, mins);
      pendingSugorokuRoll = _sgResult;
      addBonusXP(_sgResult.bonusXP);
      playChime();
      showTimerNotif('セッション完了！', `${mins}分間、集中できました！`);
      showKoku(mins, cfg.break, 'complete', 0);
    } else {
      // ポモドーロ/ディープを目標時間の前に手動停止 → 労いの告（控えめにすごろく前進）
      const _sgResult = doSugorokuRoll(currentMode, mins, true);
      pendingSugorokuRoll = _sgResult;
      addBonusXP(_sgResult.bonusXP);
      showKoku(mins, cfg.break, 'partial', 0);
    }
    // デイリークエスト: 手動停止でも実質「セッションを終えた」とみなす（1日1回限定）
    completeQuest('complete_session');
    // 告が閉じたら「褒めログ入力」モーダルを案内
    _pendingPraisePrompt = true;
    _praiseSessionDate   = _today;
    _praiseSessionGenre  = currentGenreId;
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
    updateModeFill(elapsed);  // 経過秒でゲージ（フローは90分で全充填→以降オーバーチャージ）
    return;
  }

  const total = MODES[currentMode].focus * 60;
  remaining = Math.max(0, total - sec);
  timerDisplay.textContent = fmtTime(remaining);
  updateTabTitle(fmtTime(remaining));
  updatePiP(fmtTime(remaining));
  updateModeFill(sec);   // 経過秒でゲージ（25分=左満タン / 50分=中満タン）

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
  // 🥚 学習系オトモンクエストの自動達成判定（otomon.js 未読込でも落ちない）
  if (window.Otomon) window.Otomon.onSessionComplete(mins);
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
  // 装備中アイテムに「ともに歩んだ時間」を刻む
  addCompanionMinutes(mins);
  addBonusXP(_sgResult.bonusXP);
  // 💎集中の珠などで予約された「次のセッション完了ボーナスXP」を発動
  if (itemBuffs.nextSessionXP) {
    addBonusXP(itemBuffs.nextSessionXP);
    showItemToast(`💎 集中の珠ボーナス +${itemBuffs.nextSessionXP} XP！`);
    itemBuffs.nextSessionXP = 0;
    saveItemBuffs();
  }
  // タイムログに「学習」ブロックを自動反映（ポモドーロ/ディープ完了時）
  try { if (typeof autoLogStudyBlock === 'function') autoLogStudyBlock(mins); } catch (e) {}
  // 自信ゲージ加算（XPとは別軸、デバウンスで1回のトーストに集約）
  addConfidence(3, 'session_complete');
  if (mins >= 5)             addConfidence(1, 'session_5min');
  if (_isFirstToday)         addConfidence(2, 'first_today');
  if (_isResumeFromBreak)    { addConfidence(5, 'resume_after_break'); data.streakWasBroken = false; saveData(data); }
  checkBadges();
  if (typeof evaluateUnlocks === 'function') evaluateUnlocks();
  if (typeof renderOnboarding === 'function') renderOnboarding();
  playChime();
  showTimerNotif('セッション完了！', `${mins}分間、集中できました！`);
  resetTabTitle();
  showKoku(mins, cfg.break, 'complete', 0);
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
function showKoku(mins, breakMins, kind, equipBonusXp) {
  // kind: 'complete'（完走）= 達成の告 / 'partial'（途中停止）= 労いの告
  // equipBonusXp: 旧装備ボーナス表示用（XP倍率廃止により現在は常に0）
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

  overlay.className = 'style-' + settings.kokuStyle;

  result.innerHTML = `
    <span class="result-divider">────────────────</span>
    ${headline}<br>
    集中時間 ${mins}分 &nbsp;/&nbsp; 経験値 <strong>+${xpGained} XP</strong><br>
    ${equipLine}
    累計 ${data.totalMinutes}分<br>
    ${streakMsg ? streakMsg + '<br>' : ''}
    <span class="result-divider">────────────────</span>
    ${closingMsg}
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
  Overlay.open('koku-overlay', { onClose: handleKokuClose });
}

function handleKokuClose() {
  const ov = document.getElementById('koku-overlay');
  ov.className = '';
  clearInterval(_sgSpinInt); clearInterval(_sgAutoClose);
  clearTimeout(_sgSpinT1); clearTimeout(_sgSpinT2);
  _sgSpinInt = _sgSpinT1 = _sgSpinT2 = _sgAutoClose = null;
  // 演出を短く：双六は自動で開かない（🎲からいつでも見られる／コマ移動はその時に再生）。
  // GET報酬は告の中にインライン表示済み。残っていれば破棄。
  _sgJustRolled = false;
  _sgPendingReward = null;
  if (_pendingPraisePrompt) {
    _pendingPraisePrompt = false;
    setTimeout(() => openFairyModal(_praiseSessionGenre, _praiseSessionDate), 420);
  }
}

function closeKoku() {
  const ov = document.getElementById('koku-overlay');
  if (!ov.classList.contains('active')) return; // already closed
  Overlay.close('koku-overlay');
}

document.getElementById('koku-close-btn').addEventListener('click', closeKoku);
document.getElementById('koku-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('koku-overlay')) closeKoku();
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
  Overlay.open('settings-overlay');
  const cu = document.getElementById('set-cloud-url'); if (cu) cu.value = loadCloudUrl();
});
document.getElementById('settings-close-btn').addEventListener('click', () => {
  Overlay.close('settings-overlay');
});
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay'))
    Overlay.close('settings-overlay');
});
document.getElementById('set-cloud-url')?.addEventListener('change', e => saveCloudUrl(e.target.value));
document.getElementById('cloud-test-btn')?.addEventListener('click', testCloudNotify);

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

// ── データのエクスポート / インポート（バックアップ） ──────
function exportAllData() {
  const out = { _app: 'GrowthQuest', _version: 1, _exportedAt: new Date().toISOString(), data: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('gq_')) out.data[k] = localStorage.getItem(k);
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  a.href = url; a.download = `growth-quest-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importAllData(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    let parsed;
    try { parsed = JSON.parse(ev.target.result); } catch { alert('ファイルを読み込めませんでした（JSON形式ではありません）'); return; }
    if (!parsed || parsed._app !== 'GrowthQuest' || !parsed.data) {
      alert('Growth Quest のバックアップファイルではないようです。'); return;
    }
    const keys = Object.keys(parsed.data).filter(k => k.startsWith('gq_'));
    if (!keys.length) { alert('復元できるデータが見つかりませんでした。'); return; }
    if (!confirm(`バックアップ（${(parsed._exportedAt||'').slice(0,10)}）から復元します。\n今の記録は上書きされます。よろしいですか？`)) return;
    keys.forEach(k => localStorage.setItem(k, parsed.data[k]));
    alert('復元しました。ページを再読み込みします。');
    location.reload();
  };
  reader.readAsText(file);
}

// ── 🔧 記録のメンテナンス：異常値（止め忘れ等）を直す ─────────
// 1日あたりが極端に長い記録を洗い出し、正しい分数に直すか削除する。
// data.history（日別合計）・historyDetails（内訳）・累積XP・ジャンル別を
// まとめて、整合性を保ったまま補正する。
const SUSPICIOUS_DAY_MIN = 16 * 60;   // 1日16時間超 = 怪しい

function fixDayRecord(dateKey, newMins) {
  const oldMins = data.history[dateKey] || 0;
  if (oldMins <= 0) return;
  newMins = Math.max(0, Math.floor(newMins));
  const ratio = oldMins > 0 ? newMins / oldMins : 0;
  const det = data.historyDetails ? data.historyDetails[dateKey] : null;

  // その日のジャンル別を按分し、グローバルのジャンル累計も同じ差分だけ補正
  if (det && det.genres) {
    Object.keys(det.genres).forEach(gid => {
      const oldG = det.genres[gid] || 0;
      const newG = Math.round(oldG * ratio);
      const dG   = newG - oldG;                 // 0以下
      const g = genres.find(x => x.id === gid);
      if (g) {
        g.minutes = Math.max(0, (g.minutes || 0) + dG);
        g.xp      = Math.max(0, (g.xp || 0) + dG);
      }
      if (newG <= 0) delete det.genres[gid];
      else           det.genres[gid] = newG;
    });
    if (det.hourMins) {
      Object.keys(det.hourMins).forEach(h => {
        const nv = Math.round((det.hourMins[h] || 0) * ratio);
        if (nv <= 0) delete det.hourMins[h];
        else         det.hourMins[h] = nv;
      });
    }
  }

  const delta = newMins - oldMins;              // 0以下
  data.totalMinutes = Math.max(0, (data.totalMinutes || 0) + delta);
  data.xp           = Math.max(0, (data.xp || 0) + delta);
  if (dateKey === todayKey())
    data.todayMinutes = Math.max(0, (data.todayMinutes || 0) + delta);

  if (newMins <= 0) {
    delete data.history[dateKey];
    if (data.historyDetails) delete data.historyDetails[dateKey];
  } else {
    data.history[dateKey] = newMins;
  }

  saveGenres();
  saveData(data);
}

function runRecordMaintenance() {
  const hist = data.history || {};
  const bad = Object.keys(hist)
    .filter(k => (hist[k] || 0) > SUSPICIOUS_DAY_MIN)
    .sort((a, b) => hist[b] - hist[a]);

  if (!bad.length) {
    alert('怪しい記録は見つかりませんでした 👍\n（1日16時間を超える記録はありません）');
    return;
  }

  alert(`⚠ 1日に長すぎる記録が ${bad.length}件 見つかりました。\n1件ずつ確認して直します。`);

  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  let fixed = 0;
  bad.forEach(k => {
    const cur = data.history[k] || 0;
    if (cur <= 0) return;
    const h = Math.floor(cur / 60), m = cur % 60;
    const dow = dows[new Date(k + 'T00:00:00').getDay()];
    const ans = prompt(
      `📅 ${k}（${dow}）の記録：${h}時間${m}分（${cur}分）\n\n` +
      `止め忘れの異常値かもしれません。\n` +
      `正しい「分数」を入力してください。\n` +
      `・この記録を消すなら 0\n` +
      `・このままにするなら キャンセル`,
      '0'
    );
    if (ans === null) return;
    const v = Math.floor(Number(ans));
    if (!Number.isFinite(v) || v < 0) { alert('数字で入力してください。この日はスキップします。'); return; }
    fixDayRecord(k, v);
    fixed++;
  });

  if (typeof renderStats === 'function') renderStats();
  try { checkBadges(); } catch (e) {}
  alert(fixed
    ? `✅ ${fixed}件の記録を直しました。\nAI分析の土台がキレイになりました！`
    : '変更はありませんでした。');
}
document.getElementById('data-repair-btn')?.addEventListener('click', runRecordMaintenance);

document.getElementById('data-export-btn')?.addEventListener('click', exportAllData);
document.getElementById('data-import-btn')?.addEventListener('click', () => document.getElementById('data-import-file')?.click());
document.getElementById('data-import-file')?.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) importAllData(f);
  e.target.value = '';
});

// ═══════════════════════════════════════════════════════
//  GENRE SELECTOR
// ═══════════════════════════════════════════════════════
const EMOJI_OPTIONS = ['📖','✏️','🔬','🎵','🎨','💻','🏃','🍳','📐','🌍','💬','📊','📚','🧠','🗣️','💪','🎸','📷','♟️','🌱','⚖️','💰','🩺','🔢'];
const COLOR_OPTIONS = ['#06b6d4','#818cf8','#f97316','#e63946','#4ade80','#fbbf24','#a78bfa','#f472b6'];

let selectedEmoji = EMOJI_OPTIONS[0];
let selectedColor = COLOR_OPTIONS[0];

let genreQuickAdd = false;  // ダッシュボードの簡易追加フォーム表示中フラグ
let genreQuickEmoji = EMOJI_OPTIONS[0];  // 簡易追加で選択中の絵文字
let genreQuickImage = null;              // 簡易追加で選んだ写真（dataURL）

// ジャンルのアイコンHTML（写真があれば円アイコン、なければ絵文字）
function genreIcon(g, cls) {
  if (g && g.image) return `<img src="${g.image}" class="genre-icon-img ${cls||''}" alt="">`;
  return `<span class="genre-icon-emoji ${cls||''}">${g ? g.emoji : ''}</span>`;
}

// 画像ファイルを 72px の正方形にトリミング＆圧縮して dataURL を返す
function _readGenreImage(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const S = 72, c = document.createElement('canvas'); c.width = S; c.height = S;
      const x = c.getContext('2d');
      const ratio = Math.max(S / img.width, S / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function renderGenreSelector() {
  const container = document.getElementById('genre-tabs');
  let html = genres.map(g => `
    <span class="genre-tab-wrap">
      <button class="genre-tab ${g.id === currentGenreId ? 'active' : ''}"
        data-gid="${g.id}"
        style="${g.id === currentGenreId ? `border-color:${g.color};color:${g.color};background:${g.color}22` : ''}">
        ${genreIcon(g)} ${g.name}
      </button>
      ${genres.length > 1 ? `<button class="genre-tab-del" data-del="${g.id}" title="削除">×</button>` : ''}
    </span>
  `).join('');

  // 簡易追加（インライン入力 or ＋チップ）
  if (genreQuickAdd) {
    const emojiBtns = EMOJI_OPTIONS.map(e =>
      `<button class="gqa-emoji${e===genreQuickEmoji?' selected':''}" data-emoji="${e}">${e}</button>`).join('');
    const curHtml = genreQuickImage
      ? `<img src="${genreQuickImage}" class="genre-icon-img" alt="">`
      : genreQuickEmoji;
    html += `<div class="genre-quick-add gqa-2col">
      <div class="gqa-preview">
        <div class="gqa-current" id="gqa-current">${curHtml}</div>
        <div class="gqa-preview-name" id="gqa-preview-name"></div>
        <button class="gqa-photo-btn" id="gqa-photo-btn">📷 写真を選ぶ</button>
        <div class="gqa-photo-hint">好きな写真や画像を<br>アイコンに設定できます</div>
        <input type="file" accept="image/*" id="gqa-photo" hidden>
      </div>
      <div class="gqa-main">
        <div class="gqa-emoji-grid">${emojiBtns}</div>
        <div class="gqa-row">
          <input id="genre-quick-input" class="genre-quick-input" type="text" maxlength="12" placeholder="ジャンル名">
          <button class="genre-quick-ok" id="genre-quick-ok" title="追加">✓</button>
          <button class="genre-quick-cancel" id="genre-quick-cancel" title="やめる">×</button>
        </div>
      </div>
    </div>`;
  } else {
    html += `<button class="genre-add-chip" id="genre-add-chip">＋ 追加</button>`;
  }
  container.innerHTML = html;

  // 選択
  container.querySelectorAll('.genre-tab').forEach(btn => {
    btn.addEventListener('click', () => { currentGenreId = btn.dataset.gid; renderGenreSelector(); });
  });
  // 削除（× は選択に伝播させない）
  container.querySelectorAll('.genre-tab-del').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); quickDeleteGenre(btn.dataset.del); });
  });
  // ＋追加チップ
  const addChip = document.getElementById('genre-add-chip');
  if (addChip) addChip.addEventListener('click', () => { genreQuickAdd = true; genreQuickEmoji = EMOJI_OPTIONS[0]; genreQuickImage = null; renderGenreSelector(); document.getElementById('genre-quick-input')?.focus(); });
  // 絵文字選択（入力テキストを保つため再描画せず class だけ更新）
  document.querySelectorAll('.gqa-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
      genreQuickEmoji = btn.dataset.emoji;
      genreQuickImage = null;  // 絵文字を選んだら写真は解除
      document.querySelectorAll('.gqa-emoji').forEach(b => b.classList.toggle('selected', b.dataset.emoji === genreQuickEmoji));
      const cur = document.getElementById('gqa-current'); if (cur) cur.textContent = genreQuickEmoji;
      document.getElementById('genre-quick-input')?.focus();
    });
  });
  // 写真を使う
  const photoBtn = document.getElementById('gqa-photo-btn');
  const photoInput = document.getElementById('gqa-photo');
  if (photoBtn && photoInput) {
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      _readGenreImage(file, dataUrl => {
        genreQuickImage = dataUrl;
        document.querySelectorAll('.gqa-emoji').forEach(b => b.classList.remove('selected'));
        const cur = document.getElementById('gqa-current');
        if (cur) cur.innerHTML = `<img src="${dataUrl}" class="genre-icon-img" alt="">`;
        document.getElementById('genre-quick-input')?.focus();
      });
    });
  }
  // 簡易追加フォーム
  const ok = document.getElementById('genre-quick-ok');     if (ok) ok.addEventListener('click', quickAddGenre);
  const cancel = document.getElementById('genre-quick-cancel'); if (cancel) cancel.addEventListener('click', () => { genreQuickAdd = false; renderGenreSelector(); });
  const input = document.getElementById('genre-quick-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); quickAddGenre(); }
      if (e.key === 'Escape') { genreQuickAdd = false; renderGenreSelector(); }
    });
    input.addEventListener('input', () => {
      const n = document.getElementById('gqa-preview-name');
      if (n) n.textContent = input.value || '';
    });
  }
}

// ダッシュボードから素早くジャンルを追加（絵文字・色は自動割り当て）
function quickAddGenre() {
  const input = document.getElementById('genre-quick-input');
  const name = (input?.value || '').trim();
  if (!name) { input?.focus(); return; }
  const emoji = genreQuickEmoji || EMOJI_OPTIONS[0];
  const color = COLOR_OPTIONS[genres.length % COLOR_OPTIONS.length];
  const g = { id: Date.now().toString(36), name, emoji, color, xp: 0, minutes: 0 };
  if (genreQuickImage) g.image = genreQuickImage;
  genres.push(g);
  currentGenreId = g.id;
  saveGenres();
  genreQuickAdd = false;
  genreQuickImage = null;
  renderGenreSelector();
  if (document.getElementById('genre-overlay')?.classList.contains('open')) renderGenreList();
  checkBadges();
}

// ダッシュボードから素早くジャンルを削除（確認あり・最低1つは残す）
function quickDeleteGenre(id) {
  if (genres.length <= 1) return;
  const g = genres.find(x => x.id === id);
  if (!confirm(`「${g ? g.name : ''}」を削除しますか？\nこのジャンルの記録も消えます。`)) return;
  genres = genres.filter(x => x.id !== id);
  if (currentGenreId === id) currentGenreId = genres[0]?.id || '';
  saveGenres();
  renderGenreSelector();
  if (document.getElementById('genre-overlay')?.classList.contains('open')) renderGenreList();
}

// ═══════════════════════════════════════════════════════
//  GENRE MODAL
// ═══════════════════════════════════════════════════════
function openGenreModal() {
  Overlay.open('genre-overlay');
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
      <div class="genre-item-emoji">${genreIcon(g)}</div>
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
  Overlay.close('genre-overlay');
});
document.getElementById('genre-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('genre-overlay'))
    Overlay.close('genre-overlay');
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
  fable: '空想の住人', kuro: 'クロからの言葉', tale: '物語と英雄',
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

  // ── 偉人（古典・歴史） ──────────────────────────────
  {id:'h0',  text:'これもまた過ぎ去る。',                       author:'ソロモン王（伝）', source:'', category:'classic', scenes:['comeback','night']},
  {id:'h1',  text:'吾、日に三たび吾が身を省みる。',             author:'曾子',           source:'論語', category:'classic', scenes:['night']},
  {id:'h2',  text:'知るを知るとし、知らざるを知らずとせよ。',   author:'孔子',           source:'論語', category:'classic', scenes:['session_start','night']},
  {id:'h3',  text:'過ちて改めざる、これを過ちという。',         author:'孔子',           source:'論語', category:'classic', scenes:['comeback']},
  {id:'h4',  text:'大器は晩成す。',                             author:'老子',           source:'', category:'classic', scenes:['streak_milestone','night']},
  {id:'h5',  text:'足るを知る者は富む。',                       author:'老子',           source:'', category:'classic', scenes:['night']},
  {id:'h6',  text:'汝自身を知れ。',                             author:'ソクラテス',     source:'', category:'classic', scenes:['morning','session_start']},
  {id:'h7',  text:'我々は繰り返す存在だ。ゆえに卓越とは行為ではなく習慣である。', author:'アリストテレス', source:'', category:'classic', scenes:['streak_milestone','morning']},
  {id:'h8',  text:'困難の中に、好機は潜む。',                   author:'アインシュタイン', source:'', category:'classic', scenes:['comeback','session_start']},
  {id:'h9',  text:'人生とは自転車のようなもの。倒れぬためには進み続けること。', author:'アインシュタイン', source:'', category:'classic', scenes:['morning','comeback']},
  {id:'h10', text:'明日死ぬかのように生き、永遠に生きるかのように学べ。', author:'ガンジー', source:'', category:'classic', scenes:['morning','session_start']},
  {id:'h11', text:'世界に変化を望むなら、あなた自身がその変化になれ。', author:'ガンジー', source:'', category:'classic', scenes:['morning','level_up']},
  {id:'h12', text:'闇を呪うより、一本のろうそくを灯すほうがいい。', author:'ことわざ（孔子に帰す）', source:'', category:'classic', scenes:['comeback','night']},
  {id:'h13', text:'準備を怠ることは、失敗の準備をすることだ。',  author:'ベンジャミン・フランクリン', source:'', category:'classic', scenes:['session_start','morning']},
  {id:'h14', text:'今日できることを明日に延ばすな。',           author:'ベンジャミン・フランクリン', source:'', category:'classic', scenes:['morning','session_start']},
  {id:'h15', text:'顔をいつも太陽に向けていれば、影は見えない。', author:'ヘレン・ケラー', source:'', category:'classic', scenes:['comeback','morning']},
  {id:'h16', text:'人生は冒険か、無か、そのどちらかだ。',       author:'ヘレン・ケラー', source:'', category:'classic', scenes:['morning','level_up']},
  {id:'h17', text:'恐れるべきは、立ち止まることだけだ。',       author:'ことわざ（中国）', source:'', category:'classic', scenes:['session_start','streak_milestone']},
  {id:'h18', text:'人生で最も大切なのは、転んだ回数ではなく、立ち上がった回数だ。', author:'ヴィンス・ロンバルディ', source:'', category:'classic', scenes:['comeback']},
  {id:'h19', text:'学びをやめたとき、人は老いる。',             author:'ヘンリー・フォード', source:'', category:'classic', scenes:['night','morning']},
  {id:'h20', text:'できると思えばできる。できないと思えばできない。', author:'ヘンリー・フォード', source:'', category:'classic', scenes:['session_start']},
  {id:'h21', text:'蒔いた種は、いつか必ず実る。',               author:'二宮尊徳（趣意）', source:'', category:'classic', scenes:['streak_milestone','session_complete']},
  {id:'h22', text:'志を立てるのに、遅すぎるということはない。', author:'スタンリー・ボールドウィン（趣意）', source:'', category:'classic', scenes:['comeback','morning']},
  {id:'h23', text:'一灯を提げて暗夜を行く。暗夜を憂うことなかれ、ただ一灯を頼め。', author:'佐藤一斎', source:'言志四録', category:'classic', scenes:['night','comeback']},

  // ── 世界のことわざ ──────────────────────────────
  {id:'pv0', text:'最良の時は今である。',                       author:'', source:'中国のことわざ', category:'proverb', scenes:['morning','session_start']},
  {id:'pv1', text:'ゆっくり行く者が、遠くまで行く。',           author:'', source:'イタリアのことわざ', category:'proverb', scenes:['streak_milestone']},
  {id:'pv2', text:'山を動かす者は、小さな石を運ぶことから始める。', author:'', source:'中国のことわざ', category:'proverb', scenes:['session_start']},
  {id:'pv3', text:'静かな水ほど、深く流れる。',                 author:'', source:'西洋のことわざ', category:'proverb', scenes:['night']},
  {id:'pv4', text:'落ちれば七度、立てば八度。',                 author:'', source:'日本のことわざ', category:'proverb', scenes:['comeback']},
  {id:'pv5', text:'一粒の米にも、汗の物語がある。',             author:'', source:'アジアのことわざ（趣意）', category:'proverb', scenes:['session_complete']},
  {id:'pv6', text:'今日歩かなければ、明日は走らねばならない。', author:'', source:'西洋のことわざ', category:'proverb', scenes:['morning']},
  {id:'pv7', text:'一人で行けば速い、みんなで行けば遠くへ。',   author:'', source:'アフリカのことわざ', category:'proverb', scenes:['night','streak_milestone']},
  {id:'pv8', text:'川は曲がっても、海へ辿り着く。',             author:'', source:'ことわざ（趣意）', category:'proverb', scenes:['comeback','night']},
  {id:'pv9', text:'種を蒔く者だけが、収穫を語れる。',           author:'', source:'ことわざ（趣意）', category:'proverb', scenes:['session_complete']},
  {id:'pv10',text:'石の上にも三年。',                           author:'', source:'日本のことわざ', category:'proverb', scenes:['streak_milestone']},
  {id:'pv11',text:'好きこそ物の上手なれ。',                     author:'', source:'日本のことわざ', category:'proverb', scenes:['morning','session_start']},
  {id:'pv12',text:'明けない夜はない。',                         author:'', source:'ことわざ', category:'proverb', scenes:['comeback','night']},

  // ── 空想の住人（クロの創作キャラ） ────────────────
  {id:'fb0', text:'地図にない道こそ、君だけの物語になる。',     author:'旅する賢者ノクト', source:'', category:'fable', scenes:['morning','session_start']},
  {id:'fb1', text:'星は、見上げる者にだけ瞬く。',               author:'星詠みの魔女セレネ', source:'', category:'fable', scenes:['night']},
  {id:'fb2', text:'根を深く張った木ほど、嵐を歌に変える。',     author:'世界樹の妖精リーフ', source:'', category:'fable', scenes:['streak_milestone','comeback']},
  {id:'fb3', text:'灯は、誰かが点け続けるかぎり消えない。',     author:'灯台守のオルゴ', source:'', category:'fable', scenes:['night','comeback']},
  {id:'fb4', text:'千年を生きた我から見れば、君の一歩は流星のように眩しい。', author:'古竜アウレリオ', source:'', category:'fable', scenes:['session_start','level_up']},
  {id:'fb5', text:'時は止められぬ。ならば、美しく使おうではないか。', author:'時計塔の番人ティク', source:'', category:'fable', scenes:['morning']},
  {id:'fb6', text:'今日のあなたの歌を、明日の誰かが口ずさむ。', author:'旅の吟遊詩人フィン', source:'', category:'fable', scenes:['session_complete']},
  {id:'fb7', text:'霧の向こうは、進んだ者にしか晴れない。',     author:'渡り鳥の導きフェイ', source:'', category:'fable', scenes:['comeback','session_start']},
  {id:'fb8', text:'小さな炎も、絶やさなければやがて篝火になる。', author:'炎の精ピロ', source:'', category:'fable', scenes:['streak_milestone']},
  {id:'fb9', text:'扉は、叩いた者の前にだけ開く。',             author:'門番の精霊ゲイト', source:'', category:'fable', scenes:['session_start','level_up']},
  {id:'fb10',text:'波は引いても、必ずまた満ちる。焦らずとも。', author:'海の長ティオ', source:'', category:'fable', scenes:['comeback','night']},
  {id:'fb11',text:'種のうちは誰にも気づかれない。それでいい、君は育っている。', author:'庭師の妖精ソラ', source:'', category:'fable', scenes:['morning','session_complete']},
  {id:'fb12',text:'迷子になるのは、世界を広げている証拠だ。',   author:'地図描きのルカ', source:'', category:'fable', scenes:['comeback']},
  {id:'fb13',text:'静けさの中にこそ、いちばん大きな力が眠る。', author:'夜の番人ヨル', source:'', category:'fable', scenes:['night']},
  {id:'fb14',text:'昨日より一歩。それが、英雄の最初の条件だ。', author:'剣の師ガラン', source:'', category:'fable', scenes:['session_start','level_up']},

  // ── クロからの言葉（オリジナル） ──────────────────
  {id:'kr0', text:'よく来たね。今日のあなたに、会えてうれしい。', author:'クロ', source:'', category:'kuro', scenes:['morning']},
  {id:'kr1', text:'5分でいい。始めた時点で、もう昨日を超えてる。', author:'クロ', source:'', category:'kuro', scenes:['session_start','morning']},
  {id:'kr2', text:'今日できなかったことは、できる日のための準備だよ。', author:'クロ', source:'', category:'kuro', scenes:['comeback','night']},
  {id:'kr3', text:'数字じゃ測れない成長を、あなたは今日も積んでいる。', author:'クロ', source:'', category:'kuro', scenes:['session_complete','night']},
  {id:'kr4', text:'やる気は待つものじゃない。手を動かすと、後から来る。', author:'クロ', source:'', category:'kuro', scenes:['session_start']},
  {id:'kr5', text:'続けているその事実が、もう才能だよ。',       author:'クロ', source:'', category:'kuro', scenes:['streak_milestone']},
  {id:'kr6', text:'戻ってきてくれて、ありがとう。それだけで百点。', author:'クロ', source:'', category:'kuro', scenes:['comeback']},
  {id:'kr7', text:'今日の一歩は小さくても、未来からは大きく見える。', author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr8', text:'比べる相手は、いつだって昨日のあなただけ。', author:'クロ', source:'', category:'kuro', scenes:['morning','session_start']},
  {id:'kr9', text:'おつかれさま。今日のあなたは、ちゃんとえらい。', author:'クロ', source:'', category:'kuro', scenes:['session_complete','night']},
  {id:'kr10',text:'休むのも、前に進むための立派な一歩だよ。',   author:'クロ', source:'', category:'kuro', scenes:['night','comeback']},
  {id:'kr11',text:'迷っていい。迷えるのは、進もうとしている証。', author:'クロ', source:'', category:'kuro', scenes:['comeback','morning']},
  {id:'kr12',text:'レベルが上がった。でも本当にすごいのは、上げたあなた自身。', author:'クロ', source:'', category:'kuro', scenes:['level_up']},
  {id:'kr13',text:'静かな夜に積んだ一行が、いつか物語になる。', author:'クロ', source:'', category:'kuro', scenes:['night']},
  {id:'kr14',text:'うまくいかない日も、ちゃんと記録に残る。それが財産。', author:'クロ', source:'', category:'kuro', scenes:['comeback','session_complete']},
  {id:'kr15',text:'今日も会いに来てくれた。その習慣が、未来を変える。', author:'クロ', source:'', category:'kuro', scenes:['morning','streak_milestone']},
  {id:'kr16',text:'急がなくていい。あなたのペースが、あなたの正解。', author:'クロ', source:'', category:'kuro', scenes:['morning']},
  {id:'kr17',text:'手が止まっても、心が前を向いていれば、それは前進。', author:'クロ', source:'', category:'kuro', scenes:['comeback']},
  {id:'kr18',text:'小さな「できた」を、どうか見逃さないで。',   author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr19',text:'あなたが諦めない限り、物語はまだ途中だ。',   author:'クロ', source:'', category:'kuro', scenes:['comeback','level_up']},

  // ── クロからの言葉（第2弾） ──────────────────────
  {id:'kr20',text:'おはよう。今日のあなたにしか書けない1ページがある。', author:'クロ', source:'', category:'kuro', scenes:['morning']},
  {id:'kr21',text:'眠い朝も、机に向かった勇気は本物だよ。',     author:'クロ', source:'', category:'kuro', scenes:['morning','session_start']},
  {id:'kr22',text:'今日は調子が出ない？それでも来た。それが一番えらい。', author:'クロ', source:'', category:'kuro', scenes:['comeback','morning']},
  {id:'kr23',text:'積み上げた時間は、裏切らずに必ずあなたの味方になる。', author:'クロ', source:'', category:'kuro', scenes:['session_complete','streak_milestone']},
  {id:'kr24',text:'結果より、向き合った時間そのものを誇っていい。', author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr25',text:'誰かと比べそうになったら、深呼吸。あなたの道はあなたの速さで。', author:'クロ', source:'', category:'kuro', scenes:['morning','comeback']},
  {id:'kr26',text:'一区切りついたね。よくここまで歩いた。',       author:'クロ', source:'', category:'kuro', scenes:['session_complete','night']},
  {id:'kr27',text:'今日の小さな一歩を、未来のあなたが感謝するよ。', author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr28',text:'できない自分を責めないで。気づけた時点で前進してる。', author:'クロ', source:'', category:'kuro', scenes:['comeback','night']},
  {id:'kr29',text:'集中が切れてもいい。また戻ってくればいいだけ。', author:'クロ', source:'', category:'kuro', scenes:['session_start','comeback']},
  {id:'kr30',text:'夜の静けさは、思考が深く潜るための海だよ。',   author:'クロ', source:'', category:'kuro', scenes:['night']},
  {id:'kr31',text:'がんばり屋さん。たまには自分をぎゅっと抱きしめて。', author:'クロ', source:'', category:'kuro', scenes:['night']},
  {id:'kr32',text:'レベルが上がった。あなたの「続ける力」の勲章だね。', author:'クロ', source:'', category:'kuro', scenes:['level_up']},
  {id:'kr33',text:'連続記録、すごいよ。これはもう才能と呼んでいい。', author:'クロ', source:'', category:'kuro', scenes:['streak_milestone']},
  {id:'kr34',text:'うまくいかない日は、伸びる準備をしている日。',  author:'クロ', source:'', category:'kuro', scenes:['comeback']},
  {id:'kr35',text:'今日もそばにいるよ。ひとりで頑張らなくていい。', author:'クロ', source:'', category:'kuro', scenes:['session_start','morning']},
  {id:'kr36',text:'1分の集中も、0分とは天と地の差がある。',       author:'クロ', source:'', category:'kuro', scenes:['session_start']},
  {id:'kr37',text:'迷いながらでいい。一歩は一歩、ちゃんと前だ。',  author:'クロ', source:'', category:'kuro', scenes:['comeback']},
  {id:'kr38',text:'あなたのペースを、世界で一番信じているのはクロだよ。', author:'クロ', source:'', category:'kuro', scenes:['morning','level_up']},
  {id:'kr39',text:'今日のおつかれは、明日のあなたへの贈り物。',   author:'クロ', source:'', category:'kuro', scenes:['session_complete','night']},
  {id:'kr40',text:'休む勇気も、進む勇気と同じくらい尊い。',       author:'クロ', source:'', category:'kuro', scenes:['night','comeback']},
  {id:'kr41',text:'小さな達成を、声に出して褒めてあげて。「よくやった」って。', author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr42',text:'やる前の不安より、やった後の自分を信じよう。',  author:'クロ', source:'', category:'kuro', scenes:['session_start']},
  {id:'kr43',text:'今日のあなたは、半年前のあなたの「未来」だよ。', author:'クロ', source:'', category:'kuro', scenes:['streak_milestone','level_up']},
  {id:'kr44',text:'完璧じゃなくていい。続いている、それが奇跡。',  author:'クロ', source:'', category:'kuro', scenes:['streak_milestone']},

  // ── 空想の住人（第2弾・新しい登場人物） ──────────
  {id:'fb15',text:'砂漠で大切なのは速さじゃない。歩き続ける足だ。', author:'隊商長カイ', source:'', category:'fable', scenes:['streak_milestone','session_start']},
  {id:'fb16',text:'頂はいつも、最後の一歩のすぐ先にある。',     author:'雪山の導師ユキ', source:'', category:'fable', scenes:['comeback','level_up']},
  {id:'fb17',text:'良い刃は、何度も叩かれてこそ生まれる。',     author:'鍛冶の親方ドゥーラ', source:'', category:'fable', scenes:['comeback','session_complete']},
  {id:'fb18',text:'答えはいつも、開きかけの本の次のページにある。', author:'司書ミラ', source:'', category:'fable', scenes:['session_start','night']},
  {id:'fb19',text:'蒔いた種を、毎日掘り返してはいけないよ。信じてお待ち。', author:'種屋のおばあミナ', source:'', category:'fable', scenes:['streak_milestone','morning']},
  {id:'fb20',text:'向かい風は、君を高く飛ばすためにある。',     author:'風使いゼフ', source:'', category:'fable', scenes:['comeback','session_start']},
  {id:'fb21',text:'影が濃いのは、それだけ強い光の近くにいる証。', author:'影の踊り子ノワ', source:'', category:'fable', scenes:['comeback','night']},
  {id:'fb22',text:'鏡は嘘をつかない。今日のあなたは、昨日より少し優しい顔だ。', author:'鏡の精ミラージュ', source:'', category:'fable', scenes:['night','morning']},
  {id:'fb23',text:'北はいつもそこにある。迷っても、また指せばいい。', author:'羅針盤の精コンパス', source:'', category:'fable', scenes:['comeback','session_start']},
  {id:'fb24',text:'満ちる月も、欠ける月も、同じ月。波があって当たり前。', author:'月読みのルナ', source:'', category:'fable', scenes:['comeback','night']},
  {id:'fb25',text:'夜明けは、いちばん暗い時刻のすぐ後に来る。',   author:'朝告げ鳥アウル', source:'', category:'fable', scenes:['comeback','morning']},
  {id:'fb26',text:'澄んだ泉は、静かに湧き続けた時間のたまもの。', author:'泉の精アクア', source:'', category:'fable', scenes:['session_complete','night']},
  {id:'fb27',text:'数は嘘をつかない。君の積み上げを、ちゃんと覚えている。', author:'数の魔術師ヌメロ', source:'', category:'fable', scenes:['streak_milestone','session_complete']},
  {id:'fb28',text:'言葉は種。今日まいた一語が、いつか森になる。',  author:'言葉紡ぎのソフィア', source:'', category:'fable', scenes:['session_complete','morning']},
  {id:'fb29',text:'錨を上げよ。港にいては、君の海図は白いままだ。', author:'船長マレー', source:'', category:'fable', scenes:['session_start','level_up']},
  {id:'fb30',text:'歯車はひとつでも止まれば、時を失う。君の一歩がその歯車だ。', author:'時計塔の番人ティク', source:'', category:'fable', scenes:['session_start']},
  {id:'fb31',text:'雨の日に伸びた根は、晴れの日に強く立つ。',     author:'庭師の妖精ソラ', source:'', category:'fable', scenes:['comeback','streak_milestone']},
  {id:'fb32',text:'灯をひとつ。それだけで、暗い部屋は世界になる。', author:'灯台守のオルゴ', source:'', category:'fable', scenes:['night','comeback']},
  {id:'fb33',text:'宝の地図は、歩いた者の足跡で完成する。',       author:'地図描きのルカ', source:'', category:'fable', scenes:['session_complete','level_up']},
  {id:'fb34',text:'小川のせせらぎも、続けば谷を刻む。',         author:'渓谷の精リル', source:'', category:'fable', scenes:['streak_milestone']},
  {id:'fb35',text:'星座は、点と点を結ぶ勇気から生まれた。',     author:'星詠みの魔女セレネ', source:'', category:'fable', scenes:['level_up','night']},

  // ── ことわざ・格言（第2弾） ──────────────────────
  {id:'pv13',text:'雨垂れ石を穿つ。',                           author:'', source:'ことわざ', category:'proverb', scenes:['streak_milestone']},
  {id:'pv14',text:'継続は力なり。',                             author:'', source:'格言', category:'proverb', scenes:['streak_milestone','morning']},
  {id:'pv15',text:'七転び八起き。',                             author:'', source:'日本のことわざ', category:'proverb', scenes:['comeback']},
  {id:'pv16',text:'まかぬ種は生えぬ。',                         author:'', source:'日本のことわざ', category:'proverb', scenes:['session_start']},
  {id:'pv17',text:'時は金なり。',                               author:'', source:'格言', category:'proverb', scenes:['morning']},
  {id:'pv18',text:'急いては事を仕損じる。',                     author:'', source:'日本のことわざ', category:'proverb', scenes:['session_start']},
  {id:'pv19',text:'やってみせ、言って聞かせて、させてみせ。',   author:'', source:'格言（趣意）', category:'proverb', scenes:['session_start']},
  {id:'pv20',text:'実るほど頭を垂れる稲穂かな。',               author:'', source:'日本のことわざ', category:'proverb', scenes:['level_up','night']},
  {id:'pv21',text:'門を出ずれば、すなわち道あり。',             author:'', source:'東洋のことわざ', category:'proverb', scenes:['session_start','comeback']},
  {id:'pv22',text:'転がる石に苔は生えぬ。',                     author:'', source:'西洋のことわざ', category:'proverb', scenes:['morning','streak_milestone']},
  {id:'pv23',text:'今日の一針、明日の十針。',                   author:'', source:'西洋のことわざ', category:'proverb', scenes:['session_start']},
  {id:'pv24',text:'木を植える最良の時は20年前、次に良いのは今。', author:'', source:'ことわざ', category:'proverb', scenes:['morning','comeback']},
  {id:'pv25',text:'灯火に近づく者ほど、影は短い。',             author:'', source:'ことわざ（趣意）', category:'proverb', scenes:['session_start','night']},
  {id:'pv26',text:'一寸先は光。',                               author:'', source:'格言（趣意）', category:'proverb', scenes:['comeback','night']},
  {id:'pv27',text:'よく学び、よく遊べ。',                       author:'', source:'格言', category:'proverb', scenes:['morning','session_complete']},

  // ── 古典・偉人（第2弾） ──────────────────────────
  {id:'h24', text:'我思う、ゆえに我あり。',                     author:'デカルト', source:'', category:'classic', scenes:['night','session_start']},
  {id:'h25', text:'人間は努力する限り、迷うものだ。',           author:'ゲーテ', source:'ファウスト', category:'classic', scenes:['comeback','night']},
  {id:'h26', text:'時間を最も多く持つ者は、最も多くを成し得る。', author:'パスカル（趣意）', source:'', category:'classic', scenes:['morning']},
  {id:'h27', text:'山に登るのは、頂のためではなく、登る自分のためだ。', author:'登山家の言葉（趣意）', source:'', category:'classic', scenes:['session_start','level_up']},
  {id:'h28', text:'希望はよき朝食だが、悪しき夕食である。',     author:'フランシス・ベーコン', source:'', category:'classic', scenes:['morning']},
  {id:'h29', text:'始めることが、仕事の半分を終えたことになる。', author:'ホラティウス（趣意）', source:'', category:'classic', scenes:['session_start']},
  {id:'h30', text:'勇気とは、恐れないことではなく、恐れに打ち克つことだ。', author:'マーク・トウェイン（趣意）', source:'', category:'classic', scenes:['comeback','session_start']},
  {id:'h31', text:'ゆっくりでもいい。立ち止まらなければ。',     author:'孔子（趣意）', source:'', category:'classic', scenes:['streak_milestone','comeback']},
  {id:'h32', text:'良き書物を読むことは、過去の最良の人々と語らうことだ。', author:'デカルト', source:'', category:'classic', scenes:['night','session_complete']},
  {id:'h33', text:'人は習慣によってつくられる。よい習慣をつくれ。', author:'アリストテレス（趣意）', source:'', category:'classic', scenes:['streak_milestone','morning']},
  {id:'h34', text:'運命は、勇者に味方する。',                   author:'ウェルギリウス', source:'', category:'classic', scenes:['session_start','level_up']},
  {id:'h35', text:'今日という日は、二度とこない贈り物だ。',     author:'ことわざ（趣意）', source:'', category:'classic', scenes:['morning']},
  {id:'h36', text:'石を打ち砕くのは、最後の一打ではない。それまでの全ての打である。', author:'ヤコブ・リース', source:'', category:'classic', scenes:['streak_milestone','comeback']},
  {id:'h37', text:'為せば成る、為さねば成らぬ何事も。',         author:'上杉鷹山', source:'', category:'classic', scenes:['session_start','comeback']},
  {id:'h38', text:'夢なき者に成功なし。',                       author:'吉田松陰', source:'', category:'classic', scenes:['morning','level_up']},

  // ── 物語と英雄（公有の文学・神話・英雄譚をクロが言い換え／趣意） ──
  {id:'tl0',  text:'もう一度。ただ、それだけのために英雄は立ち上がる。', author:'ある英雄譚より', source:'趣意', category:'tale', scenes:['comeback']},
  {id:'tl1',  text:'最も暗い夜のあとに、もっとも強い夜明けが来る。', author:'古い物語より', source:'趣意', category:'tale', scenes:['comeback','morning']},
  {id:'tl2',  text:'剣を鍛えるのは炎ではない。打ち続ける意志だ。', author:'鍛冶譚より', source:'趣意', category:'tale', scenes:['streak_milestone','session_complete']},
  {id:'tl3',  text:'迷宮を抜ける糸は、いつも「もう一歩」という名だ。', author:'迷宮の物語より', source:'趣意', category:'tale', scenes:['comeback','session_start']},
  {id:'tl4',  text:'巨人は、恐れる者の心の中で一番大きくなる。', author:'英雄譚より', source:'趣意', category:'tale', scenes:['session_start','comeback']},
  {id:'tl5',  text:'旅の価値は、辿り着いた場所ではなく、変わった自分にある。', author:'ある旅人の手記', source:'趣意', category:'tale', scenes:['session_complete','night']},
  {id:'tl6',  text:'宝は、地図の終わりではなく、歩いた道のりに隠れていた。', author:'宝探しの物語より', source:'趣意', category:'tale', scenes:['session_complete']},
  {id:'tl7',  text:'神々は、自ら助くる者を助く。', author:'古の格言より', source:'趣意', category:'tale', scenes:['session_start','morning']},
  {id:'tl8',  text:'不死鳥は、灰の中からしか生まれない。', author:'神話より', source:'趣意', category:'tale', scenes:['comeback','level_up']},
  {id:'tl9',  text:'星をつかもうとして手を伸ばす。それだけで、人は少し背が伸びる。', author:'星追いの物語より', source:'趣意', category:'tale', scenes:['level_up','morning']},
  {id:'tl10', text:'長い冬を耐えた木だけが、春に一番濃い花をつける。', author:'森の寓話より', source:'趣意', category:'tale', scenes:['comeback','streak_milestone']},
  {id:'tl11', text:'灯台は嵐の夜にこそ、その意味を知る。', author:'海の物語より', source:'趣意', category:'tale', scenes:['comeback','night']},
  {id:'tl12', text:'石の中に眠る像を、彫り手はただ解き放つだけ。君の才能もそこにある。', author:'彫刻師の寓話より', source:'趣意', category:'tale', scenes:['session_start','level_up']},
  {id:'tl13', text:'勇者の剣より、続けるという小さな盾が、最後に君を守る。', author:'騎士譚より', source:'趣意', category:'tale', scenes:['streak_milestone']},
  {id:'tl14', text:'ドラゴンを倒した者より、毎朝起きて鍛えた者を、詩人は長く歌う。', author:'吟遊詩人の唄より', source:'趣意', category:'tale', scenes:['streak_milestone','morning']},
  {id:'tl15', text:'扉に鍵がかかっているのは、君がその鍵を育てている途中だからだ。', author:'魔法の物語より', source:'趣意', category:'tale', scenes:['comeback','session_start']},
  {id:'tl16', text:'巡礼の道は、最初の一歩で半分終わっている。', author:'巡礼の記より', source:'趣意', category:'tale', scenes:['session_start']},
  {id:'tl17', text:'名もなき兵の一歩が、語り継がれる戦を決めた。', author:'戦記より', source:'趣意', category:'tale', scenes:['session_complete','streak_milestone']},
  {id:'tl18', text:'人魚は声を捨てても、進むことを選んだ。望みのために何かを差し出す君も、美しい。', author:'海の童話より', source:'趣意', category:'tale', scenes:['comeback','night']},
  {id:'tl19', text:'マッチ一本の灯りでも、凍える夜には世界のすべてになる。', author:'冬の童話より', source:'趣意', category:'tale', scenes:['night','comeback']},
  {id:'tl20', text:'亀は今日も、兎を気にせず歩いている。', author:'寓話より', source:'趣意', category:'tale', scenes:['streak_milestone']},
  {id:'tl21', text:'風車を巨人と思って挑む心が、世界を少しだけ広げる。', author:'遍歴の騎士の物語より', source:'趣意', category:'tale', scenes:['session_start','morning']},
  {id:'tl22', text:'底まで沈んだ者だけが、水を蹴って浮き上がれる。', author:'ある手記より', source:'趣意', category:'tale', scenes:['comeback']},
  {id:'tl23', text:'種をまく人は、自分が木陰に座れぬと知っていても、まく。', author:'古いことわざより', source:'趣意', category:'tale', scenes:['session_complete','night']},
  {id:'tl24', text:'勇気は、心臓ではなく、踏み出した足の裏に宿る。', author:'英雄譚より', source:'趣意', category:'tale', scenes:['session_start','comeback']},

  // ── 古典・偉人（第3弾・公有の知恵） ──────────────
  {id:'h39', text:'生きるとは、呼吸することではない。行動することだ。', author:'ルソー（趣意）', source:'', category:'classic', scenes:['session_start','morning']},
  {id:'h40', text:'我々の最大の弱点は、諦めることにある。',           author:'エジソン（趣意）', source:'', category:'classic', scenes:['comeback']},
  {id:'h41', text:'幸福は習慣である。それを身につけよ。',             author:'ハバード（趣意）', source:'', category:'classic', scenes:['streak_milestone','morning']},
  {id:'h42', text:'読書は精神にとって、運動が身体にとってのものと同じだ。', author:'スティール（趣意）', source:'', category:'classic', scenes:['night','session_start']},
  {id:'h43', text:'小さなことを忠実に行う者が、大きなことを成す。',   author:'古の賢人（趣意）', source:'', category:'classic', scenes:['session_complete']},
  {id:'h44', text:'運は、準備が機会と出会ったときに生まれる。',       author:'セネカ（趣意）', source:'', category:'classic', scenes:['session_start','level_up']},
  {id:'h45', text:'怒りに支配されず、自分の手綱は自分で握れ。',       author:'マルクス・アウレリウス（趣意）', source:'自省録', category:'classic', scenes:['night']},
  {id:'h46', text:'君が今日できることを、星に願うな。手を動かせ。',   author:'古の格言（趣意）', source:'', category:'classic', scenes:['session_start']},
  {id:'h47', text:'川は岩を、力ではなく辛抱で穿つ。',               author:'東洋の賢人（趣意）', source:'', category:'classic', scenes:['streak_milestone']},
  {id:'h48', text:'希望を持つ者は、まだ何も失っていない。',         author:'ある哲人（趣意）', source:'', category:'classic', scenes:['comeback','night']},
  {id:'h49', text:'明日は今日の弟子である。',                       author:'プブリリウス（趣意）', source:'', category:'classic', scenes:['morning']},
  {id:'h50', text:'人は、自分が思っている通りの人間になる。',       author:'古の知恵（趣意）', source:'', category:'classic', scenes:['morning','level_up']},

  // ── 空想の住人（第3弾） ──────────────────────────
  {id:'fb36',text:'迷ったら、いちばん心が震える方へ進みなさい。',   author:'森の魔女ヘイゼル', source:'', category:'fable', scenes:['morning','session_start']},
  {id:'fb37',text:'失くした道具は、新しい工夫の母になる。',         author:'発明家のおじいゴグ', source:'', category:'fable', scenes:['comeback']},
  {id:'fb38',text:'霜が降りた朝ほど、空は青く澄む。',               author:'雪原の狐シロ', source:'', category:'fable', scenes:['morning','night']},
  {id:'fb39',text:'糸は細くても、織り続ければ毛布になる。',         author:'機織りのおばあタペ', source:'', category:'fable', scenes:['streak_milestone']},
  {id:'fb40',text:'灯心は、油がある限り燃え続けられる。君の油は「好き」だ。', author:'灯し人ともり', source:'', category:'fable', scenes:['session_start','morning']},
  {id:'fb41',text:'地図の端の「ここから先、未知」。そこが一番面白い。', author:'探検家のおじロウ', source:'', category:'fable', scenes:['level_up','session_start']},
  {id:'fb42',text:'鐘は、撞かれて初めて音になる。動いてこそ君だ。',   author:'鐘楼守のカネオ', source:'', category:'fable', scenes:['session_start']},
  {id:'fb43',text:'雨宿りも旅のうち。空が泣き止むまで、お茶でもどうぞ。', author:'旅籠の主ベン', source:'', category:'fable', scenes:['night','comeback']},
  {id:'fb44',text:'種の図鑑に「咲かない花」は載っていない。',       author:'植物学者の精ボタ', source:'', category:'fable', scenes:['comeback','morning']},
  {id:'fb45',text:'波打ち際の足跡は消える。でも、歩いた事実は消えない。', author:'渚の語り部シオ', source:'', category:'fable', scenes:['session_complete','night']},
  {id:'fb46',text:'同じ星空でも、見上げるたびに違う物語が見える。',   author:'天文台のミラ', source:'', category:'fable', scenes:['night','level_up']},
  {id:'fb47',text:'歯車に大小はあれど、止まっていい歯車はひとつもない。', author:'時計師ゼンマイ', source:'', category:'fable', scenes:['session_start']},
  {id:'fb48',text:'凍った湖の下でも、魚はちゃんと泳いでいる。見えなくても、君は進んでる。', author:'氷上の漁師フユ', source:'', category:'fable', scenes:['comeback']},
  {id:'fb49',text:'パン種は一晩で膨らむ。焦らず、寝て待つのも技術だよ。', author:'パン屋のクラム', source:'', category:'fable', scenes:['night','streak_milestone']},
  {id:'fb50',text:'羅針盤が北を指すのは、揺れても戻る勇気があるからだ。', author:'航海士ノルテ', source:'', category:'fable', scenes:['comeback','session_start']},

  // ── クロからの言葉（第3弾） ──────────────────────
  {id:'kr45',text:'今日のあなたに、いちばん優しくできるのはあなた自身だよ。', author:'クロ', source:'', category:'kuro', scenes:['night']},
  {id:'kr46',text:'数字が伸びない日も、あなたの根はちゃんと伸びてる。', author:'クロ', source:'', category:'kuro', scenes:['comeback','session_complete']},
  {id:'kr47',text:'「また来た」。その一回が、未来をまるごと変えるんだ。', author:'クロ', source:'', category:'kuro', scenes:['morning','streak_milestone']},
  {id:'kr48',text:'集中できた今日も、できなかった昨日も、全部あなたの物語。', author:'クロ', source:'', category:'kuro', scenes:['night','comeback']},
  {id:'kr49',text:'始める前のあなたへ。大丈夫、クロが隣にいるよ。',   author:'クロ', source:'', category:'kuro', scenes:['session_start']},
  {id:'kr50',text:'終わったあとのあなたへ。本当によく頑張ったね。',   author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr51',text:'人と比べる物差しは、そっと折ってしまっていい。',   author:'クロ', source:'', category:'kuro', scenes:['morning','comeback']},
  {id:'kr52',text:'今日積んだ一行が、いつか誰かを救う言葉になるかも。', author:'クロ', source:'', category:'kuro', scenes:['session_complete','night']},
  {id:'kr53',text:'うまくできた日は、思いきり喜んでいいんだよ。',     author:'クロ', source:'', category:'kuro', scenes:['level_up','session_complete']},
  {id:'kr54',text:'休んだ日も、ちゃんとあなたを育てている。',         author:'クロ', source:'', category:'kuro', scenes:['night','comeback']},
  {id:'kr55',text:'迷子の日こそ、世界を広げている最中だよ。',         author:'クロ', source:'', category:'kuro', scenes:['comeback']},
  {id:'kr56',text:'あなたの「続ける」は、静かだけど一番強い魔法。',   author:'クロ', source:'', category:'kuro', scenes:['streak_milestone']},
  {id:'kr57',text:'今日も会えてうれしい。明日も、待ってるね。',       author:'クロ', source:'', category:'kuro', scenes:['night','morning']},
  {id:'kr58',text:'できる・できないの前に、向き合えた自分を見て。',   author:'クロ', source:'', category:'kuro', scenes:['session_complete']},
  {id:'kr59',text:'あなたのペースが世界の標準。誰の真似もいらない。', author:'クロ', source:'', category:'kuro', scenes:['morning']},
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
  let pool    = fresh.length ? fresh : cands;
  // 装備効果 quote_bias：そのカテゴリの言葉に出会いやすくなる（60%の確率で優先）
  const biasItem = (typeof getEquippedEffectItem === 'function') ? getEquippedEffectItem('quote_bias') : null;
  if (biasItem && Math.random() < 0.6) {
    const biased = pool.filter(q => q.category === biasItem.effect.value);
    if (biased.length) pool = biased;
  }
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
  // 響く言葉はダッシュボードから外したため、表示ウィジェットが無ければ
  // 「今日の一言」だけ内部に保持して描画はスキップ（💬モーダルや週次で利用）
  const scene = detectDailyScene();
  currentDailyQuote = pickQuote(scene);
  const card = document.getElementById('daily-quote-card');
  if (!card) return;
  if (!currentDailyQuote) { card.style.display = 'none'; return; }
  card.style.display = '';
  document.getElementById('dq-scene-tag').textContent = SCENE_TAG_LABELS[scene] || '今日の一言';
  document.getElementById('dq-text').textContent = `「${currentDailyQuote.text}」`;
  const meta = [currentDailyQuote.author, currentDailyQuote.source].filter(Boolean).join(' ・ ');
  document.getElementById('dq-author').textContent = meta ? `— ${meta}` : '';
  updateDQFavBtn();
}

function updateDQFavBtn() {
  if (!currentDailyQuote) return;
  const btn = document.getElementById('dq-fav-btn');
  if (!btn) return;
  const isFav = favIds.has(currentDailyQuote.id);
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

// Daily quote buttons（ダッシュボードに無い場合もあるためガード）
document.getElementById('dq-fav-btn')?.addEventListener('click', () => {
  if (!currentDailyQuote) return;
  toggleFav(currentDailyQuote.id);
  updateDQFavBtn();
  if (document.getElementById('words-overlay').classList.contains('open')) renderWordsList();
});
document.getElementById('dq-share-btn')?.addEventListener('click', () => {
  copyQuoteToClipboard(currentDailyQuote);
  const btn = document.getElementById('dq-share-btn');
  btn.textContent = '✓ コピー済み'; setTimeout(() => { btn.textContent = '📤 コピー'; }, 1800);
});
document.getElementById('dq-refresh-btn')?.addEventListener('click', () => {
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
  Overlay.open('words-overlay');
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
document.getElementById('words-btn')?.addEventListener('click', openWordsModal);
document.getElementById('words-close-btn').addEventListener('click', () =>
  Overlay.close('words-overlay'));
document.getElementById('words-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('words-overlay'))
    Overlay.close('words-overlay');
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

// ── バッジ大量生成（既存データに連動した実績バッジ）──────────
(function generateBadges() {
  const G = () => (typeof genres !== 'undefined' ? genres : []);
  const rar = f => f < 0.4 ? 'common' : f < 0.68 ? 'rare' : f < 0.88 ? 'epic' : 'legendary';
  const hist = () => (data.history || {});
  const detVals = () => Object.values(data.historyDetails || {});
  const sum = arr => arr.reduce((a,b)=>a+b,0);
  // 共通メトリクス
  const M = {
    sessions:    () => data.sessions || 0,
    minutes:     () => data.totalMinutes || 0,
    days:        () => Object.keys(hist()).filter(k => hist()[k] > 0).length,
    streak:      () => data.streak || 0,
    level:       () => data.level || 1,
    morning:     () => data.morningSessions || 0,
    night:       () => data.nightSessions || 0,
    flow:        () => data.flowSessions || 0,
    favs:        () => (typeof favIds !== 'undefined' ? favIds.size : 0),
    praise:      () => (typeof praiseLogs !== 'undefined' ? sum(Object.values(praiseLogs).map(a => a.length)) : 0),
    skill:       () => (typeof skillData !== 'undefined' ? Object.keys(skillData).length : 0),
    meta:        () => Object.keys(earnedBadges).length,
    conf:        () => data.confidenceLevel || 1,
    equip:       () => (typeof inventory !== 'undefined' ? inventory.length : 0),
    gcount:      () => G().length,
    gmax:        () => Math.max(0, ...G().map(g => g.minutes || 0)),
    bestDay:     () => Math.max(0, ...Object.values(hist())),
    sgPos:       () => (typeof sugorokuData !== 'undefined' ? sugorokuData.pos || 0 : 0),
    sgStage:     () => (typeof sugorokuData !== 'undefined' ? sugorokuData.stage || 1 : 1),
    tlDays:      () => (typeof dayLog !== 'undefined' ? Object.keys(dayLog).length : 0),
    tlBlocks:    () => (typeof dayLog !== 'undefined' ? sum(Object.values(dayLog).map(a => a.length)) : 0),
    reviews:     () => (typeof weeklyReviews !== 'undefined' ? Object.keys(weeklyReviews).length : 0),
    bestSess:    () => Math.max(0, ...detVals().map(d => (d && d.sessions) || 0)),
  };
  const fam = (idp, base, emojis, cat, metric, ths, unit, suffixFn) => {
    ths.forEach((t,i) => {
      const f = ths.length > 1 ? i/(ths.length-1) : 1;
      const ic = Array.isArray(emojis) ? emojis[Math.min(emojis.length-1, Math.floor(f*emojis.length))] : emojis;
      BADGES.push({
        id: `${idp}_${t}`,
        name: suffixFn ? suffixFn(t) : `${base} ${t}${unit||''}`,
        desc: `${base}が ${t}${unit||''} に到達`,
        icon: ic, cat, rarity: rar(f),
        check: () => metric() >= t,
      });
    });
  };
  const HR = a => a.map(h => h*60);

  // ── 進捗の節目（コアは少し細かく、他は厳選） ──
  fam('s','セッション',['🌱','📗','📘','🎓','🏆'],'total', M.sessions,
    [1,5,10,25,50,100,250,500,1000],'回');
  fam('h','累計学習',['⏳','🕐','📚','💎','🌌'],'total', M.minutes,
    HR([1,5,10,25,50,100,250,500,1000]),'', t => `累計 ${Math.round(t/60)}時間`);
  fam('d','学習日数',['📅','🗓️','📆','🌟','👑'],'streak', M.days,
    [1,7,30,100,365,1000],'日');
  fam('st','連続記録',['🔥','💪','👹','💎','🐉'],'streak', M.streak,
    [3,7,14,30,100,365,1000],'日連続');
  fam('lv','レベル',['✨','⭐','🌟','💫','👑'],'special', M.level,
    [5,10,20,30,50,100],'到達', t => `レベル ${t} 到達`);
  fam('mo','朝活',['🌅','☀️','👑'],'start', M.morning, [5,50,200],'回');
  fam('ni','夜更かし',['🌙','🦉','👑'],'start', M.night, [5,50,200],'回');
  fam('fl','フロー',['🌊','🐋'],'start', M.flow, [5,50],'回');
  fam('fv','名言コレクター',['💌','🏛️'],'special', M.favs, [10,50],'個');
  fam('pr','自分を褒める',['💛','😇'],'special', M.praise, [10,50],'回');
  fam('sk','世界樹の実',['🌱','🌳','🌟'],'special', M.skill, [1,10,30],'個');
  fam('mt','バッジ収集',['🏅','🏆','💎'],'special', M.meta, [10,50,100],'個');
  fam('cf','自信',['💪','🦁','👑'],'special', M.conf, [5,20,50],'レベル');
  fam('eq','装備収集',['🎒','🛡️','💎'],'special', M.equip, [1,10,30],'個');
  fam('gc','ジャンル開拓',['📚','🌍','🌌'],'start', M.gcount, [3,5,10],'個');
  fam('gm','一点集中',['🔬','🧠'],'special', M.gmax, HR([5,50]),'', t => `1ジャンル ${Math.round(t/60)}時間`);
  fam('bd','一日の猛者',['🔥','💥','🌋'],'special', M.bestDay, [60,180,360],'', t => `1日 ${t}分 集中`);
  fam('sp','すごろく',['🎲','🏰','👑'],'special', M.sgPos, [25,75,99],'マス', t => `すごろく ${t}マス`);
  fam('sg','ステージ',['🚩','🌠'],'special', M.sgStage, [3,5],'', t => `ステージ ${t} 到達`);
  fam('td','タイムログ記録',['⏱️','📊'],'special', M.tlDays, [10,100],'日');
  fam('rv','週次レビュー',['📊','🧙'],'special', M.reviews, [4,52],'回');
  fam('bs','連戦',['⚔️','🔥'],'special', M.bestSess, [3,8],'', t => `1日 ${t}セッション`);

  // ── 時刻パイオニア（特徴的な時間だけ厳選・名前にこだわり） ──
  const studiedHour = h => detVals().some(d => d && d.hourMins && (d.hourMins[h]||0) > 0);
  const HOURS = [
    [2,'丑三つ時の学者','🌌','epic'], [5,'夜明けの一番乗り','🌅','rare'], [7,'朝の習慣','☀️','common'],
    [9,'午前の集中','🏙️','common'], [12,'昼休みの一手','🍱','common'], [15,'おやつどきの学び','🍵','common'],
    [18,'夕暮れの探究','🌆','common'], [21,'宵の積み上げ','🌙','common'], [23,'真夜中の灯火','🕯️','rare'],
  ];
  HOURS.forEach(([h,name,ic,rr]) => BADGES.push({
    id:`hr_${h}`, name, desc:`${h}時台に学習した`, icon:ic, cat:'start', rarity:rr, check:()=>studiedHour(h) }));

  // ── 曜日マスター ──
  const dowJ = ['日','月','火','水','木','金','土'];
  const studiedDow = wd => Object.keys(hist()).some(k => hist()[k]>0 && new Date(k+'T00:00:00').getDay()===wd);
  for (let wd=0; wd<7; wd++) BADGES.push({ id:`dow_${wd}`, name:`${dowJ[wd]}曜の戦士`, desc:`${dowJ[wd]}曜日に学習した`,
    icon:'📆', cat:'streak', rarity:'common', check:()=>studiedDow(wd) });

  // ── 月コンプ（その月に学習） ──
  const studiedMonth = mo => Object.keys(hist()).some(k => hist()[k]>0 && parseInt(k.split('-')[1])===mo);
  for (let mo=1; mo<=12; mo++) BADGES.push({ id:`mon_${mo}`, name:`${mo}月の記録`, desc:`${mo}月に学習した`,
    icon:'🗓️', cat:'streak', rarity:'common', check:()=>studiedMonth(mo) });

  // ── コンボ系（複合条件・特別） ──
  const combos = [
    ['伝説の朝型','Lv10 & 朝活30 & 累計30h','🌅', () => M.level()>=10 && M.morning()>=30 && M.minutes()>=1800],
    ['不屈の夜型','Lv10 & 夜更かし30 & 累計30h','🌙', () => M.level()>=10 && M.night()>=30 && M.minutes()>=1800],
    ['鉄の意志','30日連続 & 累計50h','⚙️', () => M.streak()>=30 && M.minutes()>=3000],
    ['探究の鬼','3ジャンル & 各5h以上','🔱', () => G().filter(g=>(g.minutes||0)>=300).length>=3],
    ['百戦の英雄','100セッション & Lv20','🏆', () => M.sessions()>=100 && M.level()>=20],
    ['時の支配者','累計200時間','⌛', () => M.minutes()>=12000],
    ['自己対話の達人','褒め50 & 自信Lv10','💛', () => M.praise()>=50 && M.conf()>=10],
    ['世界樹の守人','世界樹の実20','🌳', () => M.skill()>=20],
    ['完全習慣','100日連続','💠', () => M.streak()>=100],
  ];
  combos.forEach((c,i) => BADGES.push({ id:`cb_${i}`, name:c[0], desc:c[1], icon:c[2], cat:'special',
    rarity: i>=7?'legendary':'epic', check:c[3] }));
})();

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
    // 一度に大量解放されてもトーストは最大3件まで（レア度高い順）。残りは静かに獲得
    const rOrder = { legendary:0, epic:1, rare:2, common:3 };
    const toToast = newlyEarned.slice().sort((a,b)=>rOrder[a.rarity]-rOrder[b.rarity]).slice(0,3);
    toToast.forEach(b => badgeQueue.push(b));
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
  Overlay.open('badges-overlay');
  renderBadgeGrid();
}

function renderBadgeGrid() {
  const earned = Object.keys(earnedBadges).length;
  document.getElementById('badges-earned-count').textContent = earned;
  const totalEl = document.getElementById('badges-total-count');
  if (totalEl) totalEl.textContent = BADGES.length;

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

document.getElementById('avatar-open-badges')?.addEventListener('click', openBadgesModal);
document.getElementById('badges-close-btn').addEventListener('click', () =>
  Overlay.close('badges-overlay'));
document.getElementById('badges-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('badges-overlay'))
    Overlay.close('badges-overlay');
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

// ═══════════════════════════════════════════════════════
//  手帳：カレンダーの予定・TODO（gq_planner）
//  繰り返し（なし/毎日/毎週/毎月）対応。完了は「日付ごと」に記録するので、
//  繰り返し予定でも『この日だけ完了』を正しく扱える。
// ═══════════════════════════════════════════════════════
function loadPlanner() { try { return JSON.parse(localStorage.getItem('gq_planner') || '[]'); } catch { return []; } }
let plannerTasks = loadPlanner();
function savePlanner() { localStorage.setItem('gq_planner', JSON.stringify(plannerTasks)); syncPlannerToCloud(); }

// ── クラウド通知：GASウェブアプリへ予定を預ける（LINE等へ“閉じてても”送るため）──
// no-cors の fire&forget。応答は読めないが、GAS側は受け取れる（CORS回避）。
function loadCloudUrl() { return localStorage.getItem('gq_cloud_url') || ''; }
function saveCloudUrl(u) { localStorage.setItem('gq_cloud_url', (u || '').trim()); }
function cloudPost(payload) {
  const url = loadCloudUrl(); if (!url) return;
  try {
    fetch(url, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // プリフライト回避
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (e) {}
}
function syncPlannerToCloud() {
  if (!loadCloudUrl()) return;
  cloudPost({ type: 'sync', tz: 'Asia/Tokyo', tasks: plannerTasks });
}
function testCloudNotify() {
  if (!loadCloudUrl()) { alert('先に「クラウド通知」のURLを設定してください。'); return; }
  cloudPost({ type: 'test' });
  alert('テスト送信しました。\nLINE（またはTelegram）に「テスト通知」が届けば成功です。\n届かない場合は、GAS側のトークン設定とトリガーを確認してください。');
}
if (loadCloudUrl()) syncPlannerToCloud();   // 起動時に最新を1回預ける

const PLAN_REPEAT_LABEL = { none:'', daily:'毎日', weekly:'毎週', monthly:'毎月' };

// その予定が、指定日に「出現」するか（繰り返しを展開して判定）
function planOccursOn(task, dateKey) {
  if (dateKey < task.date) return false;                 // 開始日より前は出ない
  if (task.repeat === 'daily')   return true;
  if (task.repeat === 'weekly')  return new Date(dateKey+'T00:00:00').getDay() === new Date(task.date+'T00:00:00').getDay();
  if (task.repeat === 'monthly') return parseInt(dateKey.slice(8)) === parseInt(task.date.slice(8));
  return dateKey === task.date;                          // none
}

// 指定日の予定一覧（done付き・時刻順→時刻なし）
function planTasksOn(dateKey) {
  const list = plannerTasks
    .filter(t => planOccursOn(t, dateKey))
    .map(t => ({ ...t, done: (t.doneDates || []).includes(dateKey) }));
  list.sort((a, b) => {
    if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
  return list;
}

function addPlannerTask(dateKey, text, time, repeat, remind, kind) {
  plannerTasks.push({
    id: 'pt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    text, date: dateKey, time: time || null, repeat: repeat || 'none',
    kind: kind === 'event' ? 'event' : 'task',   // task=やること(チェック式) / event=予定(イベント)
    remind: !!(remind && time), doneDates: [],   // 通知は時刻ありのみ有効
  });
  savePlanner();
}
function togglePlannerDone(taskId, dateKey) {
  const t = plannerTasks.find(x => x.id === taskId); if (!t) return;
  t.doneDates = t.doneDates || [];
  const i = t.doneDates.indexOf(dateKey);
  if (i >= 0) t.doneDates.splice(i, 1); else t.doneDates.push(dateKey);
  savePlanner();
}
function deletePlannerTask(taskId) {
  plannerTasks = plannerTasks.filter(x => x.id !== taskId);
  savePlanner();
}
function togglePlannerRemind(taskId) {
  const t = plannerTasks.find(x => x.id === taskId); if (!t || !t.time) return;
  t.remind = !t.remind;
  savePlanner();
  if (t.remind && typeof requestNotifPermission === 'function') requestNotifPermission();
}

// 日モーダル内の予定リストを描画
function renderDayPlanner(dateKey) {
  const list = planTasksOn(dateKey);
  const el = document.getElementById('cdp-planner-list'); if (!el) return;
  el.innerHTML = list.length
    ? list.map(t => {
      const isEvent = t.kind === 'event';
      const lead = isEvent
        ? `<span class="cdp-task-evmark" title="予定（イベント）">📌</span>`
        : `<button class="cdp-task-check" data-act="check" title="完了/未完了">${t.done ? '✓' : '○'}</button>`;
      return `
      <div class="cdp-task ${isEvent ? 'is-event' : ''} ${(!isEvent && t.done) ? 'done' : ''}" data-id="${t.id}">
        ${lead}
        <div class="cdp-task-main">
          ${t.time ? `<span class="cdp-task-time">${t.time}</span>` : ''}
          <span class="cdp-task-text">${escHtml(t.text)}</span>
          ${t.repeat !== 'none' ? `<span class="cdp-task-rep">🔁${PLAN_REPEAT_LABEL[t.repeat]}</span>` : ''}
        </div>
        ${t.time ? `<button class="cdp-task-bell ${t.remind ? 'on' : ''}" data-act="bell" title="${t.remind ? '通知オン' : '通知オフ'}">${t.remind ? '🔔' : '🔕'}</button>` : ''}
        <button class="cdp-task-del" data-act="del" title="削除">🗑</button>
      </div>`;
    }).join('')
    : `<div class="cdp-plan-empty">まだ予定はありません</div>`;

  el.querySelectorAll('.cdp-task').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act="check"]')?.addEventListener('click', () => {
      togglePlannerDone(id, dateKey); renderDayPlanner(dateKey); renderCalendar();
    });
    row.querySelector('[data-act="bell"]')?.addEventListener('click', () => {
      togglePlannerRemind(id); renderDayPlanner(dateKey);
    });
    row.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      const t = plannerTasks.find(x => x.id === id);
      if (t && t.repeat !== 'none' && !confirm('繰り返しの予定です。すべての回をまとめて削除しますか？')) return;
      deletePlannerTask(id); renderDayPlanner(dateKey); renderCalendar();
    });
  });
}

// 予定の追加（フォーム）
function _plannerAddFromForm() {
  const popup = document.getElementById('cal-day-popup');
  const dk = popup && popup.dataset.date; if (!dk) return;
  const textEl = document.getElementById('cdp-task-text');
  const text = (textEl.value || '').trim();
  if (!text) { textEl.focus(); return; }
  const time   = document.getElementById('cdp-task-time').value || null;
  const repeat = document.getElementById('cdp-task-repeat').value || 'none';
  const remind = !!document.getElementById('cdp-task-remind')?.checked;
  const kind   = document.querySelector('.cdp-kind-btn.active')?.dataset.kind || 'task';
  if (remind && time && typeof requestNotifPermission === 'function') requestNotifPermission();
  addPlannerTask(dk, text, time, repeat, remind, kind);
  textEl.value = '';
  document.getElementById('cdp-task-time').value = '';
  document.getElementById('cdp-task-repeat').value = 'none';
  const remindEl = document.getElementById('cdp-task-remind'); if (remindEl) remindEl.checked = false;
  renderDayPlanner(dk); renderCalendar();
  textEl.focus();
}
document.getElementById('cdp-task-add')?.addEventListener('click', _plannerAddFromForm);
document.getElementById('cdp-task-text')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); _plannerAddFromForm(); }
});
// やること / 予定(イベント) の切り替え（選んだ種別は次の追加でも維持）
document.querySelectorAll('.cdp-kind-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cdp-kind-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── リマインド通知（アプリを開いている間だけ。閉じている間はSafari制約で不可）──
// 一度鳴らした予定は (id|日付|時刻) で記録して二度鳴らさない。日付が変わるとリセット。
let _firedReminders = new Set();
let _firedDate = '';
(function initFiredReminders() {
  try {
    const obj = JSON.parse(localStorage.getItem('gq_planner_fired') || '{}');
    _firedDate = obj.date || todayKey();
    if (_firedDate === todayKey() && Array.isArray(obj.keys)) _firedReminders = new Set(obj.keys);
    else { _firedDate = todayKey(); _firedReminders = new Set(); }
  } catch { _firedDate = todayKey(); _firedReminders = new Set(); }
})();
function saveFiredReminders() {
  localStorage.setItem('gq_planner_fired', JSON.stringify({ date: _firedDate, keys: [..._firedReminders] }));
}
function showReminderToast(task) {
  const el = document.getElementById('reminder-toast'); if (!el) return;
  el.innerHTML = `<span class="rmd-time">🔔 ${task.time}</span><span class="rmd-text">${escHtml(task.text)}</span>`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 8000);
}
function fireReminder(task) {
  if (('Notification' in window) && Notification.permission === 'granted') {
    try { new Notification(`🔔 ${task.time} の予定`, { body: task.text }); } catch (e) {}
  }
  showReminderToast(task);   // アプリ内バナーは常に出す
}
function checkPlannerReminders() {
  const dk = todayKey();
  if (dk !== _firedDate) { _firedReminders = new Set(); _firedDate = dk; saveFiredReminders(); }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  planTasksOn(dk).forEach(t => {
    if (!t.remind || !t.time || t.done) return;
    const [hh, mm] = t.time.split(':').map(Number);
    const taskMin = hh * 60 + mm;
    const key = `${t.id}|${dk}|${t.time}`;
    if (_firedReminders.has(key)) return;
    // 時刻に到達（遅れ30分以内まで拾う。古すぎる予定は鳴らさない）
    if (nowMin >= taskMin && nowMin - taskMin <= 30) {
      fireReminder(t);
      _firedReminders.add(key);
      saveFiredReminders();
    }
  });
}
checkPlannerReminders();
setInterval(checkPlannerReminders, 30000);   // 30秒ごとに確認
document.getElementById('reminder-toast')?.addEventListener('click', e => {
  e.currentTarget.classList.remove('show');
});

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

    // 予定インジケータ：タスク=未完了数(オレンジ) / イベント=紫の点
    const _dayItems = planTasksOn(k);
    const _tasks    = _dayItems.filter(t => t.kind !== 'event');
    const _events   = _dayItems.filter(t => t.kind === 'event');
    const _pending  = _tasks.filter(t => !t.done).length;
    const todoHTML  = _tasks.length
      ? `<div class="cal-todo ${_pending === 0 ? 'all-done' : ''}">${_pending > 0 ? _pending : '✓'}</div>`
      : '';
    const eventHTML = _events.length ? `<div class="cal-event" title="予定 ${_events.length}件"></div>` : '';

    // 過去も未来もタップ可能（未来は予定を立てる用）
    return `<div class="${cls}" data-date="${k}">
              <span class="cal-day-num">${date.getDate()}</span>
              ${stampHTML}
              ${todoHTML}
              ${eventHTML}
            </div>`;
  }).join('');

  // クリックイベント
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => showDayPopup(cell.dataset.date, cell));
  });

  // 🌈 完璧な週（日〜土すべて学習）を祝う演出
  decoratePerfectWeeks(grid, cells, todayStart);

  renderCalStats(y, m);
}

// 日曜〜土曜の7日すべてに学習がある「完璧な週」を探し、
// その行をカラフルに彩り、妖精／オトモンが飛び・走り回る演出を載せる。
function decoratePerfectWeeks(grid, cells, todayStart) {
  grid.querySelector('.cal-pw-layer')?.remove();   // 再描画時の二重生成を防ぐ
  const cellEls = grid.querySelectorAll('.cal-cell');
  const rows = cells.length / 7;
  const perfectRows = [];

  for (let r = 0; r < rows; r++) {
    let perfect = true;
    for (let c = 0; c < 7; c++) {
      const date = cells[r * 7 + c];
      // 未来日が含まれる、または学習記録の無い日があれば「完璧」ではない
      if (date > todayStart || !(data.history[dkey(date)] > 0)) { perfect = false; break; }
    }
    if (perfect) {
      perfectRows.push(r);
      for (let c = 0; c < 7; c++) cellEls[r * 7 + c]?.classList.add('pw-cell');
    }
  }
  if (!perfectRows.length) return;

  // 走り回る相棒：オトモンが孵化していればそのオトモン、いなければ導きの妖精
  let sprite = '🧚', mode = 'fly';
  try {
    const disc = window.Otomon ? window.Otomon.getDiscovered() : [];
    if (disc && disc.length) {
      const o = (window.Otomon.getActiveOtomon && window.Otomon.getActiveOtomon()) || disc[0];
      sprite = o.emoji || '🐾';
      mode = 'run';
    }
  } catch (e) {}

  const gridRect = grid.getBoundingClientRect();
  if (!gridRect.height) return;   // レイアウト未確定時はスキップ（次回描画で付く）

  const layer = document.createElement('div');
  layer.className = 'cal-pw-layer';
  perfectRows.forEach((r, i) => {
    const first = cellEls[r * 7];
    if (!first) return;
    const rr = first.getBoundingClientRect();
    const top = rr.top - gridRect.top, h = rr.height;
    const runner = document.createElement('div');
    runner.className = 'cal-pw-runner cal-runner-' + mode;
    runner.style.top = top + 'px';
    runner.style.height = h + 'px';
    runner.style.animationDelay = (i * 1.3) + 's';
    runner.innerHTML = `<span class="cal-runner-sprite">${sprite}</span>`;
    layer.appendChild(runner);
  });
  grid.appendChild(layer);
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
    <div class="cal-stat-item">この月の学習日数: <strong>${studyDays}日</strong></div>
    <div class="cal-stat-item">この月の学習時間: <strong>${totalMins}分</strong></div>
    ${bestDate ? `<div class="cal-stat-item">ベスト: <strong>${bestDate}（${bestMins}分）</strong></div>` : ''}
  `;
}

function showDayPopup(dateKey, cellEl) {
  const popup = document.getElementById('cal-day-popup');
  popup.dataset.date = dateKey;   // 「⏱ この日のタイムログ」ボタン用
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

  // タイムログボタンは学習記録がある日だけ表示
  const tlBtn = document.getElementById('cdp-timelog-btn');
  if (tlBtn) tlBtn.style.display = mins > 0 ? '' : 'none';

  // 予定・TODO を描画
  renderDayPlanner(dateKey);

  // 中央モーダルとして表示（位置計算は不要）
  document.getElementById('cal-day-backdrop')?.classList.remove('hidden');
  popup.classList.remove('hidden');
  popup.scrollTop = 0;
}

function closeDayModal() {
  document.getElementById('cal-day-popup').classList.add('hidden');
  document.getElementById('cal-day-backdrop')?.classList.add('hidden');
}
document.getElementById('cdp-close-btn').addEventListener('click', closeDayModal);
document.getElementById('cal-day-backdrop')?.addEventListener('click', closeDayModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('cal-day-popup').classList.contains('hidden')) closeDayModal();
});
// この日のタイムログへ
document.getElementById('cdp-timelog-btn')?.addEventListener('click', () => {
  const dk = document.getElementById('cal-day-popup').dataset.date;
  closeDayModal();
  if (dk && typeof openTimelogModal === 'function') openTimelogModal(dk);
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
let rvPeriod         = 'week';    // 'day' | 'week' | 'month' | 'custom'
let rvAnchor         = new Date();// 日次/月次の基準日
let rvCustom         = { start:null, end:null }; // 期間指定（YYYY-MM-DD）

// ── 分析 ─────────────────────────────────────────────────
function analyzeWeek(weekKey) {
  return analyzeDays(getWeekDates(weekKey));
}

// 任意の日付配列を集計（日次/週次/月次/期間 で共通利用）
function analyzeDays(dates) {
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

// ── 🔍 AI分析プロンプトの書き出し（己を知る → 各自のAIへ渡す）──
// GQは分析しない。「傾向と対策」を引き出す“問い”に整形して、ユーザーのAIに委ねる。
function buildAIAnalysisPrompt() {
  const an = analyzeWeek(rvWeekKey);
  const range = getReviewRange().label;
  const L = [];
  L.push('【Growth Quest 自己分析リクエスト】');
  L.push('あなたは私のパーソナル自己管理コーチです。下記は私の学習データです。');
  L.push('「ジョハリの窓」の“盲点”（私自身が気づいていない傾向）を中心に、');
  L.push('① 傾向（己を知る）と ② 明日からできる具体的な対策（己をコントロールする）を、率直に教えてください。');
  L.push('');
  L.push('■ 期間：' + range);
  try {
    const lt = diagnoseLearningType();
    if (lt && lt.ready) {
      L.push('■ 学習タイプ診断：' + (lt.type?.name || lt.code));
      if (lt.axes) L.push('　軸：' + lt.axes.map(a => `${a.left}⇔${a.right}`).join(' / '));
    }
  } catch (e) {}
  L.push('■ 曜日別の学習：' + an.days.map((d, i) => `${DOW_LABELS[i]}${d.mins}分`).join(' '));
  const s = an.slots;
  L.push(`■ 時間帯（分）：朝${s.morning} 昼${s.afternoon} 夕${s.evening} 夜${s.night}`);
  L.push(`■ 連続記録：現在 ${data.streak || 0} 日`);
  const ge = Object.entries(an.genreMins).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([gid, m]) => { const g = (genres || []).find(x => x.id === gid); return `${g ? g.name : gid}${m}分`; });
  if (ge.length) L.push('■ よく学ぶ分野：' + ge.join(' '));
  try {
    const fr = (typeof collectFruitEntries === 'function') ? collectFruitEntries() : [];
    if (fr.length) L.push('■ 最近の振り返り：' + fr.slice(-5).map(f => `「${f.text}」`).join(' '));
  } catch (e) {}
  L.push('');
  L.push('特に「自分では頑張れたと思っている日」と「データ上の本当の主戦場」のズレのような');
  L.push('“盲点”を暴いてください。最後に、明日からできる小さな対策を3つ提案してください。');
  return L.join('\n');
}

async function copyAIAnalysisPrompt() {
  const text = buildAIAnalysisPrompt();
  const btn = document.getElementById('ai-analyze-btn');
  const flash = (msg) => { if (btn) { const o = btn.dataset.label; btn.textContent = msg; setTimeout(() => btn.textContent = o, 2200); } };
  if (btn && !btn.dataset.label) btn.dataset.label = btn.textContent;
  try {
    if (navigator.share) { await navigator.share({ text }); flash('✓ 共有しました'); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(text);
    flash('✓ コピー！AIに貼ってね');
  } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); flash('✓ コピーしました！'); } catch (_) {}
    ta.remove();
  }
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

// ═══════════════════════════════════════════════════════
//  学習タイプ診断（4軸 → 16タイプ）
//  軸: 時間(A朝/N夜)・集中(S短/L長)・幅(F特化/V多才)・安定(K継続/M気分)
// ═══════════════════════════════════════════════════════
const LEARNING_TYPE_MIN_SESSIONS = 5;
const LEARNING_TYPES = {
  ASFK:{emoji:'🌅',name:'暁の研ぎ師',     desc:'毎朝コツコツ、一点を磨き続ける職人タイプ。'},
  ASFM:{emoji:'🌄',name:'朝風の一閃',     desc:'気分が乗った朝に、短く鋭く斬り込む人。'},
  ASVK:{emoji:'🌅',name:'暁の万能人',     desc:'朝の短時間で、幅広く着実にこなす器用な人。'},
  ASVM:{emoji:'🏃',name:'朝駆けの遊撃手', desc:'朝の気まぐれに、あちこち軽やかに動く自由人。'},
  ALFK:{emoji:'🌅',name:'黎明の求道者',   desc:'朝からじっくり一道を究める、静かな探求者。'},
  ALFM:{emoji:'☀️',name:'朝陽の没頭者',   desc:'乗った朝は一点に長く没入する集中型。'},
  ALVK:{emoji:'🌅',name:'暁の探究者',     desc:'朝にじっくり、いろんな世界を旅する学び人。'},
  ALVM:{emoji:'🧭',name:'朝の冒険家',     desc:'朝の気分でテーマを変え、長く遊ぶ探検家。'},
  NSFK:{emoji:'🎯',name:'夜陰の狙撃手',   desc:'夜にコツコツ、一点を狙い撃つ静かな手練れ。'},
  NSFM:{emoji:'🗡️',name:'宵闇の一刺し',   desc:'夜の気分で、短くひと突き決める切れ者。'},
  NSVK:{emoji:'🌟',name:'星詠みの学究',   desc:'夜の短時間で、多彩に積み上げる勤勉な人。'},
  NSVM:{emoji:'🌙',name:'夜風の自由人',   desc:'夜の気まぐれに、軽やかに分野を渡り歩く人。'},
  NLFK:{emoji:'🌚',name:'深夜の賢者',     desc:'夜更けにじっくり、一道を深める静かな賢者。'},
  NLFM:{emoji:'🦉',name:'闇に潜る者',     desc:'乗った夜は一点に長く沈み込む没入型。'},
  NLVK:{emoji:'🌕',name:'月下の博識者',   desc:'夜にじっくり、幅広く究める博覧強記タイプ。'},
  NLVM:{emoji:'🌌',name:'真夜中の探検家', desc:'夜の気分のままに、長く広く旅する冒険者。'},
};

function _ltDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 全期間データから学習タイプを判定する
function diagnoseLearningType() {
  const sessions = data.sessions || 0;
  if (sessions < LEARNING_TYPE_MIN_SESSIONS) {
    return { ready:false, need: LEARNING_TYPE_MIN_SESSIONS - sessions };
  }

  // 軸1: 時間（朝 vs 夜）
  const morning = data.morningSessions || 0;
  const night   = data.nightSessions   || 0;
  const tTot = morning + night;
  const timeScore = tTot ? (morning - night) / tTot : 0; // -1夜..+1朝
  const time = (night > morning) ? 'N' : 'A';
  const timePos = Math.round(50 + timeScore * 50);

  // 軸2: 集中（短 vs 長）平均セッション分
  const avg = sessions ? (data.totalMinutes || 0) / sessions : 0;
  const lenScore = Math.max(-1, Math.min(1, (avg - 35) / 35)); // 35分が境
  const length = (avg >= 35) ? 'L' : 'S';
  const lenPos = Math.round(50 + lenScore * 50);

  // 軸3: 幅（特化 vs 多才）
  const gmins = (typeof genres !== 'undefined' ? genres : [])
    .map(g => g.minutes || 0).filter(m => m > 0).sort((a,b)=>b-a);
  const gtot = gmins.reduce((a,b)=>a+b,0);
  const topShare = gtot ? gmins[0]/gtot : 1;
  const activeGenres = gmins.length;
  const breadth = (activeGenres >= 3 && topShare < 0.6) ? 'V' : 'F';
  const breadthPos = Math.round((1 - topShare) * 100); // 0=特化, 100=多才

  // 軸4: 安定（コツコツ vs 気分屋）直近14日の活動率
  const today = new Date(); today.setHours(0,0,0,0);
  let active = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if ((data.history[_ltDateKey(d)] || 0) > 0) active++;
  }
  const ratio = active / 14;
  const consistency = (ratio >= 0.5) ? 'K' : 'M';
  const consPos = Math.round(ratio * 100);

  const code = time + length + breadth + consistency;
  return {
    ready: true,
    code,
    type: LEARNING_TYPES[code] || LEARNING_TYPES.ALVK,
    axes: [
      { left:'夜型',   right:'朝型',   pos: timePos    },
      { left:'短距離', right:'長距離', pos: lenPos     },
      { left:'特化',   right:'多才',   pos: breadthPos },
      { left:'気分屋', right:'コツコツ', pos: consPos    },
    ],
  };
}

// 学習タイプセクションのHTMLを返す
function renderLearningTypeSection() {
  const dg = diagnoseLearningType();
  if (!dg.ready) {
    return `<div class="review-section">
      <div class="review-section-title">あなたの学習タイプ</div>
      <div class="lt-card lt-locked">
        <div class="lt-emoji">🔒</div>
        <div class="lt-name">診断はまもなく解放</div>
        <div class="lt-desc">あと <strong>${dg.need}</strong> セッションで、あなたの学習キャラが分かります！</div>
      </div>
    </div>`;
  }
  const t = dg.type;
  const axesHtml = dg.axes.map(a => {
    const leftOn  = a.pos < 50  ? ' on' : '';
    const rightOn = a.pos >= 50 ? ' on' : '';
    return `<div class="lt-axis-row">
      <span class="lt-axis-end${leftOn}">${a.left}</span>
      <span class="lt-axis-track"><span class="lt-axis-dot" style="left:${a.pos}%"></span></span>
      <span class="lt-axis-end${rightOn}">${a.right}</span>
    </div>`;
  }).join('');
  return `<div class="review-section">
    <div class="review-section-title">あなたの学習タイプ</div>
    <div class="lt-card lt-time-${dg.code[0]}">
      <div class="lt-emoji">${t.emoji}</div>
      <div class="lt-name">${t.name}</div>
      <div class="lt-desc">${t.desc}</div>
      <div class="lt-axes">${axesHtml}</div>
      <button class="lt-share-btn" id="lt-share-btn" data-code="${dg.code}">✨ この結果をシェア</button>
    </div>
  </div>`;
}

// シェア用テキストを組み立てる
function buildLearningTypeShareText(code) {
  const t = LEARNING_TYPES[code]; if (!t) return '';
  const dg = diagnoseLearningType();
  const axisText = dg.ready
    ? dg.axes.map(a => a.pos >= 50 ? a.right : a.left).join(' × ')
    : '';
  return `【Growth Quest】私の学習タイプは『${t.name}』${t.emoji}\n`
    + `${axisText}\n`
    + `あなたも自分の学習タイプを診断しよう ⚔\n#GrowthQuest`;
}

// canvas用の小ヘルパ
function _roundRect(x, rx, ry, w, h, r) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry,     rx + w, ry + h, r);
  x.arcTo(rx + w, ry + h, rx,     ry + h, r);
  x.arcTo(rx,     ry + h, rx,     ry,     r);
  x.arcTo(rx,     ry,     rx + w, ry,     r);
  x.closePath();
}
function _wrapText(x, text, cx, y, maxW, lh) {
  const chars = [...text]; let line = '', yy = y;
  for (const ch of chars) {
    if (x.measureText(line + ch).width > maxW && line) {
      x.fillText(line, cx, yy); line = ch; yy += lh;
    } else { line += ch; }
  }
  if (line) x.fillText(line, cx, yy);
}
function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// 診断結果を“SNS映えするカード画像”として描画し、PNG Blob を返す
function buildLearningTypeImageBlob(code) {
  return new Promise(resolve => {
    const dg = diagnoseLearningType();
    const t  = LEARNING_TYPES[code] || dg.type;
    if (!t) { resolve(null); return; }
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const isNight = code[0] === 'N';

    // 背景グラデーション（時間帯テーマ）
    const g = x.createLinearGradient(0, 0, W, H);
    if (isNight) { g.addColorStop(0, '#1b1c3e'); g.addColorStop(1, '#0a0a16'); }
    else         { g.addColorStop(0, '#2c2415'); g.addColorStop(1, '#100f0a'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // 枠
    x.strokeStyle = isNight ? 'rgba(129,140,248,.55)' : 'rgba(245,158,11,.55)';
    x.lineWidth = 5; _roundRect(x, 36, 36, W - 72, H - 72, 28); x.stroke();

    x.textAlign = 'center';
    // ヘッダー
    x.fillStyle = '#67e8f9'; x.font = '600 42px sans-serif';
    x.fillText('⚔ GROWTH QUEST', W / 2, 150);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '500 34px sans-serif';
    x.fillText('学習タイプ診断', W / 2, 205);

    // 絵文字
    x.font = '210px sans-serif';
    x.fillText(t.emoji, W / 2, 470);

    // タイプ名
    x.fillStyle = '#ffffff'; x.font = '900 88px sans-serif';
    x.fillText(t.name, W / 2, 600);

    // 説明（折り返し）
    x.fillStyle = 'rgba(255,255,255,.82)'; x.font = '400 36px sans-serif';
    _wrapText(x, t.desc, W / 2, 672, W - 240, 50);

    // 4軸スライダー
    const axes = dg.ready ? dg.axes : [];
    let ay = 850;
    axes.forEach(a => {
      x.font = '600 32px sans-serif';
      x.textAlign = 'left';
      x.fillStyle = a.pos < 50 ? '#a5b4fc' : 'rgba(255,255,255,.42)';
      x.fillText(a.left, 130, ay + 11);
      x.textAlign = 'right';
      x.fillStyle = a.pos >= 50 ? '#a5b4fc' : 'rgba(255,255,255,.42)';
      x.fillText(a.right, W - 130, ay + 11);
      const tx0 = 330, tx1 = W - 330, tw = tx1 - tx0;
      x.fillStyle = 'rgba(255,255,255,.15)'; _roundRect(x, tx0, ay - 6, tw, 12, 6); x.fill();
      const dx = tx0 + tw * (Math.max(0, Math.min(100, a.pos)) / 100);
      x.fillStyle = '#c4b5fd';
      x.beginPath(); x.arc(dx, ay, 15, 0, Math.PI * 2); x.fill();
      ay += 92;
    });

    // フッター
    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '500 38px sans-serif';
    x.fillText('#GrowthQuest', W / 2, H - 105);

    c.toBlob(b => resolve(b), 'image/png');
  });
}

// 学習タイプを共有する（画像 → テキスト → コピー の順でベストを尽くす）
// 戻り値: 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'failed'
async function shareLearningType(code) {
  if (!LEARNING_TYPES[code]) return 'failed';
  const text = buildLearningTypeShareText(code);

  // ① 画像として共有（共有メニューにファイルを渡す）
  try {
    const blob = await buildLearningTypeImageBlob(code);
    if (blob) {
      const file = new File([blob], 'growth-quest-type.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: 'Growth Quest 学習タイプ' });
          return 'shared';
        } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
      }
      // 共有メニューに画像を渡せない端末 → 画像を保存（＋テキストもコピー）
      _downloadBlob(blob, 'growth-quest-type.png');
      try { await navigator.clipboard?.writeText(text); } catch {}
      return 'downloaded';
    }
  } catch (e) { /* 画像生成失敗 → テキスト共有へ */ }

  // ② テキストだけ共有メニュー
  if (navigator.share) {
    try { await navigator.share({ title: 'Growth Quest 学習タイプ', text }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  // ③ コピー
  try { await navigator.clipboard?.writeText(text); return 'copied'; }
  catch { return 'failed'; }
}

// ═══════════════════════════════════════════════════════
//  ジョハリの窓（ソロ版）= 「自己申告」×「行動データ」
//   開放: 自分もデータも知ってる / 盲点: データだけが知ってる(★)
//   秘密: あなただけが知ってる(宣言) / 未知: まだ誰も知らない伸びしろ
// ═══════════════════════════════════════════════════════
function buildJohariWindows(an, prev, saved) {
  const w = {};
  const genreMins = an.genreMins || {};
  const ge = Object.entries(genreMins)
    .map(([gid,m]) => ({ gid, m, genre:(genres||[]).find(g=>g.id===gid) }))
    .filter(e => e.genre).sort((a,b) => b.m - a.m);
  const top = ge[0];

  // 🪟 開放：明らかな強み
  if (top) w.open = `得意は <b>${top.genre.emoji||''} ${top.genre.name}</b>。今週もしっかり時間を注げています。`;
  else if ((data.streak||0) >= 3) w.open = `🔥 <b>${data.streak}日連続</b>。継続できるのは確かな強みです。`;
  else w.open = `「やってみた」記録が積み上がっています。これも立派な強みの芽。`;

  // 💡 盲点：データが知っている意外な事実（候補から1つ）
  const blind = [];
  if (an.bestDay && an.bestDay.mins > 0)
    blind.push(`実は <b>${DOW_FULL[dowIndex(an.bestDay.date)]}</b> が今週のベスト集中日（${an.bestDay.mins}分）。`);
  if (an.hasHour) {
    const sl = { morning:'朝', afternoon:'昼', evening:'夕', night:'夜' };
    const best = Object.entries(an.slots || {}).reduce((b,[k,v]) => v>b.v?{k,v}:b, {k:'',v:0});
    if (best.k) blind.push(`自覚以上に <b>${sl[best.k]}型</b> かも（${sl[best.k]}に${best.v}分）。`);
  }
  const mn = data.morningSessions||0, nt = data.nightSessions||0;
  if (mn + nt >= 3 && Math.abs(mn - nt) >= 2)
    blind.push(`通算では <b>${nt>mn?'夜':'朝'}</b> に動く回数が多い、隠れ${nt>mn?'夜':'朝'}型です。`);
  if (top && prev) { const pm = prev[top.gid]||0; if (top.m - pm >= 10)
    blind.push(`<b>${top.genre.name}</b>が先週より伸びています（+${top.m - pm}分）。`); }
  w.blind = blind.length ? blind[0]
    : `記録が増えると、自分でも気づかなかった傾向が見えてきます。`;

  // 🤫 秘密：宣言/目標 vs 行動
  const goalMins  = saved?.goal?.targetMins || 0;
  const nextFocus = saved?.reflection?.nextFocus || '';
  if (goalMins > 0 && an.totalMins < goalMins)
    w.hidden = `目標 <b>${goalMins}分</b> に対して今週は ${an.totalMins}分。宣言した目標、まだ道の途中。`;
  else if (nextFocus)
    w.hidden = `あなたの宣言:「${escHtml(nextFocus)}」。言葉にした想いを、行動へ。`;
  else
    w.hidden = `心の中の「本当はこうしたい」を、来週ひとつ言葉にしてみよう。`;

  // 🌱 未知：まだ試していない領域
  const untried = (genres||[]).filter(g => !(g.minutes > 0));
  if (untried.length)
    w.unknown = `<b>${untried[0].emoji||''} ${untried[0].name}</b> はまだ未開拓。試すと新しい自分に出会えるかも。`;
  else
    w.unknown = `いろんな扉を開けています。次は“深さ”を追ってみるのも一手。`;

  return w;
}

function renderJohariSection(an, prev, saved) {
  if ((an.sessions||0) < 1 && (data.sessions||0) < 3) {
    return `<div class="review-section">
      <div class="review-section-title">ジョハリの窓 — 4つの自分</div>
      <div class="johari-locked">記録が増えると、4つの窓から“自分の傾向”が見えてきます。</div>
    </div>`;
  }
  const w = buildJohariWindows(an, prev, saved);
  const cell = (cls, icon, title, sub, body) => `<div class="johari-cell ${cls}">
    <div class="johari-cell-head">${icon} ${title}</div>
    <div class="johari-cell-sub">${sub}</div>
    <div class="johari-cell-body">${body}</div>
  </div>`;
  return `<div class="review-section">
    <div class="review-section-title">ジョハリの窓 — 4つの自分</div>
    <div class="johari-grid">
      ${cell('jh-open',   '🪟', '開放の窓', '自分もデータも知ってる',   w.open)}
      ${cell('jh-blind',  '💡', '盲点の窓', 'データだけが知ってる',     w.blind)}
      ${cell('jh-hidden', '🤫', '秘密の窓', 'あなただけが知ってる',     w.hidden)}
      ${cell('jh-unknown','🌱', '未知の窓', 'まだ誰も知らない伸びしろ', w.unknown)}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
//  グラフ（SVG）— 週次トレンド線 / 週リズム・レーダー / ジャンル円
// ═══════════════════════════════════════════════════════
function _weekMinutesFromMonday(monday) {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    sum += data.history[_ltDateKey(d)] || 0;
  }
  return sum;
}

// 1週間（月曜起点）のジャンル別合計分
function _weekGenreMins(monday) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const det = data.historyDetails?.[_ltDateKey(d)];
    if (det && det.genres) Object.entries(det.genres).forEach(([g, mm]) => { out[g] = (out[g] || 0) + mm; });
  }
  return out;
}

// 週次トレンド線（直近6週）— ジャンル別の折れ線＋合計（点線）＋凡例
function buildTrendLineSVG(wk) {
  const [y, m, d] = wk.split('-').map(Number);
  const curMon = new Date(y, m - 1, d);
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const mon = new Date(curMon); mon.setDate(curMon.getDate() - 7 * i);
    weeks.push({ label: `${mon.getMonth()+1}/${mon.getDate()}`, total: _weekMinutesFromMonday(mon), g: _weekGenreMins(mon) });
  }
  // 表示ジャンル：6週合計が多い順 上位5
  const gtot = {};
  weeks.forEach(w => Object.entries(w.g).forEach(([gid, mm]) => gtot[gid] = (gtot[gid] || 0) + mm));
  const topGids = Object.entries(gtot).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  const max = Math.max(...weeks.map(w => w.total), 1);
  const W = 300, H = 116, padX = 24, padY = 16;
  const xOf = i => padX + (W - padX * 2) / (weeks.length - 1) * i;
  const yOf = v => H - padY - (v / max) * (H - padY * 2);

  // 合計（点線＋淡いエリア）
  const tpts = weeks.map((w, i) => `${xOf(i).toFixed(1)},${yOf(w.total).toFixed(1)}`);
  let svg = `<polygon points="${padX},${H-padY} ${tpts.join(' ')} ${W-padX},${H-padY}" fill="rgba(255,255,255,.04)"/>`;
  svg += `<polyline points="${tpts.join(' ')}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.4" stroke-dasharray="3 3"/>`;

  // ジャンル別ライン
  topGids.forEach(gid => {
    const genre = (genres || []).find(x => x.id === gid);
    const col = (genre && genre.color) || '#06b6d4';
    const pts = weeks.map((w, i) => `${xOf(i).toFixed(1)},${yOf(w.g[gid] || 0).toFixed(1)}`);
    svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const lw = weeks[weeks.length - 1];
    svg += `<circle cx="${xOf(weeks.length-1).toFixed(1)}" cy="${yOf(lw.g[gid]||0).toFixed(1)}" r="3" fill="${col}"/>`;
  });

  const labels = weeks.map((w, i) => `<text x="${xOf(i).toFixed(1)}" y="${H-3}" fill="rgba(255,255,255,.45)" font-size="8" text-anchor="middle">${w.label}</text>`).join('');
  const last = weeks[weeks.length - 1];
  const valLast = `<text x="${xOf(weeks.length-1).toFixed(1)}" y="${(yOf(last.total)-7).toFixed(1)}" fill="rgba(255,255,255,.75)" font-size="9" text-anchor="end" font-weight="700">計${last.total}分</text>`;

  const legend = topGids.map(gid => {
    const genre = (genres || []).find(x => x.id === gid);
    return `<span class="rv-trend-leg"><span class="rv-leg-dot" style="background:${(genre&&genre.color)||'#06b6d4'}"></span>${genre ? (genre.emoji + ' ' + genre.name) : gid}</span>`;
  }).join('') + `<span class="rv-trend-leg"><span class="rv-leg-dot" style="background:rgba(255,255,255,.4)"></span>合計（点線）</span>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="rv-chart-svg">${svg}${labels}${valLast}</svg>`
    + `<div class="rv-trend-legend">${legend}</div>`;
}

// 週リズム・レーダー（曜日別の今週の分）
function buildWeekdayRadarSVG(an) {
  const days = an.days || [];
  const vals = days.map(d => d.mins || 0);
  const max = Math.max(...vals, 1);
  const N = 7, cx = 90, cy = 90, R = 64;
  const ang = i => (-90 + i * (360 / N)) * Math.PI / 180;
  const ptAt = (i, r) => `${(cx + r*Math.cos(ang(i))).toFixed(1)},${(cy + r*Math.sin(ang(i))).toFixed(1)}`;
  const grid = [0.33, 0.66, 1].map(f =>
    `<polygon points="${[...Array(N)].map((_,i)=>ptAt(i, R*f)).join(' ')}" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1"/>`).join('');
  const spokes = [...Array(N)].map((_,i)=>`<line x1="${cx}" y1="${cy}" x2="${ptAt(i,R).split(',')[0]}" y2="${ptAt(i,R).split(',')[1]}" stroke="rgba(255,255,255,.08)"/>`).join('');
  const dataPoly = [...Array(N)].map((_,i)=>ptAt(i, R*(vals[i]/max))).join(' ');
  const labels = [...Array(N)].map((_,i)=>{
    const [lx,ly] = ptAt(i, R+12).split(',');
    return `<text x="${lx}" y="${ly}" fill="rgba(255,255,255,.5)" font-size="9" text-anchor="middle" dominant-baseline="middle">${DOW_LABELS[i]}</text>`;
  }).join('');
  return `<svg viewBox="0 0 180 180" class="rv-chart-svg">
    ${grid}${spokes}
    <polygon points="${dataPoly}" fill="rgba(129,140,248,.28)" stroke="#818cf8" stroke-width="2"/>
    ${labels}
  </svg>`;
}

// ジャンル・ドーナツ
function buildGenreDonutSVG(genreMins) {
  const ge = Object.entries(genreMins || {})
    .map(([gid,m]) => ({ m, genre:(genres||[]).find(g=>g.id===gid) }))
    .filter(e => e.genre && e.m > 0).sort((a,b)=>b.m-a.m);
  const total = ge.reduce((s,e)=>s+e.m,0);
  if (!total) return '';
  const r = 52, C = 2 * Math.PI * r;
  let offset = 0;
  const segs = ge.map(e => {
    const frac = e.m / total;
    const dash = frac * C;
    const seg = `<circle cx="70" cy="70" r="${r}" fill="none"
      stroke="${e.genre.color || '#06b6d4'}" stroke-width="20"
      stroke-dasharray="${dash.toFixed(2)} ${(C-dash).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
    offset += dash;
    return seg;
  }).join('');
  const legend = ge.slice(0,4).map(e =>
    `<div class="rv-donut-leg"><span class="rv-leg-dot" style="background:${e.genre.color||'#06b6d4'}"></span>${e.genre.emoji||''} ${e.genre.name} ${Math.round(e.m/total*100)}%</div>`).join('');
  return `<div class="rv-donut-wrap">
    <svg viewBox="0 0 140 140" class="rv-donut-svg">${segs}
      <text x="70" y="66" text-anchor="middle" fill="#fff" font-size="15" font-weight="700">${ge.length}</text>
      <text x="70" y="84" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="9">ジャンル</text>
    </svg>
    <div class="rv-donut-legend">${legend}</div>
  </div>`;
}

function renderChartsSection(an, prev, saved, wk) {
  const hasAny = (an.totalMins || 0) > 0 || Object.keys(data.history||{}).length > 0;
  if (!hasAny) {
    return `<div class="review-section">
      <div class="review-section-title">📈 グラフで見る</div>
      <div class="johari-locked">学習を記録すると、推移・リズム・配分のグラフが表示されます。</div>
    </div>`;
  }
  const donut = buildGenreDonutSVG(an.genreMins);
  return `<div class="review-section">
    <div class="review-section-title">📈 グラフで見る</div>
    <div class="rv-chart-block">
      <div class="rv-chart-cap">週ごとの学習時間（直近6週）</div>
      ${buildTrendLineSVG(wk)}
    </div>
    <div class="rv-chart-2col">
      <div class="rv-chart-block">
        <div class="rv-chart-cap">今週のリズム（曜日）</div>
        ${buildWeekdayRadarSVG(an)}
      </div>
      <div class="rv-chart-block">
        <div class="rv-chart-cap">ジャンル配分</div>
        ${donut || '<div class="johari-locked" style="font-size:.7rem">今週のジャンル記録なし</div>'}
      </div>
    </div>
  </div>`;
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
  rvPeriod    = 'day';         // 開いた時は日タブから
  rvAnchor    = new Date();

  const dates = getWeekDates(wk);
  document.getElementById('review-week-label').textContent =
    `${dates[0].getMonth()+1}/${dates[0].getDate()}（月）〜 ${dates[6].getMonth()+1}/${dates[6].getDate()}（日）`;

  renderReviewFooter(false);
  renderReviewBody();
  Overlay.open('review-overlay');
  setReviewDot(false);
}

function renderReviewFooter(isPast) {
  const footer = document.getElementById('review-footer');
  // 週以外のモードは保存対象外 → 閉じるボタンのみ
  if (rvPeriod !== 'week') {
    footer.innerHTML = `<button class="review-btn-secondary" id="review-close2-btn">閉じる</button>`;
    document.getElementById('review-close2-btn').addEventListener('click',
      () => Overlay.close('review-overlay'));
    return;
  }
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

// ── 期間切り替え ─────────────────────────────────────────
function _startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

function getReviewRange() {
  if (rvPeriod === 'week') {
    const dates = getWeekDates(rvWeekKey);
    return { dates, label:`${dates[0].getMonth()+1}/${dates[0].getDate()}（月）〜 ${dates[6].getMonth()+1}/${dates[6].getDate()}（日）` };
  }
  if (rvPeriod === 'day') {
    const d = _startOfDay(rvAnchor);
    return { dates:[d], label:`${d.getMonth()+1}月${d.getDate()}日（${DOW_LABELS[dowIndex(d)]}）` };
  }
  if (rvPeriod === 'month') {
    const y = rvAnchor.getFullYear(), m = rvAnchor.getMonth();
    const n = new Date(y, m+1, 0).getDate();
    const dates = Array.from({length:n}, (_,i) => new Date(y, m, i+1));
    return { dates, label:`${y}年${m+1}月` };
  }
  // custom
  let s = rvCustom.start ? new Date(rvCustom.start+'T00:00:00') : _startOfDay(rvAnchor);
  let e = rvCustom.end   ? new Date(rvCustom.end  +'T00:00:00') : _startOfDay(rvAnchor);
  if (e < s) { const t = s; s = e; e = t; }
  const dates = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) dates.push(new Date(d));
  return { dates, label:`${s.getMonth()+1}/${s.getDate()} 〜 ${e.getMonth()+1}/${e.getDate()}（${dates.length}日間）` };
}

function shiftReviewPeriod(dir) {
  if (rvPeriod === 'week')  { const mon = new Date(rvWeekKey+'T00:00:00'); mon.setDate(mon.getDate()+7*dir); rvWeekKey = dkey(mon); }
  else if (rvPeriod === 'day')   { rvAnchor = new Date(rvAnchor); rvAnchor.setDate(rvAnchor.getDate()+dir); }
  else if (rvPeriod === 'month') { rvAnchor = new Date(rvAnchor); rvAnchor.setMonth(rvAnchor.getMonth()+dir); }
}

function renderPeriodBar() {
  const tabs = [['day','日'],['week','週'],['month','月'],['custom','期間']];
  const tabHtml = tabs.map(([k,l]) => `<button class="rv-period-tab${rvPeriod===k?' active':''}" data-period="${k}">${l}</button>`).join('');
  let nav;
  if (rvPeriod === 'custom') {
    nav = `<div class="rv-period-custom">
      <input type="date" id="rv-cust-start" value="${rvCustom.start||''}">
      <span>〜</span>
      <input type="date" id="rv-cust-end" value="${rvCustom.end||''}">
    </div>`;
  } else {
    nav = `<div class="rv-period-nav">
      <button class="rv-nav-arrow" id="rv-prev">◀</button>
      <span class="rv-period-label">${getReviewRange().label}</span>
      <button class="rv-nav-arrow" id="rv-next">▶</button>
    </div>`;
  }
  return `<div class="rv-period-bar"><div class="rv-period-tabs">${tabHtml}</div>${nav}</div>`;
}

function bindPeriodBar() {
  document.querySelectorAll('.rv-period-tab').forEach(b => b.addEventListener('click', () => {
    rvPeriod = b.dataset.period;
    if (rvPeriod === 'week') rvWeekKey = getWeekKey(new Date());
    if (rvPeriod !== 'custom') rvAnchor = new Date();
    renderReviewBody();
    renderReviewFooter(false);
  }));
  const prev = document.getElementById('rv-prev'); if (prev) prev.addEventListener('click', () => { shiftReviewPeriod(-1); renderReviewBody(); });
  const next = document.getElementById('rv-next'); if (next) next.addEventListener('click', () => { shiftReviewPeriod(1);  renderReviewBody(); });
  const cs = document.getElementById('rv-cust-start'); if (cs) cs.addEventListener('change', e => { rvCustom.start = e.target.value; renderReviewBody(); });
  const ce = document.getElementById('rv-cust-end');   if (ce) ce.addEventListener('change', e => { rvCustom.end   = e.target.value; renderReviewBody(); });
}

// 範囲内の日別バー
function buildRangeDailyBarsSVG(days) {
  const max = Math.max(...days.map(d=>d.mins), 1);
  const n = days.length, W = 300, H = 112, gap = 2;
  const chartH = H - 30;                       // 下端は日付ラベル用に空ける
  const bw = (W - (n-1)*gap) / n;
  const genreColor = gid => ((genres||[]).find(g=>g.id===gid)?.color) || '#06b6d4';

  const bars = days.map((d,i) => {
    const x = i*(bw+gap), w = Math.max(bw,1);
    const totalH = d.mins>0 ? Math.max((d.mins/max)*chartH, 3) : 0;
    let segs;
    const gEntries = d.det?.genres ? Object.entries(d.det.genres).filter(([,m])=>m>0).sort((a,b)=>b[1]-a[1]) : [];
    if (d.mins>0 && gEntries.length) {
      // ジャンル別に積み上げ（色分け）
      const gsum = gEntries.reduce((s,[,m])=>s+m,0) || d.mins;
      let yTop = chartH - totalH;
      segs = gEntries.map(([gid,m]) => {
        const sh = (m/gsum)*totalH;
        const r = `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(sh,0.6).toFixed(1)}" fill="${genreColor(gid)}"><title>${d.date.getMonth()+1}/${d.date.getDate()}</title></rect>`;
        yTop += sh; return r;
      }).join('');
    } else {
      const h = d.mins>0 ? totalH : 3;
      segs = `<rect x="${x.toFixed(1)}" y="${(chartH-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${d.mins>0?'#06b6d4':'rgba(255,255,255,.08)'}"/>`;
    }
    // 日付（密集回避：1日・末日・5の倍数だけ数字を表示）
    const dom = d.date.getDate();
    const lab = (i===0 || i===n-1 || dom%5===0)
      ? `<text x="${(x+w/2).toFixed(1)}" y="${(chartH+11).toFixed(1)}" fill="rgba(255,255,255,.5)" font-size="7.5" text-anchor="middle">${dom}</text>` : '';
    // バー全体（透明な縦帯ごと）をタップ → その日のタイムログへ
    return `<g class="rv-day-bar" data-dk="${dkey(d.date)}" style="cursor:pointer">
      <rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${chartH}" fill="rgba(0,0,0,0)"/>
      ${segs}${lab}
    </g>`;
  }).join('');

  const monthLab = `<text x="0" y="${H-3}" fill="rgba(255,255,255,.4)" font-size="8">${days[0].date.getMonth()+1}月</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="rv-chart-svg">${bars}${monthLab}</svg>`;
}

// 期間モード（日/月/期間）の分析ビュー
// 1日の「24時間タイムマップ」（何時に学習したか）
function buildDayTimelineSVG(hourMins) {
  const W = 320, H = 112, padL = 4, padR = 4, top = 10, base = H - 24;
  const cw = (W - padL - padR) / 24;
  const max = Math.max(...Object.values(hourMins || {}), 1);
  let bars = '';
  for (let h = 0; h < 24; h++) {
    const m = hourMins?.[h] || 0;
    const bh = m > 0 ? Math.max((m / max) * (base - top), 4) : 0;
    const x = padL + h * cw;
    // 時間帯で色を変える（朝=黄/昼=シアン/夕=橙/夜=紫）
    let col = 'rgba(255,255,255,.06)';
    if (m > 0) col = (h>=5&&h<11)?'#fbbf24':(h>=11&&h<17)?'#06b6d4':(h>=17&&h<22)?'#f97316':'#818cf8';
    bars += `<rect x="${(x+1).toFixed(1)}" y="${(base-bh).toFixed(1)}" width="${(cw-2).toFixed(1)}" height="${(bh||2).toFixed(1)}" rx="1.5" fill="${col}"/>`;
  }
  const ticks = [0,6,12,18,23].map(h =>
    `<text x="${(padL+h*cw+cw/2).toFixed(1)}" y="${H-7}" fill="rgba(255,255,255,.45)" font-size="8" text-anchor="middle">${h}時</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="rv-chart-svg">${bars}${ticks}</svg>`;
}

// ⏱タイムログのカテゴリ別ブロックで「何をしたか」が分かる24時間バー＋凡例
function buildDayLogTimeline(dateKey) {
  if (typeof dayLog === 'undefined') return null;
  const blocks = (dayLog[dateKey] || []).slice();
  if (!blocks.length) return null;
  const W = 320, H = 30;
  let rects = `<rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="rgba(255,255,255,.05)"/>`;
  const byCat = {};
  blocks.forEach(b => {
    const c = _tlCat(b.cat);
    const s = _tlToMin(b.start), e = _tlToMin(b.end);
    byCat[c.id] = (byCat[c.id]||0) + _tlDur(b.start, b.end);
    const info = `${c.emoji} ${c.name}  ${b.start}〜${b.end}（${_tlFmtH(_tlDur(b.start,b.end))}）`;
    const segs = e > s ? [[s,e]] : [[s,1440],[0,e]];
    segs.forEach(([a,z]) => {
      rects += `<rect class="tl-seg" data-info="${info}" x="${(a/1440*W).toFixed(1)}" y="0" width="${Math.max((z-a)/1440*W,1).toFixed(1)}" height="${H}" fill="${c.color}"/>`;
    });
  });
  const ticks = [0,6,12,18,24].map(h =>
    `<text x="${Math.min(h/24*W, W-2).toFixed(1)}" y="${H+10}" fill="rgba(255,255,255,.45)" font-size="8" text-anchor="${h===0?'start':h===24?'end':'middle'}">${h}時</text>`).join('');
  // 凡例（多い順）
  const legend = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cid,min]) => {
    const c = _tlCat(cid);
    return `<span class="rv-daylog-leg"><span class="rv-leg-dot" style="background:${c.color}"></span>${c.emoji}${c.name} ${(min/60).toFixed(1)}h</span>`;
  }).join('');
  return `<div class="rv-chart-block rv-daylog-wrap">
      <svg viewBox="0 0 ${W} ${H+14}" class="rv-chart-svg">${rects}${ticks}</svg>
      <div class="tl-tip rv-dl-tip" hidden></div>
    </div>
    <div class="rv-daylog-legend">${legend}</div>`;
}

// 期間内の「実り（妖精への答え）」セクションを作る。なければ空文字
function buildFruitsSectionHTML(dates) {
  if (typeof collectFruitEntries !== 'function') return '';
  const keys = new Set(dates.map(d => dkey(d)));
  const entries = collectFruitEntries().filter(e => keys.has(dkey(e.at)));
  if (!entries.length) return '';
  const items = entries.slice(0, 30).map(e => `<div class="rv-fruit-item">
    <div class="rv-fruit-meta">${e.at.getMonth() + 1}/${e.at.getDate()} ・ ${e.genre.emoji} ${escHtml(e.genre.name)} ・ ${e.stage.emoji} ${e.stage.name}</div>
    <div class="rv-fruit-text">${escHtml(e.text)}</div>
  </div>`).join('');
  return `<div class="review-section">
    <div class="review-section-title">🍎 この期間の実り（学びのことば）</div>
    <div class="rv-fruit-list">${items}</div>
  </div>`;
}

function renderPeriodAnalytics(range) {
  const an = analyzeDays(range.dates);
  const { totalMins, studyDays, sessions, genreMins, slots, hasHour, days } = an;
  let html = `<div class="review-section">
    <div class="review-section-title">サマリー（${range.label}）</div>`;
  if (totalMins === 0) {
    html += `<div style="color:var(--text-dim);font-size:.82rem">この期間に学習記録はありません。</div>`;
  } else {
    html += `<div class="review-stats-grid">
      <div class="review-stat"><div class="review-stat-val">${fmtMins(totalMins)}</div><div class="review-stat-lbl">総学習時間</div></div>
      <div class="review-stat"><div class="review-stat-val">${studyDays}</div><div class="review-stat-lbl">学習日数</div></div>
      <div class="review-stat"><div class="review-stat-val">${sessions}</div><div class="review-stat-lbl">セッション</div></div>
    </div>`;
  }
  html += `</div>`;

  // 1日モードのタイムマップ（学習0でもタイムログがあれば表示するため、早期returnの前に）
  if (days.length === 1) {
    const dkey0 = (typeof _ltDateKey === 'function') ? _ltDateKey(range.dates[0]) : null;
    const logHtml0 = dkey0 ? buildDayLogTimeline(dkey0) : null;
    if (logHtml0) {
      html += `<div class="review-section">
        <div class="review-section-title">🕐 1日のタイムマップ</div>
        ${logHtml0}
      </div>`;
    }
  }

  // 学習0分でも、実り（学びのことば）があれば最下部に見せる
  if (totalMins === 0) {
    html += buildFruitsSectionHTML(range.dates);
    return html;
  }

  // 1日モードで、タイムログが無い場合のみ「学習のみマップ」をフォールバック表示
  if (days.length === 1) {
    const dkeyF = (typeof _ltDateKey === 'function') ? _ltDateKey(range.dates[0]) : null;
    const hasLog = dkeyF && buildDayLogTimeline(dkeyF);
    const hm = days[0].det?.hourMins;
    if (!hasLog && hm && Object.keys(hm).length) {
      const ent = Object.entries(hm).map(([h,m]) => [parseInt(h), m]).filter(([,m]) => m > 0).sort((a,b)=>a[0]-b[0]);
      const peak = ent.reduce((b,e)=> e[1] > b[1] ? e : b, ent[0]);
      const first = ent[0][0], last = ent[ent.length-1][0];
      const slotName = h => (h>=5&&h<11)?'朝':(h>=11&&h<17)?'昼':(h>=17&&h<22)?'夕方':'夜';
      html += `<div class="review-section">
        <div class="review-section-title">🕐 1日のタイムマップ（学習のみ）</div>
        <div class="rv-chart-block">${buildDayTimelineSVG(hm)}</div>
        <div class="rv-day-insights">
          <div>🎯 最も集中した時間帯：<b>${peak[0]}時台（${slotName(peak[0])}）・${peak[1]}分</b></div>
          <div>🕐 学習した時間の幅：<b>${first}時 〜 ${last+1}時</b></div>
          <div style="color:var(--text-dim);font-size:.66rem">⏱ で1日を記録すると、睡眠・仕事なども色分けで見えます</div>
        </div>
      </div>`;
    }
  }

  if (days.length > 1) {
    html += `<div class="review-section"><div class="review-section-title">📈 日別の推移
        <span class="rv-section-hint">色＝ジャンル ・ バーをタップでその日へ</span></div>
      <div class="rv-chart-block">${buildRangeDailyBarsSVG(days)}</div></div>`;
  }

  // ジャンル
  html += `<div class="review-section"><div class="review-section-title">ジャンル別</div>`;
  const ge = Object.entries(genreMins).map(([gid,m])=>({gid,m,genre:(genres||[]).find(g=>g.id===gid)}))
    .filter(e=>e.genre).sort((a,b)=>b.m-a.m);
  if (!ge.length) html += `<div style="color:var(--text-dim);font-size:.82rem">ジャンルデータがありません</div>`;
  else {
    const maxM = ge[0].m;
    html += ge.map(e => `<div class="review-bar-row">
      <div class="review-bar-label">${e.genre.emoji} ${e.genre.name}</div>
      <div class="review-bar-track"><div class="review-bar-fill" data-w="${Math.round(e.m/maxM*100)}" style="background:${e.genre.color||'var(--cyan)'}"></div></div>
      <div class="review-bar-val">${e.m}分</div></div>`).join('');
    const donut = buildGenreDonutSVG(genreMins);
    if (donut) html += `<div style="margin-top:12px">${donut}</div>`;
  }
  html += `</div>`;

  // 時間帯
  if (hasHour) {
    const slotDefs = [{k:'morning',e:'🌅',l:'朝'},{k:'afternoon',e:'☀️',l:'昼'},{k:'evening',e:'🌆',l:'夕'},{k:'night',e:'🌙',l:'夜'}];
    const bestSlot = Object.entries(slots).reduce((b,[k,v])=>v>b.v?{k,v}:b,{k:'',v:-1}).k;
    html += `<div class="review-section"><div class="review-section-title">時間帯</div>
      <div class="review-time-grid">${slotDefs.map(s=>`<div class="review-time-cell${s.k===bestSlot&&slots[s.k]>0?' highlight':''}">
        <span class="review-time-emoji">${s.e}</span><span class="review-time-slot-label">${s.l}</span>
        <span class="review-time-val">${slots[s.k]||0}分</span></div>`).join('')}</div></div>`;
  }

  // 🍎 実り（学びのことば）は一番下に表示
  html += buildFruitsSectionHTML(range.dates);
  return html;
}

function renderReviewBody() {
  const body = document.getElementById('review-body');
  const range = getReviewRange();
  const labelEl = document.getElementById('review-week-label');
  if (labelEl) labelEl.textContent = range.label;

  // 期間タブ＋日付ナビは固定枠に描画（スクロール領域の外＝常に見える）
  const barEl = document.getElementById('review-period-bar');
  if (barEl) barEl.innerHTML = renderPeriodBar();
  bindPeriodBar();

  // 日タブ：タイムログを表示
  if (rvPeriod === 'day') {
    document.getElementById('review-panel')?.classList.add('rv-day-active');
    body.innerHTML = '';
    const dayPanel = document.getElementById('rv-day-panel');
    if (dayPanel) {
      tlAnchor = _startOfDay(rvAnchor);
      const sel = document.getElementById('tl-cat');
      if (sel && !sel.options.length) {
        sel.innerHTML = TIMELOG_CATS.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
        sel.value = 'sleep';
        _tlPopulateDrums();
        _tlSetTime('tl-sh','tl-sm','22:00');
        _tlSetTime('tl-eh','tl-em','06:00');
      }
      renderTimelogPalette();
      initTimelogExtras();
      applyRoutineToday();
      renderRoutine();
      renderTimelog();
    }
    return;
  }

  // 月/期間：分析専用ビュー
  if (rvPeriod !== 'week') {
    document.getElementById('review-panel')?.classList.remove('rv-day-active');
    body.innerHTML = renderPeriodAnalytics(range);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.querySelectorAll('.review-bar-fill[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
    }));
    return;
  }

  // 週タブ：day-panelを隠す
  document.getElementById('review-panel')?.classList.remove('rv-day-active');

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

  // ─ Section 1.5: 学習タイプ診断 ──────────────────────
  html += renderLearningTypeSection();

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

  // ─ Section 2.5: グラフで見る ────────────────────────
  html += renderChartsSection(an, prev, saved, rvWeekKey);

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

  // ─ Section 3.5: ジョハリの窓 ────────────────────────
  html += renderJohariSection(an, prev, saved);

  // 🔍 AIに本気の分析を頼む（データを整形 → 各自のAIへ渡す）
  html += `<div class="review-section">
    <div class="review-section-title">🔍 AIに本気の分析を頼む</div>
    <div style="font-size:.72rem;color:var(--text-dim);line-height:1.6;margin-bottom:10px">あなたの学習データを“分析プロンプト”に整えます。コピーして、ふだん使っているAI（クロ／チャッピー等）に貼ると、データからは見えない「盲点」と「対策」を教えてもらえます。</div>
    <button id="ai-analyze-btn" class="lt-share-btn" onclick="copyAIAnalysisPrompt()">🔍 自分のデータをAIに分析してもらう</button>
  </div>`;

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

  // 学習タイプのシェアボタン
  const ltShareBtn = document.getElementById('lt-share-btn');
  if (ltShareBtn) {
    ltShareBtn.addEventListener('click', async () => {
      const r = await shareLearningType(ltShareBtn.dataset.code);
      if (r === 'cancelled') return;  // ユーザーが共有メニューを閉じただけ
      const msg = r === 'shared'     ? '✓ 共有しました！'
                : r === 'downloaded' ? '✓ 画像を保存しました！'
                : r === 'copied'     ? '✓ コピーしました！'
                : '⚠ 共有できませんでした';
      ltShareBtn.textContent = msg;
      setTimeout(() => { ltShareBtn.textContent = '✨ この結果をシェア'; }, 1800);
    });
  }

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
  Overlay.close('review-overlay');
  setReviewDot(false);
  // 自信ゲージ: 新規保存のときだけ +5
  if (_isFirstSaveForWeek) addConfidence(5, 'weekly_review');
}

function skipReview() {
  reviewStatus.skips = (reviewStatus.skips || 0) + 1;
  reviewStatus.lastSkipped = rvWeekKey;
  saveReviewStatus();
  Overlay.close('review-overlay');
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
  Overlay.close('review-overlay'));
document.getElementById('review-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('review-overlay'))
    Overlay.close('review-overlay');
});
document.getElementById('review-past-btn').addEventListener('click', showPastReviews);

// ═══════════════════════════════════════════════════════
//  SKILL TREE SYSTEM
// ═══════════════════════════════════════════════════════

// スキルは時間ではなく「世界樹の妖精への答え」で実る方式に変更。
// 旧・時間自動解放は廃止（互換のため空の結果を返す）。
function checkSkillUnlocks() {
  return { newlyUnlocked: [] };
}

function renderSkillCount() {
  const el = document.getElementById('skill-count-label');
  if (!el) return;
  const total = genres.length * 5;
  const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
  el.textContent = `🌳 実り ${unlocked} / ${total}`;
}

// 世界樹：下から上へ育つ一本の樹。
// 枝＝ジャンル、ぶら下がる実＝5つの成長段階、枝のまわりの葉＝答えた言葉の数。
// 答えるほど葉が茂り、樹はずっと育ち続ける。
function buildSkillTreeSVG(animate) {
  const N  = genres.length;
  const W  = 460, CX = 230;
  const H  = Math.max(318, 318 + (N - 1) * 92);
  const groundY = H - 52;
  const trunkTopY = 96;

  const aC = (ms) => animate ? ` class="skill-node sk-appear" style="animation-delay:${ms}ms"` : ' class="skill-node"';
  const bz = (p0, p1, p2, t) => ({
    x: (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x,
    y: (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y,
  });

  const STAGE_COLORS = ['#7ad97a', '#5fc9e8', '#b58cf2', '#f2a35f', '#f6c945'];
  const LEAF_COLORS  = ['#4f9d62', '#5fb774', '#3f8b52'];

  let p = [];
  p.push(`<defs>
    <linearGradient id="wtTrunk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a5633"/><stop offset="1" stop-color="#46311c"/>
    </linearGradient>
    <filter id="skf-g" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`);

  // ── 樹冠（てっぺんの茂み）と地面 ──
  p.push(`<ellipse cx="${CX}" cy="${trunkTopY + 14}" rx="104" ry="48" fill="rgba(74,222,128,.10)"/>`);
  p.push(`<ellipse cx="${CX - 62}" cy="${trunkTopY + 36}" rx="58" ry="28" fill="rgba(74,222,128,.07)"/>`);
  p.push(`<ellipse cx="${CX + 62}" cy="${trunkTopY + 36}" rx="58" ry="28" fill="rgba(74,222,128,.07)"/>`);
  p.push(`<ellipse cx="${CX}" cy="${groundY + 8}" rx="172" ry="24" fill="#16241c"/>`);
  p.push(`<ellipse cx="${CX}" cy="${groundY + 4}" rx="120" ry="15" fill="#1d2f24"/>`);
  // 草
  for (let i = 0; i < 7; i++) {
    const gx = CX - 150 + i * 50 + (i % 2) * 14;
    p.push(`<path d="M${gx} ${groundY + 6} q3 -12 7 -16" fill="none" stroke="#2f5e40" stroke-width="3" stroke-linecap="round"/>`);
  }

  // ── 根と幹（幹をタップ → 全体サマリー）──
  const c1y = groundY - (groundY - trunkTopY) * 0.4;
  const c2y = trunkTopY + (groundY - trunkTopY) * 0.25;
  p.push(`<path d="M${CX - 30} ${groundY + 4} C ${CX - 44} ${groundY + 2} ${CX - 52} ${groundY - 6} ${CX - 58} ${groundY - 14}" fill="none" stroke="#5d4126" stroke-width="9" stroke-linecap="round"/>`);
  p.push(`<path d="M${CX + 30} ${groundY + 4} C ${CX + 44} ${groundY + 2} ${CX + 52} ${groundY - 6} ${CX + 58} ${groundY - 14}" fill="none" stroke="#5d4126" stroke-width="9" stroke-linecap="round"/>`);
  p.push(`<g class="skill-node" data-node="root">
    <path d="M${CX - 17} ${groundY + 6}
             C ${CX - 13} ${c1y} ${CX - 9} ${c2y} ${CX - 5} ${trunkTopY}
             L ${CX + 5} ${trunkTopY}
             C ${CX + 9} ${c2y} ${CX + 13} ${c1y} ${CX + 17} ${groundY + 6} Z"
          fill="url(#wtTrunk)" stroke="rgba(0,0,0,.3)" stroke-width="2"/>
    <path d="M${CX - 4} ${groundY - 30} C ${CX - 2} ${c1y} ${CX - 1} ${c2y} ${CX + 1} ${trunkTopY + 40}" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2.5" stroke-linecap="round"/>
  </g>`);
  // てっぺんの若葉
  p.push(`<ellipse cx="${CX - 14}" cy="${trunkTopY - 6}" rx="16" ry="9" fill="#3f8b52" transform="rotate(-24 ${CX - 14} ${trunkTopY - 6})"/>`);
  p.push(`<ellipse cx="${CX + 14}" cy="${trunkTopY - 6}" rx="16" ry="9" fill="#4f9d62" transform="rotate(24 ${CX + 14} ${trunkTopY - 6})"/>`);
  p.push(`<ellipse cx="${CX}" cy="${trunkTopY - 16}" rx="14" ry="9" fill="#5fb774"/>`);

  // ── 枝（ジャンル）：古いジャンルほど下の枝。左右交互に伸びる ──
  let totalUnlocked = 0, totalWords = 0;
  for (let i = 0; i < N; i++) {
    const g = genres[i];
    const side = (i % 2 === 0) ? -1 : 1;
    const by = groundY - 110 - i * 92;
    const P0 = { x: CX,              y: by + 8 };
    const P1 = { x: CX + side * 78,  y: by - 14 };
    const P2 = { x: CX + side * 172, y: by - 30 };

    const uc = SKILL_THRESHOLDS.filter((_, j) => skillData[`${g.id}_${j}`]).length;
    const words = SKILL_THRESHOLDS.reduce((s, _, j) => s + ((skillNotes[`${g.id}_${j}`] || []).length), 0);
    totalUnlocked += uc; totalWords += words;
    const isMaxed = uc === 5;

    // 枝の後ろのもや（実りがあるジャンルほど茂って見える）
    if (uc > 0) p.push(`<ellipse cx="${CX + side * 118}" cy="${by - 44}" rx="${80 + uc * 5}" ry="${30 + uc * 3}" fill="rgba(74,222,128,.07)"/>`);

    // 枝本体
    p.push(`<path d="M${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}" fill="none" stroke="#5d4126" stroke-width="11" stroke-linecap="round"/>`);
    p.push(`<path d="M${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}" fill="none" stroke="#7a5633" stroke-width="5" stroke-linecap="round"/>`);
    // 小枝
    const tw = bz(P0, P1, P2, 0.55);
    p.push(`<path d="M${tw.x} ${tw.y} q ${side * 14} -18 ${side * 20} -30" fill="none" stroke="#5d4126" stroke-width="5" stroke-linecap="round"/>`);

    // 葉っぱ＝答えた「ことば」の数だけ茂る（最大12枚表示）
    const leafN = Math.min(12, Math.max(0, words - uc) + uc);
    for (let j = 0; j < leafN; j++) {
      const lt = 0.18 + (((j * 53) % 80) / 100) * 0.78;
      const lp = bz(P0, P1, P2, lt);
      const ly = lp.y - 12 - ((j * 37) % 16);
      const rot = ((j * 47) % 70) - 35;
      p.push(`<ellipse cx="${lp.x + (((j * 29) % 14) - 7)}" cy="${ly}" rx="7.5" ry="4.5"
        fill="${LEAF_COLORS[j % 3]}" opacity="0.92" transform="rotate(${rot} ${lp.x} ${ly})"/>`);
    }

    // 実（5つの成長段階）：枝からぶら下がる。未解放はつぼみ
    const TS = [0.26, 0.42, 0.58, 0.74, 0.90];
    for (let j = 0; j < 5; j++) {
      const bp = bz(P0, P1, P2, TS[j]);
      const key = `${g.id}_${j}`;
      const isUnlocked = !!skillData[key];
      const t = SKILL_THRESHOLDS[j];
      const delay = 250 + i * 120 + j * 70;
      if (isUnlocked) {
        const col  = STAGE_COLORS[j];
        const filt = j === 4 ? ' filter="url(#skf-g)"' : '';
        p.push(`<g${aC(delay)} data-node="skill" data-genre="${g.id}" data-skill="${j}">
          <line x1="${bp.x}" y1="${bp.y}" x2="${bp.x}" y2="${bp.y + 14}" stroke="#5d4126" stroke-width="2.5"/>
          <circle cx="${bp.x}" cy="${bp.y + 26}" r="13" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="2"${filt}/>
          <circle cx="${bp.x - 4}" cy="${bp.y + 21}" r="3.5" fill="#fff" opacity="0.5"/>
          <text x="${bp.x}" y="${bp.y + 27}" text-anchor="middle" dominant-baseline="central" font-size="12">${t.emoji}</text>
        </g>`);
      } else {
        p.push(`<g${aC(delay)} data-node="skill" data-genre="${g.id}" data-skill="${j}" opacity="0.85">
          <line x1="${bp.x}" y1="${bp.y}" x2="${bp.x}" y2="${bp.y + 8}" stroke="#4a3a22" stroke-width="2"/>
          <ellipse cx="${bp.x}" cy="${bp.y + 15}" rx="5.5" ry="7.5" fill="#3a5b45" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/>
        </g>`);
      }
    }

    // 枝先のジャンル札（葉のかたまり＋絵文字＋名前）
    const nm = g.name.length > 6 ? g.name.slice(0, 5) + '…' : g.name;
    const gcol = g.color || '#4ade80';
    const ringCol = isMaxed ? '#fbbf24' : gcol;
    p.push(`<g${aC(150 + i * 120)} data-node="genre" data-genre="${g.id}">
      <ellipse cx="${P2.x - 12}" cy="${P2.y - 8}" rx="20" ry="11" fill="#3f8b52" transform="rotate(-18 ${P2.x - 12} ${P2.y - 8})"/>
      <ellipse cx="${P2.x + 12}" cy="${P2.y - 8}" rx="20" ry="11" fill="#4f9d62" transform="rotate(18 ${P2.x + 12} ${P2.y - 8})"/>
      <circle cx="${P2.x}" cy="${P2.y - 14}" r="17" fill="rgba(20,32,24,.85)" stroke="${ringCol}" stroke-width="2"${isMaxed ? ' filter="url(#skf-g)"' : ''}/>
      <text x="${P2.x}" y="${P2.y - 13}" text-anchor="middle" dominant-baseline="central" font-size="14">${g.emoji}</text>
      <text x="${P2.x}" y="${P2.y + 14}" text-anchor="middle" font-size="9.5" fill="rgba(232,232,240,.6)" font-family="'Noto Sans JP',sans-serif">${nm}${isMaxed ? ' ✦' : ''}</text>
    </g>`);
  }

  // ── 妖精（タップで案内）と、実りが増えたときの光 ──
  p.push(`<g class="skill-node" data-node="fairy" style="cursor:pointer">
    <circle cx="${CX + 40}" cy="${groundY - 70}" r="20" fill="rgba(232,121,249,.10)">
      <animate attributeName="r" values="17;22;17" dur="3.4s" repeatCount="indefinite"/>
    </circle>
    <text x="${CX + 40}" y="${groundY - 64}" text-anchor="middle" font-size="17">🧚</text>
    <animateTransform attributeName="transform" type="translate" values="0 0; 0 -8; 0 0" dur="3.4s" repeatCount="indefinite"/>
  </g>`);
  if (totalUnlocked >= 5) {
    for (let i = 0; i < 5; i++) {
      const sx = 50 + ((i * 97) % 360);
      const sy = 70 + ((i * 61) % Math.max(120, H - 220));
      p.push(`<circle cx="${sx}" cy="${sy}" r="2" fill="#ffe9a8">
        <animate attributeName="opacity" values="0.08;0.9;0.08" dur="${2.2 + (i % 3) * 0.7}s" begin="${i * 0.5}s" repeatCount="indefinite"/>
      </circle>`);
    }
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
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
      else if (type === 'fairy') showFairyGuide();
      else if (type === 'genre') showSkillNodeDetail('genre', node.dataset.genre, null);
      else showSkillNodeDetail('skill', node.dataset.genre, parseInt(node.dataset.skill));
    });
  });

  const total = genres.length * 5;
  const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
  const words = collectFruitEntries().length;
  document.getElementById('skill-panel-sub').textContent = `🍎 実り ${unlocked} / ${total} ・ 📖 ことば ${words}個`;
}

function showSkillNodeDetail(type, genreId, skillIdx) {
  const detail  = document.getElementById('skill-detail');
  const emoji   = document.getElementById('sd-emoji');
  const name    = document.getElementById('sd-name');
  const desc    = document.getElementById('sd-desc');
  const status  = document.getElementById('sd-status');
  const progFill = document.getElementById('sd-prog-fill');

  if (type === 'root') {
    emoji.textContent = '🌳';
    name.textContent  = '世界樹';
    desc.textContent  = 'あなたの学びで育つ樹。セッション後に妖精の問いへ答えるたび、実とことばの葉が増えていきます。';
    const total    = genres.length * 5;
    const unlocked = Object.keys(skillData).filter(k => genres.some(g => k.startsWith(g.id + '_'))).length;
    status.textContent = `🍎 実り ${unlocked} / ${total} ・ 📖 ことば ${collectFruitEntries().length}個`;
    status.className   = 'sd-status st-unlocked';
    progFill.style.width = `${total > 0 ? (unlocked / total) * 100 : 0}%`;
  } else if (type === 'genre') {
    const g = genres.find(x => x.id === genreId);
    if (!g) return;
    emoji.textContent = g.emoji;
    name.textContent  = g.name;
    const uc = SKILL_THRESHOLDS.filter((_, j) => skillData[`${g.id}_${j}`]).length;
    if (uc === 5) {
      desc.textContent   = `🌳 全5段階が実りました！この樹は、あなたの成長そのもの。`;
      status.textContent = '✦ 達人級 — すべての段階を習得';
      status.className   = 'sd-status st-maxed';
      progFill.style.width = '100%';
    } else {
      desc.textContent = `${uc} / 5 の実が成りました（成長の段階）`;
      const next = SKILL_THRESHOLDS[uc];
      status.textContent = `次は「${next.emoji} ${next.name}」— セッション後、妖精の問いに答えると実ります`;
      status.className   = uc > 0 ? 'sd-status st-unlocked' : 'sd-status st-locked';
      progFill.style.width = `${Math.round((uc / 5) * 100)}%`;
    }
  } else {
    const g = genres.find(x => x.id === genreId);
    const t = SKILL_THRESHOLDS[skillIdx];
    if (!g || !t) return;
    const key = `${g.id}_${skillIdx}`;
    const isUnlocked = !!skillData[key];
    emoji.textContent = isUnlocked ? t.emoji : '🔒';
    name.textContent  = `${g.emoji} ${t.name}`;
    const notes = (skillNotes[key] || []);
    if (isUnlocked) {
      // 成長メモ（実）の一覧を表示
      const list = notes.length
        ? notes.map(n => `🍎 ${escHtml(n.text)}`).join('<br>')
        : t.desc;
      desc.innerHTML = list;
      const d = new Date(skillData[key]);
      status.textContent = `✦ 実りました (${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()})`;
      status.className   = skillIdx === 4 ? 'sd-status st-maxed' : 'sd-status st-unlocked';
      progFill.style.width = '100%';
    } else {
      desc.textContent  = `「${t.q}」`;
      status.textContent = `🧚 セッション後、妖精の問いに答えると実ります`;
      status.className   = 'sd-status st-locked';
      progFill.style.width = '0%';
    }
  }
  detail.classList.add('visible');
}

// ── 妖精の案内：今の状況に合わせたナッジを話す ─────────────
// 優先順位：①今日まだ学習してない → 5分だけ誘う
//           ②学習したけど実ってない → 妖精の問いへ誘う
//           ③次のつぼみがある → 次の段階を予告
//           ④全部実った → 記録帳へ誘う
// 各状況に複数のセリフを持ち、タップするたびに違うことを言う。
// ctx: { g: 現在ジャンル, next: 次の段階(なければnull) }
const FAIRY_LINES = {
  start: [   // ①今日まだ学習していない
    () => '今日の冒険は、これからだね。むずかしいことは無し、まず5分だけ机に向かってみない？ 樹はちゃんと待ってるよ🌱',
    () => 'ねえねえ、今日はまだ樹に水をあげてないみたい。5分の集中が、いちばんの栄養なんだよ💧',
    () => '大丈夫、始めるのに「やる気」はいらないの。座って、タイマーを押すだけでいいんだよ',
    () => 'つぼみたちがそわそわしてる。「今日も来てくれるかな」って。…5分だけ、顔を見せてあげない？',
    () => '完璧な準備なんていらないよ。タイマーを押した人から、物語は始まるんだ⏱',
    () => (new Date().getHours() >= 21
      ? 'もう夜だね。でも寝る前の5分は、明日の自分への贈り物になるよ🌙'
      : 'いまが今日いちばん若い時間だよ。さ、軽くいこ！'),
  ],
  answer: [   // ②学習したけど、今日の実がまだ
    (c) => `今日はもう学んだんだね、えらい！ その学びをひとこと聞かせて？ ${c.next ? `たとえば「${c.next.emoji} ${c.next.name}」のつぼみが待ってるよ。` : 'どの段階でも、感じたままでいいからね。'}`,
    () => 'おかえり！今日の冒険はどうだった？ 小さなことでいいの、ひとつだけ教えて🍎',
    () => 'がんばった足あと、ちゃんと見てたよ。最後にひとこと残すと、今日の学びが「実」になるんだ',
    () => '学びっぱなしは、ちょっともったいないかも。ことばにした瞬間、知識は宝物になるんだよ✨',
    () => 'ふふ、いい顔してる。今日の「できた」をひとつ、樹に飾っていかない？',
  ],
  next: [   // ③今日実った・次のつぼみあり
    (c) => `今日の実、ちゃんと樹に増えてたよ✨ 次は「${c.next.emoji} ${c.next.name}」── ${c.next.q} って聞く日が楽しみだな。`,
    () => '今日も実をありがとう。樹がちょっと嬉しそうに揺れたの、見えた？🌿',
    (c) => `いいことばだったね。次のつぼみ「${c.next.emoji} ${c.next.name}」も、あなたの話を待ってるよ`,
    () => '実りの多い一日だね。よかったら、昔のことばも読み返してみる？ 案外いいこと書いてるんだよ📖',
    () => '今日のあなた、なんだか調子いいね。もうひとつ聞かせてくれても、いいんだよ？',
  ],
  maxed: [   // ④全段階が実った
    (c) => `${c.g ? c.g.emoji + ' ' + c.g.name + 'の樹は満開だよ！' : ''} ここまでのことば、読み返してみない？ 過去の自分が、今のあなたを励ましてくれるよ`,
    () => '満開の樹の下で、ことばの宝箱を開けてみない？ ぜんぶ、あなたが書いたものだよ📖',
    () => 'ここまで来たんだね…。最初の実のこと、覚えてる？ 読み返すと、きっと驚くよ',
    () => '実りはもう数えきれないけど、あなたの成長はまだ途中。新しいジャンルの樹を植えるのも、いいかもね🌱',
  ],
};

// 直前と同じセリフは選ばない（プールが2個以上あるとき）
let _fairyLastLine = {};
function pickFairyLine(key, ctx) {
  const pool = FAIRY_LINES[key];
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === _fairyLastLine[key]) idx = (idx + 1) % pool.length;
  _fairyLastLine[key] = idx;
  return pool[idx](ctx);
}

function getFairyGuide() {
  const today = todayKey();
  const studiedToday = (data.todayMinutes || 0) > 0;
  const fruitToday = collectFruitEntries().some(e => dkey(e.at) === today);

  const g = genres.find(x => x.id === currentGenreId) || genres[0];
  const nextIdx = g ? SKILL_THRESHOLDS.findIndex((_, j) => !skillData[`${g.id}_${j}`]) : -1;
  const ctx = { g, next: nextIdx >= 0 ? SKILL_THRESHOLDS[nextIdx] : null };

  if (!studiedToday) {
    return { msg: pickFairyLine('start', ctx),
      actions: [{ id: 'fairy-act-start', label: '⏱ 5分だけ始める' }] };
  }
  if (!fruitToday) {
    return { msg: pickFairyLine('answer', ctx),
      actions: [{ id: 'fairy-act-answer', label: '🧚 妖精に答える' }] };
  }
  if (ctx.next) {
    return { msg: pickFairyLine('next', ctx),
      actions: [{ id: 'fairy-act-answer', label: '🧚 もうひとつ答える' }, { id: 'fairy-act-journal', label: '📖 記録帳を読む' }] };
  }
  return { msg: pickFairyLine('maxed', ctx),
    actions: [{ id: 'fairy-act-journal', label: '📖 記録帳を読む' }] };
}

function showFairyGuide() {
  const detail = document.getElementById('skill-detail');
  const guide = getFairyGuide();
  document.getElementById('sd-emoji').textContent = '🧚';
  document.getElementById('sd-name').textContent  = '世界樹の妖精';
  document.getElementById('sd-desc').innerHTML =
    `<span class="fairy-guide-msg">${guide.msg}</span>
     <div class="fairy-guide-actions">
       ${guide.actions.map(a => `<button class="fairy-guide-btn" id="${a.id}">${a.label}</button>`).join('')}
     </div>`;
  document.getElementById('sd-status').textContent = '';
  document.getElementById('sd-prog-fill').style.width = '0%';
  detail.classList.add('visible');

  // アクション：⏱ タイマーへ誘導（閉じて、STARTをぽわんと光らせる）
  document.getElementById('fairy-act-start')?.addEventListener('click', () => {
    Overlay.close('skill-overlay');
    const startBtn = document.getElementById('start-btn');
    document.getElementById('timer-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (startBtn) {
      startBtn.classList.add('first-glow');
      setTimeout(() => startBtn.classList.remove('first-glow'), 6000);
    }
  });
  // アクション：🧚 そのまま妖精の問いへ（答えると樹が即更新される）
  document.getElementById('fairy-act-answer')?.addEventListener('click', () => {
    openFairyModal(currentGenreId, todayKey());
  });
  // アクション：📖 記録帳タブへ
  document.getElementById('fairy-act-journal')?.addEventListener('click', () => {
    switchSkillTab('journal');
  });
}

// ═══════════════════════════════════════════════════════
//  🧚 導きの妖精ガイド（ヘッダー「迷ったら押す」）
//  2段構え：🔮 今日のお告げ（状況で変わる「次の一歩」）
//           📖 遊び方ガイド（「？」で各機能の説明アコーディオン）
// ═══════════════════════════════════════════════════════

// 各機能の初心者向け説明。key は UNLOCK_DEFS のキー（解放制）。null は最初から使える。
const FG_CATEGORIES = [
  { emoji:'⏱', name:'タイマー', key:null, nav:'timer',
    desc:'集中する時間をはかる基本の道具です。STARTを押して勉強や作業をして、終わったら止めるだけ。集中した分がXP（経験値）になって、あなたが育ちます。' },
  { emoji:'🎯', name:'モード（ポモドーロ／ディープ／フロー）', key:null, nav:'timer',
    desc:'「ポモドーロ」は25分集中＋5分休憩のリズム。「ディープ」は50分のじっくり型。「フロー」は時間無制限で、自分で止めるまで集中できます。気分で選んでOK。' },
  { emoji:'🏰', name:'冒険者ギルド', key:'guild', nav:'guild',
    desc:'「今日なにすればいい？」に答えてくれる依頼（クエスト）の掲示板です。やさしい依頼から挑戦まで並んでいて、こなすと名声や報酬がもらえます。' },
  { emoji:'⛩️', name:'誓いの祠', key:'guild', nav:'guild',
    desc:'「これをやる」と目標を石碑に刻む場所です（人に宣言すると頑張れる、という心理を使います）。果たすと妖精が祝福してくれます。期限を過ぎても、やさしく見守ります。' },
  { emoji:'🎲', name:'すごろく', key:'board', nav:'board',
    desc:'集中を終えるとサイコロを振れます。進んだマスで、装備やアイテムに出会えます。何が出るかはお楽しみ。' },
  { emoji:'🥚', name:'オトモン図鑑', key:null, nav:'otomon',
    desc:'すごろくの旅先で「卵」を拾い、「目覚めアイテム」で現実の小さな行動クエストを起こすと、卵が孵って相棒（オトモン）が生まれます。生まれた子は図鑑に集まり、あなたをそっと応援してくれます。' },
  { emoji:'🌳', name:'スキルツリー（世界樹）', key:'skill', nav:'skill',
    desc:'学びのあと、🧚妖精の問いに「ひとこと」答えると、樹に実がなります。あなたの学びの言葉が、そのまま宝物になっていきます。' },
  { emoji:'🏅', name:'バッジ', key:'badges', nav:'badges',
    desc:'がんばりの証（あかし）です。「○日続けた」「△分勉強した」などの条件を満たすと、自動で集まります。コレクション感覚でどうぞ。' },
  { emoji:'📊', name:'週次レビュー＆AI分析', key:'review', nav:'review',
    desc:'1週間の学びをふりかえる場所です。曜日や時間帯のクセが見えます。「AI分析プロンプト」をコピーして、あなたのAIに渡すと、自分の盲点を教えてもらえます。' },
];

// ── 🔮 お告げ：今の状況を見て「次の一歩」を1つ示す ──
//    戻り値 { icon, msg, action:{ label, go } | null }
function buildFairyOracle() {
  const studiedToday = (data.todayMinutes || 0) > 0;
  const has = k => (typeof featUnlocks !== 'undefined') && featUnlocks.has(k);
  const guildOpen  = has('guild');
  const skillOpen  = has('skill');
  const reviewOpen = has('review');
  let fruitToday = false;
  try { const t = todayKey(); fruitToday = collectFruitEntries().some(e => dkey(e.at) === t); } catch (e) {}

  const goTimer = () => {
    closeFairyGuideModal();
    document.getElementById('timer-card')?.scrollIntoView({ behavior:'smooth', block:'center' });
    const b = document.getElementById('start-btn');
    if (b) { b.classList.add('first-glow'); setTimeout(() => b.classList.remove('first-glow'), 6000); }
  };
  const goFeature = (btnId) => () => { closeFairyGuideModal(); document.getElementById(btnId)?.click(); };

  // ① まだ一度も集中していない（超初心者）
  if ((data.sessions || 0) === 0) {
    return { icon:'🌱', msg:'ようこそ。むずかしいことは無し。まず ⏱ で5分だけ、机に向かってみない？ そこから全部はじまるよ。',
      action:{ label:'⏱ 5分だけ始める', go: goTimer } };
  }
  // ② 連続記録が途切れた直後 → おかえり
  if (data.streakWasBroken) {
    if (guildOpen) return { icon:'🫶', msg:'おかえり。戻ってきたこと自体が、もう立派だよ。1分でもいいから、また一歩だけ踏み出そう。',
      action:{ label:'🏰 おかえり依頼を見る', go: goFeature('guild-btn') } };
    return { icon:'🫶', msg:'おかえり。間があいても大丈夫。1分でいいから、そっと戻ってみよう。',
      action:{ label:'⏱ 1分だけ戻る', go: goTimer } };
  }
  // ③ 今日まだ集中していない
  if (!studiedToday) {
    return { icon:'⏱', msg:'今日はまだ樹に水をあげてないみたい。5分の集中が、いちばんの栄養なんだよ。',
      action:{ label:'⏱ 今日のはじめの5分', go: goTimer } };
  }
  // 🥚 オトモン：進行中のクエスト or 起こせる卵があれば案内する
  if (typeof window !== 'undefined' && window.Otomon) {
    try {
      const goOtomon = () => { closeFairyGuideModal(); window.Otomon.openPanel(); };
      const q = window.Otomon.getActiveQuest();
      if (q && !q.done) {
        return { icon:'🥚', msg:`オトモンの卵が、あなたの行動を待ってるよ。「${q.text}」を達成すると、孵化に近づくよ。`,
          action:{ label:'🥚 図鑑をひらく', go: goOtomon } };
      }
      const eggs = window.Otomon.listEggs();
      if (eggs && eggs.length) {
        return { icon:'🥚', msg:`拾った卵が ${eggs.length} 個あるよ。図鑑で「目覚めアイテム」を使って、起こしてあげよう。`,
          action:{ label:'🥚 図鑑をひらく', go: goOtomon } };
      }
    } catch (e) {}
  }
  // ④ 集中したのに、まだ妖精に答えていない → 学びを実らせよう
  if (skillOpen && !fruitToday) {
    return { icon:'🍎', msg:'今日はもう学んだね、えらい！ その学びを「ひとこと」だけ樹に残すと、実になるよ。',
      action:{ label:'🌳 妖精に答える', go: () => { closeFairyGuideModal(); document.getElementById('skill-btn')?.click(); setTimeout(() => { try { showFairyGuide(); } catch (e) {} }, 350); } } };
  }
  // ⑤ ギルドに今日のおすすめ依頼がある
  if (guildOpen) {
    let rec = null; try { rec = guildPickRecommended(); } catch (e) {}
    if (rec && rec.q) {
      return { icon:'🏰', msg:`ギルドに「${rec.tag}」が届いてるよ。${rec.q.title ? '『' + rec.q.title + '』' : ''} ── 見に行く？`,
        action:{ label:'🏰 ギルドへ行く', go: goFeature('guild-btn') } };
    }
  }
  // ⑥ 週末＆レビュー解放 → ふりかえりを勧める
  const dow = new Date().getDay(); // 0=日, 6=土
  if (reviewOpen && (dow === 0 || dow === 6)) {
    return { icon:'📊', msg:'今週もよくがんばったね。週末は、📊で今週の自分をふりかえる絶好のタイミングだよ。',
      action:{ label:'📊 今週をふりかえる', go: goFeature('review-btn') } };
  }
  // ⑦ それ以外（順調）→ ねぎらい
  return { icon:'✨', msg:'今日のあなた、いい調子。この一歩を、明日のあなたがきっと喜ぶよ。むりせず、楽しんでいこう。',
    action: skillOpen ? { label:'🌳 学びをふりかえる', go: goFeature('skill-btn') } : null };
}

let _fgOracleAction = null;
function renderFairyGuide() {
  // 🔮 お告げ
  const oracle = buildFairyOracle();
  _fgOracleAction = oracle.action ? oracle.action.go : null;
  document.getElementById('fg-oracle').innerHTML = `
    <div class="fg-oracle-label">🔮 今日のお告げ</div>
    <div class="fg-oracle-msg"><span class="fg-oracle-icon">${oracle.icon}</span>${oracle.msg}</div>
    ${oracle.action ? `<button class="fairy-guide-btn" id="fg-oracle-act">${oracle.action.label}</button>` : ''}`;
  document.getElementById('fg-oracle-act')?.addEventListener('click', () => { if (_fgOracleAction) _fgOracleAction(); });

  // 📖 遊び方ガイド（？で説明アコーディオン ＋ → でショートカット）
  document.getElementById('fg-guide-list').innerHTML = FG_CATEGORIES.map(c => {
    const locked = c.key && !((typeof featUnlocks !== 'undefined') && featUnlocks.has(c.key));
    const lockHint = locked ? `<div class="fg-lock-hint">🔒 ${guideUnlockHint(c.key)}</div>` : '';
    const jump = (!locked && c.nav)
      ? `<button class="fg-jump" data-nav="${c.nav}">→ 開く</button>`
      : (locked ? `<span class="fg-lock-mini" aria-hidden="true">🔒</span>` : '');
    return `<div class="fg-item ${locked ? 'locked' : ''}">
      <div class="fg-item-head">
        <span class="fg-item-name">${c.emoji} ${c.name}</span>
        ${jump}
        <span class="fg-q" aria-hidden="true">？</span>
      </div>
      <div class="fg-item-body"><div class="fg-item-desc">${c.desc}</div>${lockHint}</div>
    </div>`;
  }).join('');
  // ？／名前タップ → 説明を開閉
  document.querySelectorAll('#fg-guide-list .fg-item-head').forEach(head => {
    head.addEventListener('click', () => head.closest('.fg-item').classList.toggle('open'));
  });
  // → 開く → その機能へジャンプ（説明アコーディオンは開かない）
  document.querySelectorAll('#fg-guide-list .fg-jump').forEach(btn => {
    const go = fgGo(btn.dataset.nav);
    btn.addEventListener('click', e => { e.stopPropagation(); if (go) go(); });
  });

  renderFgPlanner();
}

// ── 📅 導きの妖精から、カレンダーへ予定・TODOを直接書き込む ──
let fgPlanKind = 'task';
function renderFgPlanner() {
  const el = document.getElementById('fg-planner');
  if (!el) return;
  const today = todayKey();
  el.innerHTML = `
    <div class="fg-plan-title">📅 カレンダーに予定・TODOを書き込む</div>
    <div class="fg-plan-kind">
      <button type="button" class="fg-kind-btn active" data-fgkind="task">✓ やること</button>
      <button type="button" class="fg-kind-btn" data-fgkind="event">📌 予定</button>
    </div>
    <input type="date" id="fg-plan-date" class="fg-plan-input fg-plan-date" value="${today}" min="${today}">
    <input type="text" id="fg-plan-text" class="fg-plan-input" maxlength="80" placeholder="やること・予定を入力">
    <div class="fg-plan-opts">
      <input type="time" id="fg-plan-time" class="fg-plan-time" title="時刻（任意）">
      <select id="fg-plan-repeat" class="fg-plan-rep" title="繰り返し">
        <option value="none">繰り返しなし</option>
        <option value="daily">毎日</option>
        <option value="weekly">毎週</option>
        <option value="monthly">毎月</option>
      </select>
      <label class="fg-plan-remind" title="時刻に通知"><input type="checkbox" id="fg-plan-remind">🔔</label>
      <button type="button" id="fg-plan-add" class="fg-plan-add-btn">追加</button>
    </div>
    <div class="fg-plan-hint">選んだ日のカレンダーに入ります。🔔は時刻つきの予定に通知（アプリを開いている間）。</div>
    <div class="fg-plan-msg" id="fg-plan-msg"></div>`;
  fgPlanKind = 'task';

  el.querySelectorAll('[data-fgkind]').forEach(b => b.addEventListener('click', () => {
    fgPlanKind = b.dataset.fgkind;
    el.querySelectorAll('[data-fgkind]').forEach(x => x.classList.toggle('active', x === b));
  }));
  document.getElementById('fg-plan-add').addEventListener('click', _fgPlannerAdd);
  document.getElementById('fg-plan-text').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _fgPlannerAdd(); }
  });
}

function _fgPlannerAdd() {
  const textEl = document.getElementById('fg-plan-text');
  const dk     = document.getElementById('fg-plan-date')?.value || todayKey();
  const text   = (textEl?.value || '').trim();
  if (!text) { textEl?.focus(); return; }
  const time   = document.getElementById('fg-plan-time')?.value || null;
  const repeat = document.getElementById('fg-plan-repeat')?.value || 'none';
  const remind = !!document.getElementById('fg-plan-remind')?.checked;
  addPlannerTask(dk, text, time, repeat, remind, fgPlanKind);
  const parts = dk.split('-');
  const msg = document.getElementById('fg-plan-msg');
  if (msg) {
    msg.textContent = `✓ ${Number(parts[1])}/${Number(parts[2])} に「${text}」を追加しました`;
    msg.classList.add('show');
  }
  textEl.value = '';
  textEl.focus();
  if (typeof renderCalendar === 'function') renderCalendar();
}

function guideUnlockHint(key) {
  const m = {
    guild:     'まず1回、集中を終えると解放されます',
    board:     'まず1回、集中を終えると解放されます',
    skill:     '妖精の問いに1回答えると解放されます',
    equipment: 'すごろくでアイテムを1つ手に入れると解放されます',
    badges:    'バッジを1つ獲得すると解放されます',
    review:    '4回 集中すると解放されます',
  };
  return m[key] || 'もう少し進むと解放されます';
}

// ── ショートカット：導きの妖精から各機能へジャンプ ──
// 装備・バッジはアバターの中にあるので、アバターを開いてから対象を開く。
function fgGo(nav) {
  const close = () => closeFairyGuideModal();
  const click = id => { close(); document.getElementById(id)?.click(); };
  switch (nav) {
    case 'timer':
      return () => { close(); document.getElementById('timer-card')?.scrollIntoView({ behavior:'smooth', block:'center' }); };
    case 'guild':  return () => click('guild-btn');
    case 'board':  return () => click('board-btn');
    case 'skill':  return () => click('skill-btn');
    case 'review': return () => click('review-btn');
    case 'badges':
      return () => { close(); document.getElementById('avatar-btn')?.click(); setTimeout(() => document.getElementById('avatar-open-badges')?.click(), 300); };
    case 'otomon':
      return () => { close(); if (window.Otomon) window.Otomon.openPanel(); };
    default: return null;
  }
}

function openFairyGuideModal()  { renderFairyGuide(); Overlay.open('fairy-guide-overlay'); }
function closeFairyGuideModal() { Overlay.close('fairy-guide-overlay'); }
document.getElementById('fairy-guide-btn')?.addEventListener('click', openFairyGuideModal);
document.getElementById('fairy-guide-close-btn')?.addEventListener('click', closeFairyGuideModal);
document.getElementById('fairy-guide-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('fairy-guide-overlay')) closeFairyGuideModal();
});

// ═══════════════════════════════════════════════════════
//  導きのしるべ — 初回の操作ガイド
//  localStorage: gq_guide_tutorial_seen = '1' なら自動表示しない
// ═══════════════════════════════════════════════════════
const GUIDE_TUTORIAL_KEY = 'gq_guide_tutorial_seen';
const GUIDE_STEPS = [
  {
    id: 'start_timer',
    target: "[data-guide='start-timer']",
    fallbackTarget: '#timer-card',
    fairyLine: 'まずはここから。5分だけ集中すると、経験値と自信が少し育つよ。',
    label: 'ここを押してね'
  },
  {
    id: 'daily_quest',
    target: "[data-guide='daily-quests']",
    fairyLine: '今日のクエストは、毎日の小さな成長ミッションだよ。達成するとXPや自信がもらえるよ。',
    label: '今日の目標だよ'
  },
  {
    id: 'top_buttons',
    target: "[data-guide='top-actions']",
    fairyLine: '上のボタンから、仲間や記録、オトモンの卵を確認できるよ。最初は気にしなくて大丈夫。まずは5分だけ始めよう。',
    label: 'あとで見ればOK'
  }
];

let guideTutorialStep = 0;
let guideTutorialTarget = null;
let guideTutorialRetry = null;

function guideClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findGuideTarget(step) {
  const target = document.querySelector(step.target);
  if (target && target.offsetParent !== null) return target;
  return step.fallbackTarget ? document.querySelector(step.fallbackTarget) : target;
}

function clearGuideHighlight() {
  if (guideTutorialTarget) guideTutorialTarget.classList.remove('guide-tutorial-target');
  guideTutorialTarget = null;
}

function positionGuideTutorial() {
  const overlay = document.getElementById('guide-tutorial-overlay');
  if (!overlay || !overlay.classList.contains('open') || !guideTutorialTarget) return;

  const step = GUIDE_STEPS[guideTutorialStep];
  const rect = guideTutorialTarget.getBoundingClientRect();
  const pad = 10;
  const spot = document.getElementById('guide-tutorial-spotlight');
  const label = document.getElementById('guide-tutorial-label');
  const panel = document.getElementById('guide-tutorial-panel');

  spot.style.left = `${rect.left + rect.width / 2}px`;
  spot.style.top = `${rect.top + rect.height / 2}px`;
  spot.style.width = `${rect.width + pad * 2}px`;
  spot.style.height = `${rect.height + pad * 2}px`;

  label.textContent = step.label;
  label.style.left = `${guideClamp(rect.left + rect.width / 2, 72, window.innerWidth - 72)}px`;
  label.style.top = `${guideClamp(rect.top - 16, 22, window.innerHeight - 24)}px`;

  const panelWidth = Math.min(360, window.innerWidth - 28);
  const panelHeight = panel.offsetHeight || 170;
  const belowTop = rect.bottom + 18;
  const aboveTop = rect.top - panelHeight - 18;
  const top = belowTop + panelHeight < window.innerHeight - 12 ? belowTop : Math.max(12, aboveTop);
  const left = guideClamp(rect.left + rect.width / 2 - panelWidth / 2, 12, window.innerWidth - panelWidth - 12);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function renderGuideTutorialStep() {
  const overlay = document.getElementById('guide-tutorial-overlay');
  const line = document.getElementById('guide-tutorial-line');
  const progress = document.getElementById('guide-tutorial-progress');
  const nextBtn = document.getElementById('guide-tutorial-next');
  if (!overlay || !line || !progress) return;

  const step = GUIDE_STEPS[guideTutorialStep];
  const target = findGuideTarget(step);
  if (!target) return;

  clearGuideHighlight();
  guideTutorialTarget = target;
  guideTutorialTarget.classList.add('guide-tutorial-target');
  line.textContent = step.fairyLine;
  progress.innerHTML = GUIDE_STEPS.map((_, i) =>
    `<span class="guide-tutorial-dot${i === guideTutorialStep ? ' active' : ''}"></span>`
  ).join('');
  overlay.classList.toggle('is-last', guideTutorialStep === GUIDE_STEPS.length - 1);
  if (nextBtn) nextBtn.textContent = guideTutorialStep === GUIDE_STEPS.length - 1 ? '完了' : '次へ';

  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  setTimeout(positionGuideTutorial, 260);
}

function openGuideTutorial({ force = false } = {}) {
  if (!force && localStorage.getItem(GUIDE_TUTORIAL_KEY) === '1') return;
  const overlay = document.getElementById('guide-tutorial-overlay');
  if (!overlay) return;
  guideTutorialStep = 0;
  Overlay.open('guide-tutorial-overlay');
  renderGuideTutorialStep();
}

function closeGuideTutorial(markSeen = true) {
  const overlay = document.getElementById('guide-tutorial-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-last');
  Overlay.close('guide-tutorial-overlay');
  clearGuideHighlight();
  if (markSeen) localStorage.setItem(GUIDE_TUTORIAL_KEY, '1');
}

function nextGuideTutorialStep() {
  if (guideTutorialStep < GUIDE_STEPS.length - 1) {
    guideTutorialStep++;
    renderGuideTutorialStep();
  } else {
    closeGuideTutorial(true);
  }
}

function showGuideStartToast() {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = '🧚 いい一歩だったね。<br><span style="opacity:.85;font-weight:400">完璧じゃなくていいよ。今日の冒険は、もう始まってる。</span>';
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 3600);
}

function resetGuideTutorial() {
  localStorage.removeItem(GUIDE_TUTORIAL_KEY);
  openGuideTutorial({ force: true });
}
window.resetGuideTutorial = resetGuideTutorial;

function maybeStartGuideTutorial() {
  clearTimeout(guideTutorialRetry);
  if (localStorage.getItem(GUIDE_TUTORIAL_KEY) === '1') return;
  const summoned = localStorage.getItem('gq_summoned') === '1';
  const summonOpen = document.getElementById('summon-overlay')?.classList.contains('open');
  const guideOpen = document.getElementById('guide-tutorial-overlay')?.classList.contains('open');
  if (!summoned || summonOpen || guideOpen) {
    guideTutorialRetry = setTimeout(maybeStartGuideTutorial, 1200);
    return;
  }
  setTimeout(() => openGuideTutorial(), 700);
}

document.getElementById('guide-tutorial-next')?.addEventListener('click', nextGuideTutorialStep);
document.getElementById('guide-tutorial-close')?.addEventListener('click', () => closeGuideTutorial(true));
document.getElementById('guide-tutorial-later')?.addEventListener('click', () => closeGuideTutorial(true));
document.getElementById('show-guide-tutorial-btn')?.addEventListener('click', () => {
  Overlay.close('settings-overlay');
  setTimeout(resetGuideTutorial, 320);
});
window.addEventListener('resize', positionGuideTutorial);
window.addEventListener('scroll', positionGuideTutorial, true);
document.addEventListener('keydown', e => {
  const ov = document.getElementById('guide-tutorial-overlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); nextGuideTutorialStep(); }
});

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

// ── 実りの記録帳：妖精への答えを全部あつめる ─────────────
function collectFruitEntries() {
  const out = [];
  Object.entries(skillNotes).forEach(([key, arr]) => {
    const us = key.lastIndexOf('_');
    if (us < 0) return;
    const gid = key.slice(0, us);
    const idx = parseInt(key.slice(us + 1));
    const g = genres.find(x => x.id === gid);
    const t = SKILL_THRESHOLDS[idx];
    if (!g || !t) return;
    (arr || []).forEach(n => {
      if (!n || !n.text) return;
      const at = new Date(n.createdAt);
      if (isNaN(at)) return;
      out.push({ genre: g, stage: t, text: n.text, at });
    });
  });
  out.sort((a, b) => b.at - a.at);   // 新しい順
  return out;
}

function renderFruitJournal() {
  const el = document.getElementById('skill-journal');
  if (!el) return;
  const entries = collectFruitEntries();
  if (!entries.length) {
    el.innerHTML = `<div class="skj-empty">まだ実りがありません。<br>
      セッションのあと、🧚 妖精の問いに答えると<br>ここに「学びのことば」が集まっていきます。</div>`;
    return;
  }
  let html = `<div class="skj-count">🍎 これまでの実り：${entries.length}個のことば</div>`;
  let lastDay = '';
  entries.forEach(e => {
    const dayLabel = `${e.at.getFullYear()}年${e.at.getMonth() + 1}月${e.at.getDate()}日`;
    if (dayLabel !== lastDay) { html += `<div class="skj-day">${dayLabel}</div>`; lastDay = dayLabel; }
    html += `<div class="skj-item">
      <div class="skj-meta">${e.genre.emoji} ${escHtml(e.genre.name)}<span class="skj-stage">${e.stage.emoji} ${e.stage.name}</span></div>
      <div class="skj-text">${escHtml(e.text)}</div>
    </div>`;
  });
  el.innerHTML = html;
}

// ── タブ切り替え（🌳 世界樹 / 📖 実りの記録）─────────────
function switchSkillTab(tab) {
  const isTree = tab === 'tree';
  const tree    = document.getElementById('skill-svg-wrapper');
  const journal = document.getElementById('skill-journal');
  const detail  = document.getElementById('skill-detail');
  if (tree)    tree.style.display    = isTree ? '' : 'none';
  if (journal) journal.style.display = isTree ? 'none' : '';
  if (detail)  detail.classList.remove('visible');
  document.getElementById('sk-tab-tree')?.classList.toggle('active', isTree);
  document.getElementById('sk-tab-journal')?.classList.toggle('active', !isTree);
  if (!isTree) renderFruitJournal();
}
document.getElementById('sk-tab-tree')?.addEventListener('click', () => switchSkillTab('tree'));
document.getElementById('sk-tab-journal')?.addEventListener('click', () => switchSkillTab('journal'));

function openSkillModal() {
  Overlay.open('skill-overlay');
  document.getElementById('skill-detail').classList.remove('visible');
  switchSkillTab('tree');
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
  const PS = 5; // 1ドット = 5×5（グリッドサイズは rows から自動算出）
  const C = rows[0].length, RN = rows.length;
  const uid = 'pxa' + (++_avId);
  const rects = [];
  rows.forEach((row, ry) => {
    for (let cx = 0; cx < C; cx++) {
      const fill = pal[row[cx]];
      if (fill) rects.push(
        `<rect x="${cx*PS}" y="${ry*PS}" width="${PS}" height="${PS}" fill="${fill}"/>`
      );
    }
  });
  return `<svg viewBox="0 0 ${C*PS} ${RN*PS}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="image-rendering:pixelated;display:block"><g>
${rects.join('')}<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 1;0 0" keyTimes="0;.25;.5;.75;1" dur="2.4s" repeatCount="indefinite"/></g></svg>`;
}

// ── 双六コマ タイプA（茶髪ツンツン・青コート＋赤マント＋剣）──
function buildPixelAvatarSVG_0A(w, h) {
  const P = {
    o:'#5A3724',                              // 輪郭
    h:'#A9743F', H:'#CE9B62', d:'#8A5C30',   // 髪
    s:'#FFE3BC', S:'#F0C795',                 // 肌
    e:'#3A2B24', w:'#FFFFFF',                 // 瞳
    k:'#F7B2BC', m:'#D97777',                 // ほっぺ/口
    r:'#E66A6A', q:'#C24A4A',                 // 赤マント
    c:'#6B8CC9', L:'#8FA9DC', C:'#54719F',   // 青コート
    T:'#FAF6EC', g:'#FFD984',                 // 白シャツ/金トリム
    B:'#7B4F2C', p:'#5A6478', P:'#485263',   // ベルト・ブーツ/ズボン
    X:'#DCE6F2', x:'#AEBED4',                 // 剣の刃
  };
  const R = [
    '..........hh..hh..hh............',
    '........ohHhhHhhhhhhhhdo........',
    '.......ohHHhhhhhhhhhhhddo.......',
    '......ohHHhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhshhsshhsshhshhho......',
    '......ohssssssssssssssssho......',
    '......ohssseesssssseesssho......',
    '......ohsswweesssswweessho......',
    '......ohsswweesssswweessho......',
    '......ohsseeeesssseeeessho......',
    '......ohkkseesssssseeskkho......',
    '.......osssssssmmssssssso.......',
    '........ossssSSSSSSsssso........',
    '..........oooooooooooo..........',
    '............oqSssSqo............',
    '..........oLcgTTTTgcCorrqo......',
    '........oLcLcgTTTTgcCcCoqo......',
    '........oLcLcgTTTTgcCcCoqo......',
    '.....oBBoLcLcgTTTTgcCcCorqo.....',
    '.....oBBossLccccccccCSSorqo.....',
    '....ggggggsLccccccccCSSorqo.....',
    '.....oXxoooBBBBggBBBBooorrqo....',
    '.....oXxo.oBBBBggBBBBorrrrqo....',
    '.....oXxo.oLccccccccCorrrrqo....',
    '.....oXxo.occcccccccCorrrrrqo...',
    '.....oXxo.oooooooooooorrrrrqo...',
    '.....oXxo..oppPooppPo.rrrrrqo...',
    '.....oXxo..oppPooppPo.rrrrrrqo..',
    '.....oXxo..oppPooppPo.ooooo.....',
    '.....oXxo..oBBBooBBBo...........',
    '.....oXxo..oBBBooBBBo...........',
    '......oo..oBBBBooBBBBo..........',
    '..........oooooooooooo..........',
    '................................',
    '................................',
  ];
  return _buildPixelSprite(R, P, w, h);
}

// ── 双六コマ タイプB（ピンクのポニテ＋緑コート＋金の杖）────
function buildPixelAvatarSVG_0B(w, h) {
  const P = {
    o:'#5A3724',
    h:'#F2A8A2', H:'#F9C9C2', d:'#DB8A84',   // ピンクの髪
    s:'#FFE3BC', S:'#F0C795',
    e:'#3A2B24', w:'#FFFFFF',
    k:'#F7B2BC', m:'#D97777',
    v:'#76B284', V:'#578F65',                 // 緑リボン
    c:'#85B98F', L:'#A6D0AC', C:'#699873',   // 緑コート
    t:'#F7F0DC', T:'#FFFBF0', u:'#E3D6B8',   // 白ワンピース
    g:'#FFD984', B:'#7B4F2C',                 // 金/ベルト・ブーツ
    E:'#8AE8A4', F:'#C8F7D2', D:'#5FBF78',   // 杖の緑宝石
    a:'#A9853C',                              // 杖の柄（金の影）
  };
  const R = [
    '................................',
    '............oooooooovvovv.......',
    '..........ohHHhhhhhhhvVv........',
    '.........ohHHhhhhhhhhvovohhdo...',
    '........ohHHhhhhhhhhhhdoohhdo...',
    '.......ohHHhhhhhhhhhhhddohhdo...',
    '.......ohHhhhhhhhhhhhhddohhdo...',
    '......ohhhhhhhhhhhhhhhhddohhdo..',
    '......ohhhhhhhhhhhhhhhhhdohhdo..',
    '......FEhhshhsshhsshhshhhoohdo..',
    '....oFEEDssssssssssssssshoohdo..',
    '....oEEEDsseesssssseesssho.ohdo.',
    '....ohEDsswweesssswweessho.ohdo.',
    '....ogaggswweesssswweesshoohdo..',
    '....ohgasseeeesssseeeesshoohdo..',
    '....ohgakkseesssssseeskkhohdo...',
    '....odgasssssssmmsssssssoohdo...',
    '.....ogaossssSSSSSSssssoohdo....',
    '......ga..oooooooooooo..ohdo....',
    '......ga.....oSssSo.....odo.....',
    '......ga..oLcttttttcCo...oo.....',
    '......gaoLcLcttggttcCcCo........',
    '......gaoLcLcttttttcCcCo........',
    '......gaoLcLcttttttcCcCo........',
    '......gaossLcttttttcCSSo........',
    '......gaossLcttttttcCSSo........',
    '......gaoooBBBBggBBBBooo........',
    '......ga..otttttttttoBBo........',
    '......ga.ottttttttttoBgo........',
    '......gaotttttttttttttto........',
    '......gaouuuuuuuuuuuuuuo........',
    '......gaoooooooooooooooo........',
    '......ga....oso..oso............',
    '......ga....oso..oso............',
    '......oo...oBBo.oBBo............',
    '...........oBBo.oBBo............',
    '...........oBBo.oBBo............',
    '..........ooooo.ooooo...........',
    '................................',
    '................................',
  ];
  return _buildPixelSprite(R, P, w, h);
}

// ── 双六コマ タイプC（水色ボブ＋丸メガネ＋紫ローブ＋本）────
function buildPixelAvatarSVG_0C(w, h) {
  const P = {
    o:'#4A3D55',                              // 輪郭（紫がかった焦げ茶）
    h:'#9ED4CF', H:'#C7EAE6', d:'#7AB5AF',   // 水色ボブ
    s:'#FFE3BC', S:'#F0C795',
    e:'#3A2B24', w:'#FFFFFF',
    k:'#F7B2BC', m:'#D97777',
    c:'#8E7BB0', L:'#AC9BC9', C:'#73619A',   // 紫ローブ
    T:'#FBF6EA', N:'#6FC9B8',                 // 白シャツ/ティールの飾り
    g:'#E8BE5C',                              // 金（メガネ・イヤリング）
    G:'#5FA86B', i:'#F7F0DC',                 // 本の表紙/ページ
    B:'#8A6244', W:'#FFFFFF',                 // 鞄・靴/ソックス
    p:'#5E6F94', P:'#4D5C7E',                 // ふくらみパンツ
  };
  const R = [
    '...............hhh..............',
    '............oooooooo............',
    '..........ohHHhhhhhhho..........',
    '.........ohHHhhhhhhhhdo.........',
    '........ohHHhhhhhhhhhhdo........',
    '.......ohHHhhhhhhhhhhhddo.......',
    '.......ohHhhhhhhhhhhhhddo.......',
    '......ohhhhhhhhhhhhhhhhddo......',
    '......ohhhhhhhhhhhhhhhhhdo......',
    '......ohhhhhshhhhhhshhhhho......',
    '......ohhggggggssgggggghho......',
    '......ohhgseesgssgseesghho......',
    '......ohhgwweeggggwweeghho......',
    '......ohhgwweegssgwweeghho......',
    '......ohhgeeeegssgeeeeghho......',
    '.....gohhsggggssssggggshhog.....',
    '.......ohdkksssmmssskkdho.......',
    '........ossssSSSSSSsssso........',
    '..........oooooooooooo..........',
    '.............oSssSo.............',
    '..........oLcTTTTTBcCo..........',
    '........oLcLcTTNNBTcCcCo........',
    '........oLcLcTTTBTTcCcCo........',
    '........oLcLccccccccCcCo........',
    '........osoGiiiGGiiiGoSo........',
    '........osoGiiiGGiiiGoSo........',
    '........oooGiiiGGiiiGooo........',
    '..........oGGGGGGGGGGo..........',
    '..........oLccccccccCo..........',
    '..........occcccccccCo..........',
    '..........oooooooooooo..........',
    '..........opppPoopppPo..........',
    '..........opppPoopppPo..........',
    '...........oWWo..oWWo...........',
    '...........oWWo..oWWo...........',
    '...........oBBo..oBBo...........',
    '...........oBBo..oBBo...........',
    '..........ooooo..ooooo..........',
    '................................',
    '................................',
  ];
  return _buildPixelSprite(R, P, w, h);
}

// 双六のコマ用：選択中のアバタータイプのドット絵を返す
function buildKomaSVG(w, h) {
  if (avatarType === 'B') return buildPixelAvatarSVG_0B(w, h);
  if (avatarType === 'C') return buildPixelAvatarSVG_0C(w, h);
  return buildPixelAvatarSVG_0A(w, h);
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

  return `<svg viewBox="0 0 ${C*PS} ${RN*PS}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">${parts.join('')}</svg>`;
}

// ── アバター詳細: 画像ファイルで表示（fallback: ドット絵）──────
// お供オトモン表示: base 画像に対する % 指定
//   scale = オーバーレイの幅（高さは aspect-ratio 1:1 で同値）
//   cx/cy = オーバーレイ中心の位置（base 内座標, 0..100%）
const AVATAR_OTOMON_LAYOUT = { scale: 40, cx: 22, cy: 88 };

function buildRichAvatarSVG_0(type) {
  const srcs = {
    A:'assets/avatar/adventurer-a-fixed.png',
    B:'assets/avatar/adventurer-b-fixed-v3.png',
    C:'assets/avatar/adventurer-c-fixed.png'
  };
  const src = srcs[type] || srcs.A;
  const fallback = buildAvatarSVG(0, 160, 200);
  // アバター本体は「崩れない美しい1枚絵」のまま。
  // お供オトモンだけを隣に表示し、旧ペット装備は表示しない。
  const equipped = (typeof getEquippedItems === 'function') ? getEquippedItems() : {};
  const otomonLay = (typeof AVATAR_OTOMON_LAYOUT !== 'undefined') ? AVATAR_OTOMON_LAYOUT : null;
  let otomonSrc = null;
  const activeOto = (window.Otomon && window.Otomon.getActiveOtomon) ? window.Otomon.getActiveOtomon() : null;
  if (activeOto && activeOto.image) {
    otomonSrc = activeOto.image.medium || activeOto.image.small || activeOto.image.large;
  }
  const otomonOverlay = (otomonSrc && otomonLay)
    ? `<img src="${otomonSrc}" alt="" class="av-equip-overlay av-otomon-layer"
         style="width:${otomonLay.scale}%;left:${otomonLay.cx}%;top:${otomonLay.cy}%"
         onerror="this.style.display='none'">`
    : '';
  const auraRarity = bestEquippedRarity(equipped);
  const auraClass  = auraRarity ? ` av-aura-${auraRarity}` : '';
  return `<div class="av-char-img-wrap${auraClass}">
    <div class="av-char-canvas">
      <img src="${src}" alt="" class="av-char-img"
        onerror="this.parentElement.style.display='none';this.parentElement.parentElement.querySelector('.av-char-fallback').style.display='flex'">
      ${otomonOverlay}
    </div>
    <div class="av-char-fallback" style="display:none">${fallback}</div>
  </div>`;
}

// 装備中アイテムの中で最も高いレア度を返す（無ければ null）
function bestEquippedRarity(equipped) {
  const rank = { common:1, rare:2, epic:3, legendary:4 };
  let best = null, bestN = 0;
  EQUIPMENT_CATEGORIES.forEach(cat => {
    const it = equipped[cat];
    if (it && rank[it.rarity] > bestN) { bestN = rank[it.rarity]; best = it.rarity; }
  });
  return best;
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
  Overlay.open('avatar-overlay');
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
      const comp = companionTimeText(item.id);
      return `<div class="av-eq-row">
        <div class="av-eq-cat">${CATEGORY_LABEL[cat]}</div>
        <div class="av-eq-icon">${renderItemIcon(item, 22)}</div>
        <div class="av-eq-info">
          <div class="av-eq-name">${item.name}${isBondedItem(item.id) ? ' <span class="eq-bond">✨</span>' : ''}
            <span class="eq-rarity-tag eq-rarity-${item.rarity}">${RARITY_LABELS[item.rarity]}</span>
          </div>
          <div class="av-eq-effect">${item.effect.desc}</div>
          ${comp ? `<div class="av-eq-mem">⏳ ${comp}</div>` : ''}
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
  Overlay.close('avatar-overlay'));
document.getElementById('avatar-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('avatar-overlay'))
    Overlay.close('avatar-overlay');
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
function handleBoardClose() {
  // 双六を閉じたら、保留していた妖精（褒めログ）を出す
  if (_pendingPraisePrompt) {
    _pendingPraisePrompt = false;
    setTimeout(() => openFairyModal(_praiseSessionGenre, _praiseSessionDate), 420);
  }
}
function closeBoardModal() {
  Overlay.close('board-overlay');
}
document.getElementById('board-close-btn').addEventListener('click', closeBoardModal);
document.getElementById('board-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('board-overlay')) closeBoardModal();
});
document.getElementById('board-map-toggle').addEventListener('click', toggleBoardMap);

// ═══════════════════════════════════════════════════════
//  SKILL TREE — EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.getElementById('skill-btn').addEventListener('click', openSkillModal);
document.getElementById('skill-close-btn').addEventListener('click', () => {
  Overlay.close('skill-overlay');
});
document.getElementById('skill-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('skill-overlay'))
    Overlay.close('skill-overlay');
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
setHeaderMotivation();
renderStats();
renderGenreSelector();
renderCalendar();
renderDailyQuote();
checkBadges();
checkAvatarEvolution();
checkSkillUnlocks();
checkWeeklyReviewTrigger();

// ═══════════════════════════════════════════════════════
//  段階解放（プログレッシブ・ディスクロージャ）
//  使う理由ができたら、その機能ボタンが現れる
// ═══════════════════════════════════════════════════════
function loadUnlocks() { try { return new Set(JSON.parse(localStorage.getItem('gq_unlocks') || '[]')); } catch { return new Set(); } }
function saveUnlocks() { localStorage.setItem('gq_unlocks', JSON.stringify([...featUnlocks])); }
let featUnlocks = loadUnlocks();

const UNLOCK_DEFS = [
  { key:'guild',     emoji:'🏰', label:'冒険者ギルド',    cond:() => (data.sessions||0) >= 1 },
  { key:'board',     emoji:'🎲', label:'すごろく',        cond:() => (data.sessions||0) >= 1 },
  { key:'badges',    emoji:'🏅', label:'バッジ',          cond:() => Object.keys(earnedBadges||{}).length >= 1 },
  { key:'equipment', emoji:'🎒', label:'装備',            cond:() => (typeof inventory!=='undefined' && inventory.length >= 1) },
  { key:'skill',     emoji:'🌳', label:'スキルツリー',    cond:() => (typeof skillData!=='undefined' && Object.keys(skillData).length >= 1) },
  { key:'timelog',   emoji:'⏱',  label:'1日のタイムログ', cond:() => Object.keys(data.history||{}).filter(k=>data.history[k]>0).length >= 2 },
  { key:'review',    emoji:'📊', label:'週次レビュー',    cond:() => (data.sessions||0) >= 4 },
];

function applyFeatureVisibility() {
  UNLOCK_DEFS.forEach(def => {
    const btn = document.querySelector(`[data-unlock="${def.key}"]`);
    if (btn && featUnlocks.has(def.key)) btn.classList.remove('feat-locked');
  });
}

function evaluateUnlocks(silent) {
  const newly = [];
  UNLOCK_DEFS.forEach(def => {
    if (!featUnlocks.has(def.key) && def.cond()) {
      featUnlocks.add(def.key);
      newly.push(def);
    }
  });
  if (newly.length) saveUnlocks();
  applyFeatureVisibility();
  // タイムログ解放と同時にホームの打刻カードも出す
  //（起動直後は打刻システムの初期化前なので try で守る。起動時の描画は別途実行される）
  try { if (typeof renderPunchBar === 'function') renderPunchBar(); } catch (e) {}
  if (!silent && newly.length) {
    // 解放ボタンを光らせ、アンロック通知を順番に出す
    newly.forEach((def, i) => setTimeout(() => {
      const btn = document.querySelector(`[data-unlock="${def.key}"]`);
      if (btn) { btn.classList.add('feat-unlocked-glow'); setTimeout(() => btn.classList.remove('feat-unlocked-glow'), 2600); }
      showUnlockToast(def);
    }, i * 1600));
  }
}

function showUnlockToast(def) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🔓 新機能アンロック！<br><span style="opacity:.9;font-weight:700">${def.emoji} ${def.label}</span>`;
  t.classList.remove('levelup'); t.classList.add('multiline');
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.remove('multiline'), 400); }, 3000);
}

// 初回適用（既存ユーザーは現データで即解放、新規は最小構成から）
evaluateUnlocks(true);

// ═══════════════════════════════════════════════════════
//  はじめの一歩（オンボーディング・ガイド）
// ═══════════════════════════════════════════════════════
function renderOnboarding() {
  const card = document.getElementById('onboard-card');
  if (!card) return;
  // 完了済み、または既にベテラン（3セッション以上）なら出さない
  if (localStorage.getItem('gq_onboard_done') === '1' || (data.sessions||0) >= 3) {
    card.style.display = 'none';
    document.getElementById('start-btn')?.classList.remove('first-glow');
    return;
  }
  const steps = [
    { label:'タイマーをSTARTして、5分だけ集中してみる', done: (data.sessions||0) >= 1 },
    { label:'世界樹の妖精のひとことに答える',            done: (typeof skillData!=='undefined' && Object.keys(skillData).length >= 1) },
    { label:'もう一度やってみる（2回目の集中）',          done: (data.sessions||0) >= 2 },
  ];
  const allDone = steps.every(s => s.done);
  card.style.display = '';
  document.getElementById('onboard-steps').innerHTML = steps.map(s =>
    `<div class="onboard-step ${s.done?'done':''}"><span class="onboard-check">${s.done?'✓':'○'}</span>${s.label}</div>`
  ).join('');

  // 初回はSTARTボタンを“ぽわん”と光らせる（最初のセッション前だけ）
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.classList.toggle('first-glow', (data.sessions||0) < 1);

  if (allDone) {
    document.getElementById('onboard-sub').textContent = '準備完了！ あとは、あなたのペースで🌱';
    localStorage.setItem('gq_onboard_done', '1');
    startBtn?.classList.remove('first-glow');
    setTimeout(() => { card.style.display = 'none'; }, 4000); // 祝ってから静かに消える
  }
}
renderOnboarding();
maybeStartGuideTutorial();

// 起動時：装備中の mood（タイマーまわりの雰囲気）を反映
applyEquipMood();

// 日次レビューのタイムマップにホバー/タップのツールチップ（委譲）
(function(){
  const body = document.getElementById('review-body');
  if (!body) return;
  let _dlTimer = null;
  const showTip = e => {
    const info = e.target && e.target.getAttribute && e.target.getAttribute('data-info');
    const wrap = e.target.closest && e.target.closest('.rv-daylog-wrap');
    const tip = wrap && wrap.querySelector('.rv-dl-tip');
    if (!tip) return;
    if (info) {
      tip.textContent = info; tip.hidden = false;
      const rect = wrap.getBoundingClientRect();
      tip.style.left = Math.min(Math.max(e.clientX - rect.left, 50), rect.width - 50) + 'px';
      clearTimeout(_dlTimer);
      if (e.type === 'pointerdown') _dlTimer = setTimeout(() => { tip.hidden = true; }, 2500);
    } else { tip.hidden = true; }
  };
  body.addEventListener('pointermove', showTip);
  body.addEventListener('pointerdown', showTip);
  body.addEventListener('pointerleave', () => body.querySelectorAll('.rv-dl-tip').forEach(t => t.hidden = true));
})();

// ═══════════════════════════════════════════════════════
//  1日のタイムログ（可処分時間の可視化）
// ═══════════════════════════════════════════════════════
const TIMELOG_CATS = [
  { id:'sleep',    name:'睡眠',      emoji:'😴', color:'#6366f1', type:'fixed' },
  { id:'work',     name:'仕事/学校', emoji:'💼', color:'#94a3b8', type:'fixed' },
  { id:'meal',     name:'食事',      emoji:'🍴', color:'#f59e0b', type:'fixed' },
  { id:'commute',  name:'移動',      emoji:'🚃', color:'#a78bfa', type:'fixed' },
  { id:'chore',    name:'生活/雑事', emoji:'🧺', color:'#64748b', type:'fixed' },
  { id:'study',    name:'学習',      emoji:'📖', color:'#06b6d4', type:'free' },
  { id:'exercise', name:'運動',      emoji:'🏃', color:'#4ade80', type:'free' },
  { id:'hobby',    name:'趣味/娯楽', emoji:'🎮', color:'#f472b6', type:'free' },
  { id:'rest',     name:'休憩',      emoji:'☕', color:'#fbbf24', type:'free' },
  { id:'other',    name:'その他',    emoji:'⭐', color:'#9ca3af', type:'free' },
];
const _tlCat = id => TIMELOG_CATS.find(c => c.id === id) || TIMELOG_CATS[TIMELOG_CATS.length-1];
let tlAnchor = new Date();
let _tlEditIdx = null;   // 編集中のブロック（ソート済みindex）／null=新規追加

function loadDayLog() { try { return JSON.parse(localStorage.getItem('gq_day_log') || '{}'); } catch { return {}; } }
function saveDayLog() { localStorage.setItem('gq_day_log', JSON.stringify(dayLog)); }
let dayLog = loadDayLog();

// ポモドーロ等のセッション完了時に、学習ブロックをタイムログへ自動追加する
function autoLogStudyBlock(mins) {
  if (!mins || mins <= 0) return;
  const now = new Date();
  const endMin = now.getHours()*60 + now.getMinutes();
  const startMin = Math.max(0, endMin - Math.round(mins));
  const f = m => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const dk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if (!dayLog[dk]) dayLog[dk] = [];

  // 打刻中のブロックがあれば、学習開始の時点で自動的に締める
  try { if (typeof closePunchAt === 'function') closePunchAt(startMin); } catch (e) {}

  // 直前の記録の終了時刻を探し、そこから今回の開始までを「休憩」で自動補完
  // （長すぎる空きは休憩扱いしない＝60分以内のみ）
  let prevEnd = null;
  dayLog[dk].forEach(b => {
    const e = _tlToMin(b.end);
    if (e <= startMin && (prevEnd == null || e > prevEnd)) prevEnd = e;
  });
  if (prevEnd != null) {
    const gap = startMin - prevEnd;
    if (gap > 0 && gap <= 60) {
      dayLog[dk].push({ cat:'rest', start: f(prevEnd), end: f(startMin), auto:true });
    }
  }

  dayLog[dk].push({ cat:'study', start: f(startMin), end: f(endMin), auto:true });
  saveDayLog();
  // タイムログを開いていれば即反映
  if ((document.getElementById('review-overlay')?.classList.contains('open') && rvPeriod === 'day')) renderTimelog();
}

const _tlToMin = hhmm => { const [h,m] = (hhmm||'0:0').split(':').map(Number); return h*60 + m; };
const _tlDur   = (s,e) => { const a=_tlToMin(s), b=_tlToMin(e); return b>a ? b-a : (1440-a)+b; }; // 日跨ぎ対応
const _tlFmtH  = min => `${(min/60).toFixed(1)}h`;

function _tlBlocks() {
  const key = _ltDateKey(tlAnchor);
  return (dayLog[key] || []).slice().sort((a,b) => _tlToMin(a.start) - _tlToMin(b.start));
}

// ── ドラム（時・分セレクト）ヘルパ ──────────────────────
function _tlPopulateDrums() {
  const hOpts = Array.from({length:24}, (_,h) => `<option value="${h}">${String(h).padStart(2,'0')}</option>`).join('');
  const mOpts = Array.from({length:12}, (_,k) => { const m=k*5; return `<option value="${m}">${String(m).padStart(2,'0')}</option>`; }).join('');
  ['tl-sh','tl-eh'].forEach(id => { const e=document.getElementById(id); if (e) e.innerHTML = hOpts; });
  ['tl-sm','tl-em'].forEach(id => { const e=document.getElementById(id); if (e) e.innerHTML = mOpts; });
}
function _tlGetTime(hId, mId) {
  const h = +document.getElementById(hId).value || 0;
  const m = +document.getElementById(mId).value || 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function _tlSetTime(hId, mId, hhmm) {
  const [h, m] = (hhmm||'0:0').split(':').map(Number);
  let mm = Math.round(m/5)*5; if (mm >= 60) mm = 55;
  document.getElementById(hId).value = h;
  document.getElementById(mId).value = mm;
}

function renderTimelogPalette() {
  const pal = document.getElementById('tl-palette');
  if (!pal) return;
  pal.innerHTML = TIMELOG_CATS.map(c =>
    `<button class="tl-pal-chip" draggable="true" data-cat="${c.id}" style="border-color:${c.color}88">
      ${c.emoji}${c.name}</button>`).join('');
  pal.querySelectorAll('.tl-pal-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/cat', chip.dataset.cat); e.dataTransfer.effectAllowed='copy'; });
    // タップでもフォームのカテゴリにセット（ドラッグできない環境のフォールバック）
    chip.addEventListener('click', () => { document.getElementById('tl-cat').value = chip.dataset.cat; });
  });
}

function openTimelogModal(forDate) {
  rvPeriod = 'day';
  rvAnchor = forDate ? new Date(forDate + 'T00:00:00') : new Date();
  _tlEditIdx = null;
  // レビューモーダルを日タブで開く（未開なら初期化してから）
  if (!document.getElementById('review-overlay').classList.contains('open')) {
    rvWeekKey = getWeekKey(new Date());
    document.getElementById('review-week-label').textContent = '';
  }
  renderReviewFooter(false);
  renderReviewBody();
  Overlay.open('review-overlay');
}

function renderTimelog() {
  const W = 320, H = 44;
  const blocks = _tlBlocks();
  // 期間バーのラベルに日付を反映
  const rvLbl = document.querySelector('.rv-period-label');
  if (rvLbl) rvLbl.textContent = `${tlAnchor.getMonth()+1}月${tlAnchor.getDate()}日（${DOW_LABELS[dowIndex(tlAnchor)]}）`;

  // タイムライン（24時間バー）
  let rects = `<rect x="0" y="0" width="${W}" height="${H-16}" rx="5" fill="rgba(255,255,255,.05)"/>`;
  blocks.forEach(b => {
    const c = _tlCat(b.cat);
    const s = _tlToMin(b.start), e = _tlToMin(b.end);
    const segs = e > s ? [[s,e]] : [[s,1440],[0,e]];
    const info = `${c.emoji} ${c.name}  ${b.start}〜${b.end}（${_tlFmtH(_tlDur(b.start,b.end))}）`;
    segs.forEach(([a,z]) => {
      rects += `<rect class="tl-seg" data-info="${info}" x="${(a/1440*W).toFixed(1)}" y="0" width="${Math.max((z-a)/1440*W,1).toFixed(1)}" height="${H-16}" fill="${c.color}"/>`;
    });
  });
  const ticks = [0,6,12,18,24].map(h =>
    `<text x="${Math.min(h/24*W, W-2).toFixed(1)}" y="${H-3}" fill="rgba(255,255,255,.45)" font-size="8" text-anchor="${h===0?'start':h===24?'end':'middle'}">${h}時</text>`).join('');
  document.getElementById('tl-timeline').innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" class="rv-chart-svg" style="margin:6px 0 2px">${rects}${ticks}</svg>`
    + `<div class="tl-tip" id="tl-tip" hidden></div>`;

  // 集計
  let fixed = 0, freeUsed = 0;
  const byCat = {};
  blocks.forEach(b => {
    const c = _tlCat(b.cat); const d = _tlDur(b.start, b.end);
    byCat[c.id] = (byCat[c.id]||0) + d;
    if (c.type === 'fixed') fixed += d; else freeUsed += d;
  });
  const disposable = Math.max(0, 1440 - fixed);
  const unlogged   = Math.max(0, disposable - freeUsed);

  const freeBreak = TIMELOG_CATS.filter(c => c.type==='free' && byCat[c.id])
    .map(c => `<span class="tl-chip" style="border-color:${c.color}66">${c.emoji}${c.name} ${_tlFmtH(byCat[c.id])}</span>`).join('')
    + (unlogged>0 ? `<span class="tl-chip tl-chip-empty">⬜未記録 ${_tlFmtH(unlogged)}</span>` : '');

  // 未記録（どの時間帯が空いているか）を算出
  const covered = new Array(1440).fill(false);
  blocks.forEach(b => {
    const s = _tlToMin(b.start), e = _tlToMin(b.end);
    const segs = e > s ? [[s,e]] : [[s,1440],[0,e]];
    segs.forEach(([a,z]) => { for (let i=a; i<z; i++) covered[i] = true; });
  });
  const gaps = []; let gi = 0;
  while (gi < 1440) {
    if (!covered[gi]) { let j = gi; while (j < 1440 && !covered[j]) j++; gaps.push([gi, j]); gi = j; }
    else gi++;
  }
  const _f = m => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const gapsHtml = blocks.length === 0
    ? `<span class="tl-chip tl-chip-empty">まだ何も記録がありません。1日を記録してみよう</span>`
    : (gaps.length
        ? gaps.map(([a,z]) => `<button class="tl-gap" data-s="${_f(a)}" data-e="${z>=1440?'23:59':_f(z)}">⬜ ${_f(a)}〜${z>=1440?'24:00':_f(z)}（${_tlFmtH(z-a)}）</button>`).join('')
        : `<span class="tl-chip" style="border-color:#4ade8066">✨ すべての時間を記録しました！</span>`);

  document.getElementById('tl-summary').innerHTML = `
    <div class="tl-sum-row">
      <div class="tl-sum-box tl-fixed"><div class="tl-sum-val">${_tlFmtH(fixed)}</div><div class="tl-sum-lbl">拘束時間</div></div>
      <div class="tl-sum-box tl-free"><div class="tl-sum-val">${_tlFmtH(disposable)}</div><div class="tl-sum-lbl">可処分時間</div></div>
    </div>
    <div class="tl-break-label">可処分時間の使い方</div>
    <div class="tl-break">${freeBreak || '<span class="tl-chip tl-chip-empty">まだ記録がありません</span>'}</div>
    <div class="tl-break-label">⬜ 未記録の時間帯（タップすると妖精が推測してくれる）</div>
    <div class="tl-break" id="tl-gaps">${gapsHtml}</div>
    ${blocks.length && gaps.length ? `<button class="tl-wiz-btn" id="tl-wiz-btn">🌙 1分まとめ ── 空白をサクッと埋める</button>` : ''}`;

  // ギャップをタップ → 妖精の推測サジェスト（フォームにも時刻をプリセット）
  document.getElementById('tl-gaps').querySelectorAll('.tl-gap').forEach(btn => {
    btn.addEventListener('click', () => {
      _tlSetTime('tl-sh','tl-sm', btn.dataset.s);
      _tlSetTime('tl-eh','tl-em', btn.dataset.e);
      showGapSuggest(_tlToMin(btn.dataset.s), btn.dataset.e === '23:59' ? 1440 : _tlToMin(btn.dataset.e));
    });
  });
  document.getElementById('tl-wiz-btn')?.addEventListener('click', startGapWizard);
  if (typeof renderPunchBar === 'function') renderPunchBar();

  // その日の学習インサイト＋実り（旧レビュー「日」モードから統合）
  const insEl = document.getElementById('tl-day-insights');
  if (insEl) {
    let ins = '';
    try {
      const an1 = (typeof analyzeDays === 'function') ? analyzeDays([new Date(tlAnchor)]) : null;
      const hm = an1 && an1.days[0] && an1.days[0].det ? an1.days[0].det.hourMins : null;
      if (hm && Object.keys(hm).length) {
        const ent = Object.entries(hm).map(([h, m]) => [parseInt(h), m]).filter(([, m]) => m > 0).sort((a, b) => a[0] - b[0]);
        if (ent.length) {
          const peak = ent.reduce((b, e) => e[1] > b[1] ? e : b, ent[0]);
          const slotName = h => (h >= 5 && h < 11) ? '朝' : (h >= 11 && h < 17) ? '昼' : (h >= 17 && h < 22) ? '夕方' : '夜';
          ins += `<div class="tl-break-label">🎯 この日の学習</div>
            <div class="tl-ins-row">最も集中した時間帯 <b>${peak[0]}時台（${slotName(peak[0])}）・${peak[1]}分</b>
              ／ 学習の幅 <b>${ent[0][0]}時〜${ent[ent.length - 1][0] + 1}時</b></div>`;
        }
      }
    } catch (e) {}
    try {
      if (typeof buildFruitsSectionHTML === 'function') {
        const fr = buildFruitsSectionHTML([new Date(tlAnchor)]);
        if (fr) ins += fr.replace('🍎 この期間の実り（学びのことば）', '🍎 この日の実り（学びのことば）');
      }
    } catch (e) {}
    insEl.innerHTML = ins;
  }

  // 一覧
  const list = document.getElementById('tl-list');
  list.innerHTML = blocks.length
    ? blocks.map((b,i) => { const c=_tlCat(b.cat);
        return `<div class="tl-row${_tlEditIdx===i?' editing':''}">
          <span class="tl-row-dot" style="background:${c.color}"></span>
          <span class="tl-row-cat">${c.emoji} ${c.name}${b.auto?'<span class="tl-auto">自動</span>':''}</span>
          <span class="tl-row-time">${b.start}〜${b.end}（${_tlFmtH(_tlDur(b.start,b.end))}）</span>
          <button class="tl-row-edit" data-idx="${i}">✎</button>
          <button class="tl-row-del" data-idx="${i}">×</button>
        </div>`; }).join('')
    : '';
  list.querySelectorAll('.tl-row-edit').forEach(btn =>
    btn.addEventListener('click', () => startEditBlock(parseInt(btn.dataset.idx))));
  list.querySelectorAll('.tl-row-del').forEach(btn =>
    btn.addEventListener('click', () => deleteTimelogBlock(parseInt(btn.dataset.idx))));

  renderTemplates();
}

// 既存ブロックを編集フォームに読み込む
function startEditBlock(i) {
  const b = _tlBlocks()[i];
  if (!b) return;
  _tlEditIdx = i;
  document.getElementById('tl-cat').value = b.cat;
  _tlSetTime('tl-sh','tl-sm', b.start);
  _tlSetTime('tl-eh','tl-em', b.end);
  document.getElementById('tl-add-btn').textContent = '更新';
  renderTimelog();
}

// ── テンプレート ──────────────────────────────────────
function loadDayTemplates() { try { return JSON.parse(localStorage.getItem('gq_day_templates') || '[]'); } catch { return []; } }
function saveDayTemplates() { localStorage.setItem('gq_day_templates', JSON.stringify(dayTemplates)); }
let dayTemplates = loadDayTemplates();

function renderTemplates() {
  const wrap = document.getElementById('tl-tpl-chips');
  if (!wrap) return;
  wrap.innerHTML = dayTemplates.length
    ? dayTemplates.map((t,i) => `<span class="tl-tpl-chip">
        <button class="tl-tpl-apply" data-i="${i}">${escHtml(t.name)}</button>
        <button class="tl-tpl-del" data-i="${i}" title="削除">×</button></span>`).join('')
    : `<span class="tl-chip tl-chip-empty">保存済みなし</span>`;
  wrap.querySelectorAll('.tl-tpl-apply').forEach(b => b.addEventListener('click', () => applyTemplate(parseInt(b.dataset.i))));
  wrap.querySelectorAll('.tl-tpl-del').forEach(b => b.addEventListener('click', () => {
    if (confirm(`テンプレ「${dayTemplates[b.dataset.i]?.name}」を削除しますか？`)) {
      dayTemplates.splice(parseInt(b.dataset.i), 1); saveDayTemplates(); renderTemplates();
    }
  }));
}

function saveCurrentAsTemplate() {
  const blocks = _tlBlocks();
  if (!blocks.length) { alert('この日にはまだ記録がありません'); return; }
  const name = prompt('テンプレ名を入力（例：平日／休日）', '平日');
  if (!name || !name.trim()) return;
  dayTemplates.push({ name: name.trim(), blocks: blocks.map(b => ({ cat:b.cat, start:b.start, end:b.end })) });
  saveDayTemplates();
  renderTemplates();
}

function applyTemplate(i) {
  const t = dayTemplates[i]; if (!t) return;
  const key = _ltDateKey(tlAnchor);
  if ((dayLog[key]||[]).length && !confirm(`「${t.name}」を適用します。\nこの日の今の記録は置き換わります。`)) return;
  dayLog[key] = t.blocks.map(b => ({ ...b }));
  saveDayLog();
  _tlEditIdx = null;
  document.getElementById('tl-add-btn').textContent = '追加';
  renderTimelog();
}

function addTimelogBlock() {
  const cat = document.getElementById('tl-cat').value;
  const start = _tlGetTime('tl-sh','tl-sm');
  const end   = _tlGetTime('tl-eh','tl-em');
  if (start === end) { alert('開始と終了が同じ時刻です'); return; }
  const key = _ltDateKey(tlAnchor);
  if (!dayLog[key]) dayLog[key] = [];
  if (_tlEditIdx != null) {
    // 編集モード：該当ブロックを更新
    const sorted = _tlBlocks();
    const target = sorted[_tlEditIdx];
    const ri = target ? dayLog[key].findIndex(x => x === target ||
      (x.cat===target.cat && x.start===target.start && x.end===target.end)) : -1;
    if (ri >= 0) dayLog[key][ri] = { cat, start, end };
    else dayLog[key].push({ cat, start, end });
    _tlEditIdx = null;
    document.getElementById('tl-add-btn').textContent = '追加';
  } else {
    dayLog[key].push({ cat, start, end });
  }
  saveDayLog();
  renderTimelog();
}

function deleteTimelogBlock(idx) {
  const key = _ltDateKey(tlAnchor);
  const blocks = _tlBlocks();       // ソート済み
  const target = blocks[idx];
  if (!target || !dayLog[key]) return;
  const realIdx = dayLog[key].findIndex(b => b === target ||
    (b.cat===target.cat && b.start===target.start && b.end===target.end));
  if (realIdx >= 0) { dayLog[key].splice(realIdx, 1); saveDayLog(); renderTimelog(); }
}


// レビューの日別バーをタップ → その日のタイムログへ（委譲）
document.getElementById('review-body')?.addEventListener('click', e => {
  const bar = e.target.closest && e.target.closest('.rv-day-bar');
  if (!bar || !bar.dataset.dk) return;
  Overlay.close('review-overlay');
  openTimelogModal(bar.dataset.dk);
});
document.getElementById('tl-add-btn')?.addEventListener('click', addTimelogBlock);
document.getElementById('tl-tpl-save')?.addEventListener('click', saveCurrentAsTemplate);
// タイムバー：ホバー/タップ ツールチップ ＋ ドラッグで時間調整 ＋ D&D追加
(function(){
  const tl = document.getElementById('tl-timeline');
  if (!tl) return;
  const f = m => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const xToMin = clientX => {
    const r = tl.getBoundingClientRect();
    if (!r.width) return null;
    let m = Math.round((clientX - r.left) / r.width * 1440 / 5) * 5; // 5分スナップ
    return Math.max(0, Math.min(1440, m));
  };
  const showTip = (text, clientX) => {
    const tip = document.getElementById('tl-tip'); if (!tip) return;
    tip.textContent = text; tip.hidden = false;
    const r = tl.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(clientX - r.left, 40), r.width - 40) + 'px';
  };
  const hideTip = () => { const tip = document.getElementById('tl-tip'); if (tip) tip.hidden = true; };

  let drag = null;   // { block, mode:'start'|'end'|'move', grab, origS, origE }
  let _tipTimer = null;
  const EDGE = 18;   // 端つかみ判定（分）

  tl.addEventListener('pointerdown', e => {
    const onBlock = e.target && e.target.getAttribute && e.target.getAttribute('data-info') != null;
    const min = xToMin(e.clientX);
    if (!onBlock || min == null) { hideTip(); return; }

    // 掴んだ位置を含む“日跨ぎでない”ブロックを探す
    const key = _ltDateKey(tlAnchor);
    const target = (dayLog[key] || []).find(b => {
      const s = _tlToMin(b.start), en = _tlToMin(b.end);
      return en > s && min >= s && min <= en;
    });
    if (!target) {  // 日跨ぎ等はドラッグ不可 → ツールチップだけ
      showTip(e.target.getAttribute('data-info'), e.clientX);
      clearTimeout(_tipTimer); _tipTimer = setTimeout(hideTip, 2500);
      return;
    }
    const s = _tlToMin(target.start), en = _tlToMin(target.end);
    const mode = (min - s <= EDGE) ? 'start' : (en - min <= EDGE) ? 'end' : 'move';
    drag = { block: target, mode, grab: min, origS: s, origE: en };
    tl.classList.add('tl-dragging');
    tl.setPointerCapture?.(e.pointerId);
    showTip(`${target.start}〜${target.end}`, e.clientX);
    e.preventDefault();
  });

  tl.addEventListener('pointermove', e => {
    if (drag) {
      const min = xToMin(e.clientX); if (min == null) return;
      const { block, mode, grab, origS, origE } = drag;
      if (mode === 'start') {
        block.start = f(Math.max(0, Math.min(min, origE - 5)));
      } else if (mode === 'end') {
        block.end = f(Math.min(1439, Math.max(min, origS + 5)));
      } else {
        const dur = origE - origS;
        let ns = Math.max(0, Math.min(1440 - dur, origS + (min - grab)));
        block.start = f(ns); block.end = f(ns + dur);
      }
      renderTimelog();
      showTip(`${block.start}〜${block.end}`, e.clientX);
      return;
    }
    // 通常ホバー：ジャンル＋時間
    const info = e.target && e.target.getAttribute && e.target.getAttribute('data-info');
    if (info) showTip(info, e.clientX); else hideTip();
  });

  const endDrag = () => { if (!drag) return; drag = null; tl.classList.remove('tl-dragging'); saveDayLog(); renderTimelog(); };
  tl.addEventListener('pointerup', endDrag);
  tl.addEventListener('pointercancel', endDrag);
  tl.addEventListener('pointerleave', () => { if (!drag) hideTip(); });

  // パレットからのドラッグ＆ドロップで追加
  tl.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect='copy'; });
  tl.addEventListener('drop', e => {
    e.preventDefault();
    const cat = e.dataTransfer.getData('text/cat'); if (!cat) return;
    const min = xToMin(e.clientX); if (min == null) return;
    const m = Math.max(0, Math.min(1410, Math.round(min/30)*30));
    const key = _ltDateKey(tlAnchor);
    if (!dayLog[key]) dayLog[key] = [];
    dayLog[key].push({ cat, start: f(m), end: f(m+60) });
    saveDayLog();
    renderTimelog();
  });
})();

// ═══════════════════════════════════════════════════════
//  TIMELOG 入力革命
//  A. 打刻（いまからボタン） B. 妖精の推測（すき間タップ）
//  C. ルーチン自動入力      D. 1分まとめウィザード
// ═══════════════════════════════════════════════════════
const _tlF = m => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

function _tlPushBlock(key, b) {
  if (!dayLog[key]) dayLog[key] = [];
  dayLog[key].push(b);
  saveDayLog();
}

// 1日のどの分が埋まっているかのマップと、空き時間帯のリスト
function _tlCoveredMap(blocks) {
  const covered = new Array(1440).fill(false);
  (blocks || []).forEach(b => {
    const s = _tlToMin(b.start), e = _tlToMin(b.end);
    const segs = e > s ? [[s, e]] : [[s, 1440], [0, e]];
    segs.forEach(([a, z]) => { for (let i = a; i < z; i++) covered[i] = true; });
  });
  return covered;
}
function _tlFindGaps(blocks, minLen) {
  const covered = _tlCoveredMap(blocks);
  const gaps = []; let i = 0;
  while (i < 1440) {
    if (!covered[i]) {
      let j = i; while (j < 1440 && !covered[j]) j++;
      if (j - i >= (minLen || 1)) gaps.push([i, j]);
      i = j;
    } else i++;
  }
  return gaps;
}

// ── A. 打刻：タップした瞬間から記録。次のタップで自動的に閉じる ──
let tlPunch = (() => { try { return JSON.parse(localStorage.getItem('gq_tl_punch') || 'null'); } catch { return null; } })();
function _savePunch() {
  if (tlPunch) localStorage.setItem('gq_tl_punch', JSON.stringify(tlPunch));
  else localStorage.removeItem('gq_tl_punch');
}

// 日をまたいで放置された打刻は、その日の終わり（24時）で自動的に締める
function resolveStalePunch() {
  if (!tlPunch) return;
  if (tlPunch.dateKey !== todayKey()) {
    if (tlPunch.start !== '00:00') {
      _tlPushBlock(tlPunch.dateKey, { cat: tlPunch.cat, start: tlPunch.start, end: '00:00', punch: true });
    }
    tlPunch = null; _savePunch();
  }
}

// 学習セッションが始まったら、開いている打刻をその時点で締める
function closePunchAt(min) {
  resolveStalePunch();
  if (!tlPunch) return;
  const s = _tlToMin(tlPunch.start);
  if (min > s) _tlPushBlock(tlPunch.dateKey, { cat: tlPunch.cat, start: tlPunch.start, end: _tlF(min), punch: true });
  tlPunch = null; _savePunch();
  if ((document.getElementById('review-overlay')?.classList.contains('open') && rvPeriod === 'day')) renderPunchBar();
}

function punchTap(catId) {
  resolveStalePunch();
  const now = new Date();
  const nowF = _tlF(now.getHours() * 60 + now.getMinutes());
  if (tlPunch) {
    const same = tlPunch.cat === catId;
    if (tlPunch.start !== nowF) {   // 0分ブロックは捨てる
      _tlPushBlock(tlPunch.dateKey, { cat: tlPunch.cat, start: tlPunch.start, end: nowF, punch: true });
    }
    tlPunch = same ? null : { cat: catId, dateKey: todayKey(), start: nowF };
  } else {
    tlPunch = { cat: catId, dateKey: todayKey(), start: nowF };
  }
  _savePunch();
  renderPunchBar();
  if ((document.getElementById('review-overlay')?.classList.contains('open') && rvPeriod === 'day')) renderTimelog();
}

function renderPunchBar() {
  const card   = document.getElementById('punch-card');
  const chips  = document.getElementById('tl-punch-chips');
  const status = document.getElementById('tl-punch-status');
  if (!card || !chips || !status) return;
  // タイムログ機能が解放されるまではカードごと隠す（段階的開放と歩調を合わせる）
  if (typeof featUnlocks !== 'undefined' && !featUnlocks.has('timelog')) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  resolveStalePunch();
  // 学習は打刻に出さない（ポモドーロ完了で自動記録されるため）
  chips.innerHTML = TIMELOG_CATS.filter(c => c.id !== 'study').map(c => {
    const on = tlPunch && tlPunch.cat === c.id;
    return `<button class="tl-punch-chip${on ? ' on' : ''}" data-cat="${c.id}"
      style="border-color:${c.color}88${on ? `;background:${c.color}26` : ''}">${on ? '⏺ ' : ''}${c.emoji}${c.name}</button>`;
  }).join('');
  chips.querySelectorAll('.tl-punch-chip').forEach(b =>
    b.addEventListener('click', () => punchTap(b.dataset.cat)));
  if (tlPunch) {
    const c = _tlCat(tlPunch.cat);
    status.innerHTML = `<span class="tl-punch-live"></span>${c.emoji} ${c.name} <b>${tlPunch.start}〜</b> 記録中（同じボタンで終了・別のボタンで切替）`;
  } else {
    status.textContent = '⏱ いまから何する？ タップした瞬間から記録が始まるよ';
  }
}

// ── C. ルーチン：毎日くり返す予定は一度だけ設定 ──────────
let tlRoutine     = (() => { try { return JSON.parse(localStorage.getItem('gq_tl_routine') || '[]'); } catch { return []; } })();
let tlRoutineDays = (() => { try { return JSON.parse(localStorage.getItem('gq_tl_routine_days') || '{}'); } catch { return {}; } })();
function _saveRoutine() { localStorage.setItem('gq_tl_routine', JSON.stringify(tlRoutine)); }
function _saveRoutineDays() {
  const keys = Object.keys(tlRoutineDays).sort();
  while (keys.length > 60) delete tlRoutineDays[keys.shift()];
  localStorage.setItem('gq_tl_routine_days', JSON.stringify(tlRoutineDays));
}

// 今日の分のルーチンを「まだ何も無い時間帯」にだけ流し込む（1日1回）
function applyRoutineToday() {
  if (!tlRoutine.length) return;
  const key = todayKey();
  if (tlRoutineDays[key]) return;
  tlRoutineDays[key] = true; _saveRoutineDays();
  const dow = new Date().getDay();
  const rules = tlRoutine.filter(r => (r.days || []).includes(dow));
  if (!rules.length) return;
  const covered = _tlCoveredMap(dayLog[key]);
  let added = false;
  rules.forEach(r => {
    const s = _tlToMin(r.start), e = _tlToMin(r.end);
    const ranges = e > s ? [[s, e]] : [[s, 1440], [0, e]];
    ranges.forEach(([a, z]) => {
      let i = a;
      while (i < z) {
        if (!covered[i]) {
          let j = i; while (j < z && !covered[j]) j++;
          if (j - i >= 10) {   // 10分未満の切れ端は入れない
            _tlPushBlock(key, { cat: r.cat, start: _tlF(i), end: j >= 1440 ? '00:00' : _tlF(j), auto: true, routine: true });
            added = true;
          }
          for (let k2 = i; k2 < j; k2++) covered[k2] = true;
          i = j;
        } else i++;
      }
    });
  });
  if (added && (document.getElementById('review-overlay')?.classList.contains('open') && rvPeriod === 'day')) renderTimelog();
}

const _RT_DOW = ['日', '月', '火', '水', '木', '金', '土'];
let _rtDays = [0, 1, 2, 3, 4, 5, 6];   // 追加フォームの曜日選択（初期値：毎日）

function renderRoutine() {
  const list = document.getElementById('tl-rt-list');
  if (!list) return;
  list.innerHTML = tlRoutine.length
    ? tlRoutine.map((r, i) => {
        const c = _tlCat(r.cat);
        const dl = (r.days || []).length === 7 ? '毎日' : (r.days || []).slice().sort().map(d => _RT_DOW[d]).join('');
        return `<div class="tl-rt-row">
          <span class="tl-row-dot" style="background:${c.color}"></span>
          <span class="tl-rt-name">${c.emoji} ${c.name}</span>
          <span class="tl-rt-time">${r.start}〜${r.end}</span>
          <span class="tl-rt-dows">${dl}</span>
          <button class="tl-row-del" data-i="${i}">×</button>
        </div>`;
      }).join('')
    : `<span class="tl-chip tl-chip-empty">まだルーチンがありません（例：😴 睡眠 23:00〜07:00 毎日）</span>`;
  list.querySelectorAll('.tl-row-del').forEach(b => b.addEventListener('click', () => {
    tlRoutine.splice(parseInt(b.dataset.i), 1); _saveRoutine(); renderRoutine();
  }));
  const sum = document.getElementById('tl-rt-summary');
  if (sum) sum.textContent = tlRoutine.length ? `${tlRoutine.length}件 登録中` : '';
}

function addRoutineRule() {
  const cat   = document.getElementById('tl-rt-cat').value;
  const start = _tlGetTime('tl-rt-sh', 'tl-rt-sm');
  const end   = _tlGetTime('tl-rt-eh', 'tl-rt-em');
  if (start === end) { alert('開始と終了が同じ時刻です'); return; }
  if (!_rtDays.length) { alert('曜日を1つ以上選んでください'); return; }
  tlRoutine.push({ cat, start, end, days: [..._rtDays].sort() });
  _saveRoutine();
  delete tlRoutineDays[todayKey()];   // 今日にも即反映
  applyRoutineToday();
  renderRoutine();
  renderTimelog();
}

// ルーチンUIの初期化（タイムログを初めて開いたときに一度だけ）
let _tlExtraInited = false;
function initTimelogExtras() {
  if (_tlExtraInited) return;
  _tlExtraInited = true;
  const sel = document.getElementById('tl-rt-cat');
  if (sel) {
    sel.innerHTML = TIMELOG_CATS.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
    sel.value = 'sleep';
  }
  const hOpts = Array.from({length: 24}, (_, h) => `<option value="${h}">${String(h).padStart(2,'0')}</option>`).join('');
  const mOpts = Array.from({length: 12}, (_, k) => { const m = k*5; return `<option value="${m}">${String(m).padStart(2,'0')}</option>`; }).join('');
  ['tl-rt-sh', 'tl-rt-eh'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = hOpts; });
  ['tl-rt-sm', 'tl-rt-em'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = mOpts; });
  _tlSetTime('tl-rt-sh', 'tl-rt-sm', '23:00');
  _tlSetTime('tl-rt-eh', 'tl-rt-em', '07:00');
  const dwrap = document.getElementById('tl-rt-days');
  if (dwrap) {
    dwrap.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d =>
      `<button class="tl-rt-day${_rtDays.includes(d) ? ' on' : ''}" data-d="${d}">${_RT_DOW[d]}</button>`).join('');
    dwrap.querySelectorAll('.tl-rt-day').forEach(b => b.addEventListener('click', () => {
      const d = parseInt(b.dataset.d);
      if (_rtDays.includes(d)) _rtDays = _rtDays.filter(x => x !== d); else _rtDays.push(d);
      b.classList.toggle('on', _rtDays.includes(d));
    }));
  }
  document.getElementById('tl-rt-add')?.addEventListener('click', addRoutineRule);
  document.getElementById('tl-rt-toggle')?.addEventListener('click', () => {
    const box = document.getElementById('tl-rt-box');
    if (box) box.style.display = box.style.display === 'none' ? '' : 'none';
  });
}

// ── B. 妖精の推測：過去の癖から「この時間いつも何してる？」を当てる ──
function guessCatsForRange(s, e) {
  const mid = Math.floor((s + e) / 2);
  const tally = {};
  for (let back = 1; back <= 28; back++) {
    const d = new Date(); d.setDate(d.getDate() - back);
    const blocks = dayLog[dkey(d)];
    if (!blocks || !blocks.length) continue;
    for (const b of blocks) {
      const bs = _tlToMin(b.start), be = _tlToMin(b.end);
      const segs = be > bs ? [[bs, be]] : [[bs, 1440], [0, be]];
      if (segs.some(([a, z]) => mid >= a && mid < z)) { tally[b.cat] = (tally[b.cat] || 0) + 1; break; }
    }
  }
  const hist = Object.entries(tally).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  // 履歴が足りないときは時間帯の常識で推測
  const h = mid / 60;
  const dow = new Date().getDay();
  const heur = [];
  if (h >= 22 || h < 7) heur.push('sleep');
  if ((h >= 11.5 && h < 13.5) || (h >= 18 && h < 20.5)) heur.push('meal');
  if (h >= 9 && h < 18 && dow >= 1 && dow <= 5) heur.push('work');
  if ((h >= 7 && h < 9) || (h >= 17.5 && h < 19)) heur.push('commute');
  heur.push('rest', 'hobby', 'chore');
  const seen = new Set(); const out = [];
  [...hist, ...heur].forEach(c => { if (!seen.has(c) && TIMELOG_CATS.some(x => x.id === c)) { seen.add(c); out.push(c); } });
  return out.slice(0, 3);
}

function addGapBlock(cat, s, e) {
  _tlPushBlock(_ltDateKey(tlAnchor), { cat, start: _tlF(s), end: e >= 1440 ? '00:00' : _tlF(e) });
  const box = document.getElementById('tl-suggest');
  if (box) box.innerHTML = '';
  renderTimelog();
}

function showGapSuggest(s, e) {
  const box = document.getElementById('tl-suggest');
  if (!box) return;
  const tops = guessCatsForRange(s, e);
  const main = _tlCat(tops[0]);
  const range = `${_tlF(s)}〜${e >= 1440 ? '24:00' : _tlF(e)}`;
  box.innerHTML = `<div class="tl-sug">
    <div class="tl-sug-msg">🧚 ${range}…… いつもは <b>${main.emoji}${main.name}</b> の時間かな？</div>
    <div class="tl-sug-actions">
      <button class="tl-sug-main" data-cat="${main.id}" style="border-color:${main.color}">${main.emoji} ${main.name}で記録</button>
      ${tops.slice(1).map(id => { const c = _tlCat(id); return `<button class="tl-sug-alt" data-cat="${c.id}" style="border-color:${c.color}66">${c.emoji}${c.name}</button>`; }).join('')}
      <button class="tl-sug-close">✕</button>
    </div>
  </div>`;
  box.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => addGapBlock(b.dataset.cat, s, e)));
  box.querySelector('.tl-sug-close').addEventListener('click', () => { box.innerHTML = ''; });
}

// ── D. 1分まとめウィザード：空白を順番にサクサク埋める ──
let _tlWiz = null;
function startGapWizard() {
  const gaps = _tlFindGaps(_tlBlocks(), 15).slice(0, 8);
  if (!gaps.length) return;
  _tlWiz = { gaps, i: 0, added: 0 };
  renderWizStep();
}
function renderWizStep() {
  const box = document.getElementById('tl-suggest');
  if (!box || !_tlWiz) return;
  if (_tlWiz.i >= _tlWiz.gaps.length) {
    box.innerHTML = `<div class="tl-sug tl-sug-done">✨ おつかれさま！ ${_tlWiz.added}個の空白が色づいたよ</div>`;
    _tlWiz = null;
    setTimeout(() => { if (box.querySelector('.tl-sug-done')) box.innerHTML = ''; }, 3500);
    return;
  }
  const [s, e] = _tlWiz.gaps[_tlWiz.i];
  const tops = guessCatsForRange(s, e);
  const range = `${_tlF(s)}〜${e >= 1440 ? '24:00' : _tlF(e)}（${_tlFmtH(e - s)}）`;
  box.innerHTML = `<div class="tl-sug">
    <div class="tl-sug-msg">🌙 1分まとめ <b>${_tlWiz.i + 1} / ${_tlWiz.gaps.length}</b> ── ${range} は何してた？</div>
    <div class="tl-sug-actions">
      ${tops.map((id, k) => { const c = _tlCat(id); return `<button class="${k === 0 ? 'tl-sug-main' : 'tl-sug-alt'}" data-cat="${c.id}" style="border-color:${c.color}${k === 0 ? '' : '66'}">${c.emoji}${c.name}</button>`; }).join('')}
    </div>
    <div class="tl-sug-actions">
      ${TIMELOG_CATS.filter(c => !tops.includes(c.id)).map(c => `<button class="tl-sug-mini" data-cat="${c.id}" title="${c.name}">${c.emoji}</button>`).join('')}
      <button class="tl-sug-skip">スキップ</button>
      <button class="tl-sug-close">やめる</button>
    </div>
  </div>`;
  box.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
    _tlPushBlock(_ltDateKey(tlAnchor), { cat: b.dataset.cat, start: _tlF(s), end: e >= 1440 ? '00:00' : _tlF(e) });
    _tlWiz.i++; _tlWiz.added++;
    renderTimelog();
    renderWizStep();
  }));
  box.querySelector('.tl-sug-skip').addEventListener('click', () => { _tlWiz.i++; renderWizStep(); });
  box.querySelector('.tl-sug-close').addEventListener('click', () => { _tlWiz = null; box.innerHTML = ''; });
}

// 起動時：昨日の打刻を締め、今日のルーチンを流し込み、ホームの打刻カードを描画
resolveStalePunch();
applyRoutineToday();
renderPunchBar();

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
  slotList.innerHTML = EQUIPPABLE_CATEGORIES.map(cat => {
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

  // ── コレクション・ギャラリー（全装備をカードで表示）─
  renderEquipmentCollection();

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
  ownedList.innerHTML = EQUIPPABLE_CATEGORIES.map(cat => {
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

// ── コレクション・ギャラリー描画 ──────────────────────
// 全装備（ITEM_MASTER）を「美しい統一カード」で表示。
// 未所持はシルエット＋🔒、所持は色付き、装備中はリボン表示。
function renderEquipmentCollection() {
  const grid = document.getElementById('equipment-collection-grid');
  if (!grid) return;

  // B-1：ペットはオトモン図鑑へ統合したので装備コレクションには出さない
  const equipItems = ITEM_MASTER.filter(it => it.category !== 'pet');
  const ownedCount = equipItems.filter(it => hasItem(it.id)).length;
  const total      = equipItems.length;
  const prog = document.getElementById('eq-collection-progress');
  if (prog) prog.innerHTML = `<strong>${ownedCount}</strong> / ${total} 収集`;

  // カテゴリ順 → レア度順（伝説が上）で並べると見栄えが良い
  const rarityRank = { legendary:0, epic:1, rare:2, common:3 };
  const sorted = [...equipItems].sort((a, b) => {
    const ca = EQUIPMENT_CATEGORIES.indexOf(a.category);
    const cb = EQUIPMENT_CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return rarityRank[a.rarity] - rarityRank[b.rarity];
  });

  grid.innerHTML = sorted.map(item => {
    const owned    = hasItem(item.id);
    const equipped = isEquipped(item.id);
    const cls = [
      'eq-card',
      `eq-rarity-${item.rarity}`,
      owned ? 'owned' : 'locked',
      equipped ? 'equipped' : '',
    ].join(' ');

    const ribbon = equipped ? '<span class="eq-card-ribbon">装備中</span>' : '';
    const lock   = owned ? '' : '<span class="eq-card-lock">🔒</span>';
    const art    = owned
      ? `<div class="eq-card-art">${renderItemIcon(item, 54)}</div>`
      : `<div class="eq-card-art eq-card-art-locked">${renderItemIcon(item, 54)}</div>`;
    const bond   = owned && isBondedItem(item.id) ? ' <span class="eq-bond" title="5時間以上ともに歩んだ絆">✨</span>' : '';
    const name   = owned ? item.name + bond : '？？？';
    const mem    = owned ? itemMemoryText(item.id) : '';
    const comp   = owned ? companionTimeText(item.id) : '';
    const body   = owned
      ? `<div class="eq-card-effect">◇ ${item.effect.desc}</div>
         <div class="eq-card-flavor">${item.flavorText || ''}</div>
         ${mem ? `<div class="eq-card-memory">${mem}</div>` : ''}
         ${comp ? `<div class="eq-card-companion">⏳ ${comp}</div>` : ''}`
      : `<div class="eq-card-effect eq-card-effect-locked">未発見</div>`;

    return `<div class="${cls}">
      ${ribbon}${lock}
      <div class="eq-card-cat">${CATEGORY_LABEL[item.category]}</div>
      ${art}
      <div class="eq-card-name">${name}</div>
      <span class="eq-card-rarity eq-rarity-${item.rarity}">${RARITY_LABELS[item.rarity]}</span>
      ${body}
    </div>`;
  }).join('');
}

function openEquipmentModal() {
  Overlay.open('equipment-overlay');
  renderEquipmentModal();
}
function closeEquipmentModal() {
  Overlay.close('equipment-overlay');
}

// ▼ テスト用：ランダムに未所持装備を1つ入手し、発見演出を再生
//   （確認が済んだら、このブロックと index.html のボタン1行を削除でOK）
document.getElementById('eq-test-grant-btn')?.addEventListener('click', () => {
  const item = grantRandomEquipmentItem();
  if (item) showEquipmentGetModal(item);
  else alert('🎉 全30種コンプリート！もう入手できる装備はありません。');
});

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

  // ✦ キラキラ演出（レア度が高いほど多く・金色に）
  spawnEquipmentGetSparkles(item.rarity);

  Overlay.open('equipment-get-overlay');
}

// 装備発見時のキラキラ粒子を生成する
function spawnEquipmentGetSparkles(rarity) {
  const box = document.getElementById('eq-get-sparkles');
  if (!box) return;
  box.innerHTML = '';
  // レア度で粒の数と色を変える
  const counts = { common: 6, rare: 9, epic: 12, legendary: 16 };
  const n = counts[rarity] || 6;
  const gold = (rarity === 'legendary' || rarity === 'epic');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'eq-get-sparkle';
    // 中央付近から外側へ放射状に飛ばす
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    s.style.left = '50%';
    s.style.top  = '38%';
    s.style.setProperty('--sx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--sy', `${Math.sin(ang) * dist}px`);
    s.style.animationDelay = `${0.3 + Math.random() * 0.5}s`;
    if (gold) s.style.background =
      'radial-gradient(circle, #fde68a, rgba(251,191,36,0))';
    box.appendChild(s);
  }
}
function closeEquipmentGetModal() {
  Overlay.close('equipment-get-overlay');
}
document.getElementById('eq-get-close-btn').addEventListener('click', closeEquipmentGetModal);
document.getElementById('equipment-get-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('equipment-get-overlay')) closeEquipmentGetModal();
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
    'xp-panel', 'daily-quest-card', 'mission-card', 'genre-card', 'mode-panel',
    'timer-card', 'stats-strip', 'punch-card', 'calendar-panel'
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

    // 保存に含まれていない既知ID（後から追加された新カード）は、
    // 末尾ではなく「デフォルト並びでの位置」に挿入する
    const orderedIds = [...validSaved];
    KNOWN_IDS.forEach((id, idx) => {
      if (orderedIds.includes(id)) return;
      let insertAt = 0;   // 直前の既知ウィジェットの後ろへ
      for (let i = idx - 1; i >= 0; i--) {
        const p = orderedIds.indexOf(KNOWN_IDS[i]);
        if (p >= 0) { insertAt = p + 1; break; }
      }
      orderedIds.splice(insertAt, 0, id);
    });

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
  Overlay.open('tutorial-overlay');
}
function closeTutorial() {
  Overlay.close('tutorial-overlay');
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
  if (e.key === 'ArrowLeft')  { e.preventDefault(); tutorialPrev(); }
  else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
    e.preventDefault(); tutorialNext();
  }
});

// 設定モーダルからの再表示
const _showTutBtn = document.getElementById('show-tutorial-btn');
if (_showTutBtn) {
  _showTutBtn.addEventListener('click', () => {
    // 設定モーダルを閉じてから召喚オンボーディング（見直しモード）を開く
    Overlay.close('settings-overlay');
    setTimeout(() => openSummon(true), 320);   // 設定のフェードアウト後
  });
}

// 旧チュートリアルの自動表示は「召喚オンボーディング」へ統合済み。
// （openTutorial 関数は当面残置するが、初回の自動表示は openSummon が担う）

// ═══════════════════════════════════════════════════════
//  ✦ 召喚オンボーディング（初回体験）
//  - 初回起動（gq_summoned 未設定）でローンチ後に自動表示
//  - キャラ選択 / 冒険者名 / 使命（ジャンル・習慣化・断つ）を決める
//  - localStorage: gq_summoned='1' で完了。設定から再表示（見直しモード）
// ═══════════════════════════════════════════════════════

// ── 冒険者名 ──
function loadPlayerName() { return localStorage.getItem('gq_player_name') || ''; }
function savePlayerName(n) { localStorage.setItem('gq_player_name', n || ''); }
let playerName = loadPlayerName();

// ── 使命データ（育てる build / 断つ quit）──
function loadMission() {
  try {
    const m = JSON.parse(localStorage.getItem('gq_mission') || 'null');
    if (m && typeof m === 'object') return { build: Array.isArray(m.build) ? m.build : [], quit: Array.isArray(m.quit) ? m.quit : [] };
  } catch {}
  return { build: [], quit: [] };
}
function saveMission() { localStorage.setItem('gq_mission', JSON.stringify(mission)); }
let mission = loadMission();

// 習慣のチェックは毎日リセット（「できた日に押す」＝1日1回の積み重ね）。
// 日付が変わって初めて開いた時に、その日のチェックを白紙に戻す。
function resetDailyMissionChecks() {
  const today = todayKey();
  if (localStorage.getItem('gq_mission_reset') === today) return false;
  let changed = false;
  ['build', 'quit'].forEach(kind => {
    (mission[kind] || []).forEach(it => { if (it.done) { it.done = false; changed = true; } });
  });
  if (changed) saveMission();
  localStorage.setItem('gq_mission_reset', today);
  return changed;
}

// 召喚中の一時データ（確定は finishSummon でまとめて保存）
let summonDraft = null;
let summonStep = 0;
let summonReviewMode = false;   // 設定からの再表示（データを消さず追記）

// ジャンル候補（emoji/color は既存 EMOJI_OPTIONS / COLOR_OPTIONS と同系統）
const SUMMON_GENRE_PRESETS = [
  { name:'英語',          emoji:'🗣️', color:'#06b6d4' },
  { name:'読書',          emoji:'📚', color:'#818cf8' },
  { name:'プログラミング', emoji:'💻', color:'#4ade80' },
  { name:'資格・勉強',     emoji:'✏️', color:'#fbbf24' },
  { name:'運動・筋トレ',   emoji:'💪', color:'#f97316' },
  { name:'投資・お金',     emoji:'💰', color:'#a78bfa' },
  { name:'創作・アート',   emoji:'🎨', color:'#f472b6' },
  { name:'音楽',          emoji:'🎵', color:'#e63946' },
];

// キャラ選択カードの顔フレーム（各PNGで顔位置が違うので個別に中央寄せ）
const SUMMON_CHAR_FRAME = {
  A: { size: '108%', pos: 'center 20%' },
  B: { size: '108%', pos: 'center 16%' },
  C: { size: '108%', pos: 'center 18%' },
};

const SUMMON_STEPS = [
  { key:'welcome', icon:'⚔',  img:'assets/guide-fairy-smile.png', title:'Growth Quest へようこそ',
    body:'ここは、学習や自己成長が <b>冒険</b> になる世界。<br>あなたの努力が経験値になり、レベルが上がり、世界が広がっていきます。<br>まずは、あなたのキャラクターを選びましょう。' },
  { key:'char',    icon:'🧝', img:'assets/guide-fairy-smile.png', title:'冒険者を選ぶ',
    body:'あなたといっしょに歩む冒険者を選んでください。<br><span style="opacity:.7;font-size:.82em">（あとから「アバター」画面でいつでも変えられます）</span>' },
  { key:'name',    icon:'✍️', img:'assets/guide-fairy-calm.png', title:'冒険者の名前',
    body:'なんと呼べばいい？<br>あなたの冒険者名を教えてください。' },
  { key:'ritual',  icon:'✨', img:'assets/guide-fairy-joy.png', title:'召喚の儀', body:'' },   // body は名前から動的生成
  { key:'genre',   icon:'📚', img:'assets/guide-fairy-smile.png', title:'使命 ①　育てる力を選ぶ',
    body:'これから冒険で育てたいテーマを選びましょう。<br><span style="opacity:.7;font-size:.82em">（複数OK・あとから追加変更できます）</span>' },
  { key:'build',   icon:'🌱', img:'assets/guide-fairy-joy.png', title:'使命 ②　身につけたい習慣',
    body:'冒険を通して <b>習慣にしたいこと</b> はありますか？<br><span style="opacity:.7;font-size:.82em">小さなことでOK。無ければ空のままでも進めます。</span>' },
  { key:'quit',    icon:'🔥', img:'assets/guide-fairy-think.png', title:'使命 ③　断ちたい習慣',
    body:'逆に、<b>やめたい・減らしたい習慣</b> はありますか？<br><span style="opacity:.7;font-size:.82em">例：「寝る前のだらだらスマホ」。無ければ空でOK。</span>' },
  { key:'creed',   icon:'🌟', img:'assets/guide-fairy-calm.png', title:'冒険者の心得',
    body:'・5分でもOK。<b>始めた時点で前進</b> です。<br>・完了すると XP・すごろく・装備・バッジで成長が見えます。<br>・<b>自信は、小さな行動の積み重ね</b> から育ちます。' },
  { key:'start',   icon:'⚔',  img:'assets/guide-fairy-joy.png', title:'', body:'準備は整いました。<br>あなたの冒険を、始めましょう！' },  // title は名前から動的生成
];

// 召喚背景の星を生成（初回のみ）
function buildSummonStars() {
  const wrap = document.getElementById('summon-stars');
  if (!wrap || wrap.childElementCount) return;
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('div');
    s.className = 'summon-star';
    const sz = 1 + Math.random() * 2.4;
    s.style.width = s.style.height = sz + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.top  = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3) + 's';
    wrap.appendChild(s);
  }
}

// 使命（build/quit）の入力リスト HTML
function summonMissionListHTML(kind) {
  const arr = summonDraft[kind] || [];
  const ph  = kind === 'build' ? '例：毎日10分だけ英語にふれる' : '例：寝る前のだらだらスマホをやめる';
  const list = arr.length
    ? `<div class="summon-mlist">${arr.map((t, i) =>
        `<div class="summon-mitem"><span>${escHtml(t)}</span><button class="summon-mdel" data-summon-mdel="${kind}:${i}" title="削除">✕</button></div>`).join('')}</div>`
    : '';
  return `${list}
    <div class="summon-madd">
      <input type="text" class="summon-input" id="summon-m-${kind}" maxlength="40" placeholder="${ph}">
      <button class="summon-madd-btn" data-summon-madd="${kind}">＋ 追加</button>
    </div>
    <div class="summon-input-hint">いくつでも追加できます（空のままでもOK）</div>`;
}

// ステップ固有の中身を #summon-slot に描画
function renderSummonSlot(step) {
  const slot = document.getElementById('summon-slot');
  if (!slot) return;
  if (step.key === 'char') {
    const types = [['A','冒険者A','凜々しい剣士'], ['B','冒険者B','聡明な魔法使い'], ['C','冒険者C','旅する吟遊詩人']];
    slot.innerHTML = `<div class="summon-char-grid">${types.map(([t, nm, ds]) =>
      `<button class="summon-char-btn${summonDraft.avType === t ? ' active' : ''}" data-summon-char="${t}">
        <div class="summon-char-pic" style="background-image:url('${(AV_FACE_FRAME[t] || AV_FACE_FRAME.A).src}');background-size:${(SUMMON_CHAR_FRAME[t]||{}).size||'cover'};background-position:${(SUMMON_CHAR_FRAME[t]||{}).pos||'center top'}"></div>
        <div class="summon-char-name">${nm}</div>
        <div class="summon-char-desc">${ds}</div>
      </button>`).join('')}</div>`;
  } else if (step.key === 'name') {
    slot.innerHTML = `<input type="text" class="summon-input" id="summon-name-input" maxlength="12" placeholder="例：ヨージ" value="${escHtml(summonDraft.name)}">
      <div class="summon-input-hint">空のままでもOK（あとで設定から変えられます）</div>`;
  } else if (step.key === 'genre') {
    slot.innerHTML = `<div class="summon-genre-grid">${SUMMON_GENRE_PRESETS.map((g, i) =>
      `<button class="summon-genre-chip${summonDraft.genres.some(x => x.name === g.name) ? ' active' : ''}" data-summon-genre="${i}" style="--gc:${g.color}">
        <span class="sg-emoji">${g.emoji}</span>${g.name}</button>`).join('')}</div>
      <div class="summon-genre-custom">
        <input type="text" class="summon-input" id="summon-genre-custom" maxlength="20" placeholder="自由に追加（例：救急医学）">
        <button class="summon-madd-btn" data-summon-genre-add>＋</button>
      </div>
      <div class="summon-input-hint">タップで選択／自由入力も追加できます</div>`;
  } else if (step.key === 'build') {
    slot.innerHTML = summonMissionListHTML('build');
  } else if (step.key === 'quit') {
    slot.innerHTML = summonMissionListHTML('quit');
  } else {
    slot.innerHTML = '';
  }
}

// 名前入力など、画面遷移時に入力値を draft へ取り込む
function captureSummonInputs() {
  const step = SUMMON_STEPS[summonStep];
  if (!step) return;
  if (step.key === 'name') {
    const el = document.getElementById('summon-name-input');
    if (el) summonDraft.name = el.value.trim();
  }
}

// メイン描画（ドット・アイコン・タイトル・本文・ボタン状態）
function renderSummon() {
  const step = SUMMON_STEPS[summonStep];
  if (!step || !summonDraft) return;
  const nm = (summonDraft.name || '').trim();

  const iconEl = document.getElementById('summon-icon');
  if (step.img) {
    iconEl.textContent = '';
    iconEl.style.backgroundImage = `url('${step.img}')`;
    iconEl.classList.add('summon-icon-img');
  } else {
    iconEl.style.backgroundImage = '';
    iconEl.classList.remove('summon-icon-img');
    iconEl.textContent = step.icon;
  }

  let title = step.title, body = step.body;
  if (step.key === 'ritual') {
    body = (nm ? `<b>${escHtml(nm)}</b> よ。<br>` : '冒険者よ。<br>')
      + 'Growth Quest の世界へ、ようこそ。<br>いま、あなたに3つの <b>使命</b> を授けます。';
  } else if (step.key === 'start') {
    title = nm ? `いざ、${escHtml(nm)} の冒険へ` : 'いざ、冒険へ';
  }
  document.getElementById('summon-title').innerHTML = title;
  document.getElementById('summon-body').innerHTML = body;
  renderSummonSlot(step);
  document.getElementById('summon-panel').classList.toggle('ritual', step.key === 'ritual');

  document.getElementById('summon-dots').innerHTML = SUMMON_STEPS.map((_, i) =>
    `<span class="summon-dot${i === summonStep ? ' active' : i < summonStep ? ' passed' : ''}"></span>`).join('');

  document.getElementById('summon-prev-btn').disabled = (summonStep === 0);

  const nextBtn = document.getElementById('summon-next-btn');
  const isLast  = summonStep === SUMMON_STEPS.length - 1;
  nextBtn.classList.toggle('start', isLast);
  nextBtn.textContent = isLast ? '⚔ 冒険を始める' : (step.key === 'ritual' ? '使命を授かる →' : '次へ →');
  nextBtn.disabled = (step.key === 'genre' && summonDraft.genres.length === 0);

  document.getElementById('summon-panel').scrollTop = 0;
}

function openSummon(review = false) {
  summonReviewMode = review;
  summonStep = 0;
  summonDraft = { avType: avatarType || 'A', name: playerName || '', genres: [], build: [], quit: [] };
  buildSummonStars();
  renderSummon();
  Overlay.open('summon-overlay');
  setTimeout(() => document.getElementById('summon-name-input')?.focus(), 60);
}
function closeSummon() { Overlay.close('summon-overlay'); }

function finishSummon() {
  captureSummonInputs();
  // 冒険者名
  playerName = (summonDraft.name || '').trim();
  savePlayerName(playerName);
  // 分身（アバタータイプ）
  avatarType = summonDraft.avType || 'A';
  saveAvatarType();
  renderAvatarBtn();
  // ジャンル（新規のみ追加。同名は重複させない）
  summonDraft.genres.forEach(g => {
    if (!genres.some(x => x.name === g.name)) {
      genres.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        name: g.name, emoji: g.emoji, color: g.color, xp: 0, minutes: 0 });
    }
  });
  saveGenres();
  if (typeof renderGenreSelector === 'function') renderGenreSelector();
  // 使命（既存に追記）
  summonDraft.build.forEach(t => mission.build.push({ id: 'mb' + Date.now() + Math.random().toString(36).slice(2, 5), text: t, done: false }));
  summonDraft.quit.forEach(t  => mission.quit.push({  id: 'mq' + Date.now() + Math.random().toString(36).slice(2, 5), text: t, done: false }));
  saveMission();
  if (typeof renderMissionCard === 'function') renderMissionCard();
  // 完了フラグ（旧チュートリアルも見た扱いにして二重表示を防ぐ）
  localStorage.setItem('gq_summoned', '1');
  localStorage.setItem('gq_tutorial_seen', '1');
  closeSummon();
  setTimeout(() => { if (typeof maybeStartGuideTutorial === 'function') maybeStartGuideTutorial(); }, 500);
}

function skipSummon() {
  captureSummonInputs();
  if (summonDraft) {
    playerName = (summonDraft.name || '').trim(); savePlayerName(playerName);
    avatarType = summonDraft.avType || avatarType; saveAvatarType(); renderAvatarBtn();
  }
  localStorage.setItem('gq_summoned', '1');
  localStorage.setItem('gq_tutorial_seen', '1');
  closeSummon();
  setTimeout(() => { if (typeof maybeStartGuideTutorial === 'function') maybeStartGuideTutorial(); }, 500);
}

function summonNext() {
  captureSummonInputs();
  const step = SUMMON_STEPS[summonStep];
  if (step.key === 'genre' && summonDraft.genres.length === 0) return;
  if (summonStep < SUMMON_STEPS.length - 1) { summonStep++; renderSummon(); }
  else finishSummon();
}
function summonPrev() {
  captureSummonInputs();
  if (summonStep > 0) { summonStep--; renderSummon(); }
}

// ── イベント ──
document.getElementById('summon-next-btn').addEventListener('click', summonNext);
document.getElementById('summon-prev-btn').addEventListener('click', summonPrev);
document.getElementById('summon-skip-btn').addEventListener('click', skipSummon);

// slot 内の操作（イベント委譲）
document.getElementById('summon-slot').addEventListener('click', e => {
  const charBtn = e.target.closest('[data-summon-char]');
  if (charBtn) { summonDraft.avType = charBtn.dataset.summonChar; renderSummonSlot(SUMMON_STEPS[summonStep]); return; }

  const gChip = e.target.closest('[data-summon-genre]');
  if (gChip) {
    const g = SUMMON_GENRE_PRESETS[+gChip.dataset.summonGenre];
    const idx = summonDraft.genres.findIndex(x => x.name === g.name);
    if (idx >= 0) summonDraft.genres.splice(idx, 1); else summonDraft.genres.push({ ...g });
    renderSummon();
    return;
  }
  if (e.target.closest('[data-summon-genre-add]')) {
    const inp = document.getElementById('summon-genre-custom');
    const v = (inp?.value || '').trim();
    if (v && !summonDraft.genres.some(x => x.name === v)) {
      const color = COLOR_OPTIONS[(genres.length + summonDraft.genres.length) % COLOR_OPTIONS.length];
      summonDraft.genres.push({ name: v, emoji: '📖', color });
      renderSummon();
    }
    return;
  }
  const mAdd = e.target.closest('[data-summon-madd]');
  if (mAdd) {
    const kind = mAdd.dataset.summonMadd;
    const inp = document.getElementById('summon-m-' + kind);
    const v = (inp?.value || '').trim();
    if (v) { summonDraft[kind].push(v); renderSummonSlot(SUMMON_STEPS[summonStep]);
      setTimeout(() => document.getElementById('summon-m-' + kind)?.focus(), 30); }
    return;
  }
  const mDel = e.target.closest('[data-summon-mdel]');
  if (mDel) {
    const [kind, i] = mDel.dataset.summonMdel.split(':');
    summonDraft[kind].splice(+i, 1);
    renderSummonSlot(SUMMON_STEPS[summonStep]);
    return;
  }
});

// Enter キーで「追加」または「次へ」
document.getElementById('summon-slot').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const id = e.target.id;
  if (id === 'summon-genre-custom') document.querySelector('[data-summon-genre-add]')?.click();
  else if (id === 'summon-m-build') document.querySelector('[data-summon-madd="build"]')?.click();
  else if (id === 'summon-m-quit')  document.querySelector('[data-summon-madd="quit"]')?.click();
  else summonNext();
});

// 初回起動時の自動表示（ローンチ画面が消えた後）
// 既存ユーザー（この機能より前から使っている人）には召喚を出さず、静かに完了扱いにする
if (!localStorage.getItem('gq_summoned')) {
  const isExistingUser = localStorage.getItem('gq_tutorial_seen') === '1'
    || (data.sessions || 0) > 0 || (data.totalMinutes || 0) > 0;
  if (isExistingUser) {
    localStorage.setItem('gq_summoned', '1');
  } else {
    setTimeout(() => openSummon(false), 3200);   // 新規ユーザーのみ：ローンチ後に召喚
  }
}

// ── ⚔ 使命カード（ホーム表示：育てる/断つ）──
let missionAddKind = null;   // インライン追加中の種別（'build' | 'quit' | null）

function missionSectionHTML(kind, label, emoji) {
  const arr = mission[kind] || [];
  const items = arr.length
    ? arr.map(it => `<div class="mc-item${it.done ? ' done' : ''}">
        <button class="mc-check" data-mc-toggle="${kind}:${it.id}" title="できた日に押す">${it.done ? '✓' : '○'}</button>
        <span class="mc-text">${escHtml(it.text)}</span>
        <button class="mc-del" data-mc-del="${kind}:${it.id}" title="削除">✕</button>
      </div>`).join('')
    : `<div class="mc-empty">まだありません</div>`;
  const addUI = missionAddKind === kind
    ? `<div class="mc-add">
         <input type="text" class="mc-input" id="mc-input-${kind}" maxlength="40" placeholder="${kind === 'build' ? '例：毎日10分だけ英語' : '例：寝る前のだらだらスマホ'}">
         <button class="mc-add-ok" data-mc-addok="${kind}">追加</button>
       </div>`
    : `<button class="mc-add-btn" data-mc-addbtn="${kind}">＋ 追加</button>`;
  return `<div class="mc-section mc-${kind}">
    <div class="mc-sec-title">${emoji} ${label} <span class="mc-reset-hint">毎朝リセット</span></div>
    ${items}
    ${addUI}
  </div>`;
}

function renderMissionCard() {
  const card = document.getElementById('mission-card');
  if (!card) return;
  const body = document.getElementById('mission-body');
  const nm = (playerName || '').trim();
  const hd = card.querySelector('.mc-header');
  if (hd) hd.textContent = nm ? `⚔ ${nm}の使命` : '⚔ あなたの使命';
  const total = (mission.build?.length || 0) + (mission.quit?.length || 0);
  if (total === 0 && missionAddKind === null) {
    body.innerHTML = `<div class="mc-intro">育てたい習慣・断ちたい習慣を決めると、ここに並びます。</div>
      <div class="mc-intro-btns">
        <button class="mc-add-btn" data-mc-addbtn="build">🌱 育てたい習慣を追加</button>
        <button class="mc-add-btn" data-mc-addbtn="quit">🔥 断ちたい習慣を追加</button>
      </div>`;
  } else {
    body.innerHTML =
      missionSectionHTML('build', '育てたい習慣', '🌱') +
      missionSectionHTML('quit',  '断ちたい習慣', '🔥');
  }
  card.style.display = '';
}

// 使命カードの操作（イベント委譲）
document.getElementById('mission-card')?.addEventListener('click', e => {
  const tog = e.target.closest('[data-mc-toggle]');
  if (tog) {
    const [kind, id] = tog.dataset.mcToggle.split(':');
    const it = (mission[kind] || []).find(x => x.id === id);
    if (it) { it.done = !it.done; saveMission(); renderMissionCard(); }
    return;
  }
  const del = e.target.closest('[data-mc-del]');
  if (del) {
    const [kind, id] = del.dataset.mcDel.split(':');
    mission[kind] = (mission[kind] || []).filter(x => x.id !== id);
    saveMission(); renderMissionCard();
    return;
  }
  const addBtn = e.target.closest('[data-mc-addbtn]');
  if (addBtn) {
    missionAddKind = addBtn.dataset.mcAddbtn;
    renderMissionCard();
    setTimeout(() => document.getElementById('mc-input-' + missionAddKind)?.focus(), 30);
    return;
  }
  const addOk = e.target.closest('[data-mc-addok]');
  if (addOk) {
    const kind = addOk.dataset.mcAddok;
    const inp = document.getElementById('mc-input-' + kind);
    const v = (inp?.value || '').trim();
    if (v) {
      mission[kind].push({ id: (kind === 'build' ? 'mb' : 'mq') + Date.now() + Math.random().toString(36).slice(2, 5), text: v, done: false });
      saveMission();
    }
    missionAddKind = null;
    renderMissionCard();
    return;
  }
});

// 追加入力で Enter → 確定
document.getElementById('mission-card')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = e.target.id || '';
  if (id.startsWith('mc-input-')) {
    e.preventDefault();
    document.querySelector(`[data-mc-addok="${id.replace('mc-input-', '')}"]`)?.click();
  }
});

// 起動時：日付が変わっていれば習慣チェックをリセット → カードを表示
resetDailyMissionChecks();
if (localStorage.getItem('gq_summoned') === '1' || (mission.build && mission.build.length) || (mission.quit && mission.quit.length)) {
  renderMissionCard();
}

// アプリを開きっぱなしで日付をまたいだ場合に備え、再表示時にもリセット判定
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (resetDailyMissionChecks()) renderMissionCard();
});

// ═══════════════════════════════════════════════════════
//  🏰 冒険者ギルド（クエスト掲示板）
//  「迷ったらギルドへ。今日のあなたを1ミリ進める依頼がある」
//  - localStorage: gq_guild
//  - 既存の addBonusXP / addConfidence / data を再利用して報酬を付与
// ═══════════════════════════════════════════════════════

// ── NPC依頼主（世界観の語り手）──
const GUILD_NPCS = {
  mimi:  { name:'受付 ミミ',          icon:'🧝‍♀️' },
  garud: { name:'鍛錬教官 ガルド',    icon:'🛡️' },
  hotta: { name:'茶屋の主人 ホッタ',  icon:'🍵' },
  noton: { name:'記録係 ノートン',    icon:'📖' },
  rista: { name:'再開の案内人 リスタ', icon:'🕊️' },
};

const GUILD_RANK_ORDER = ['F','E','D','C','B','A','S'];

// ── ギルド名声（ギルド自体の格。達成したクエストのXP合計で上がる）──
const GUILD_FAME_RANKS = [
  { min:0,    name:'無名の依頼所' },
  { min:80,   name:'駆け出しのギルド' },
  { min:250,  name:'名の知れたギルド' },
  { min:600,  name:'信頼されしギルド' },
  { min:1200, name:'英雄たちのギルド' },
  { min:2500, name:'伝説のギルド' },
];

// ── ギルドのデータ ──
function loadGuild() {
  try {
    const g = JSON.parse(localStorage.getItem('gq_guild') || '{}');
    return {
      fame:        g.fame        || 0,
      completions: g.completions || {},  // { questId: 累積達成回数 }
      daily:       g.daily       || {},  // { 'YYYY-MM-DD': { questId:true } }
      weekly:      g.weekly      || {},  // { weekKey: { questId:true } }
      once:        g.once        || {},  // { questId:true }
      contrib:     g.contrib     || {},  // { カテゴリ: 累積 }
    };
  } catch { return { fame:0, completions:{}, daily:{}, weekly:{}, once:{}, contrib:{} }; }
}
function saveGuild() { localStorage.setItem('gq_guild', JSON.stringify(guild)); }
let guild = loadGuild();
let guildFilter = 'all';

// ── ⛩️ 誓いの祠（目標コミット）──
function loadVows() { try { return JSON.parse(localStorage.getItem('gq_vows') || '[]'); } catch { return []; } }
function saveVows() { localStorage.setItem('gq_vows', JSON.stringify(vows)); }
let vows = loadVows();
let vowFormOpen = false;

const VOW_PRAISES = [
  'よくぞ、その誓いを果たした。あなたは確かに、前へ進んだ。',
  '刻んだ約束を、あなたは守りぬいた。それは何より尊いこと。',
  '見ていたよ。あなたが諦めずに歩いた、その一歩ずつを。',
  'この誓いは、もうあなたの一部だ。胸を張っていい。',
  'ちいさな約束を守れる人が、おおきな夢にたどり着くんだよ。',
];

function vowDeadlineLabel(d) {
  if (!d) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const dl = new Date(d + 'T00:00:00');
  const diff = Math.round((dl - today) / 86400000);
  const md = `${dl.getMonth()+1}/${dl.getDate()}`;
  if (diff >  1) return `🎯 ${md}まで（あと${diff}日）`;
  if (diff === 1) return `🎯 ${md}まで（あと1日）`;
  if (diff === 0) return `🎯 今日まで`;
  return `🎯 ${md}（焦らず、じっくりで）`;
}

function commitVow(text, deadline) {
  const t = (text || '').trim();
  if (!t) return;
  vows.push({ id:'v'+Date.now(), text:t, deadline:deadline||'', createdAt:todayKey(), done:false, doneAt:null });
  saveVows(); vowFormOpen = false; renderGuild();
}
function deleteVow(id) { vows = vows.filter(v => v.id !== id); saveVows(); renderGuild(); }

function fulfillVow(id) {
  const v = vows.find(x => x.id === id);
  if (!v || v.done) return;
  v.done = true; v.doneAt = todayKey();
  saveVows();
  // 報酬（誓いは重いので大きめ）
  addBonusXP(50);
  addConfidence(5, 'guild_quest');
  guild.fame += 50; saveGuild();
  showVowBlessing(v);
  renderGuild();
  evaluateUnlocks(false);
}

function renderVowsSection() {
  const active = vows.filter(v => !v.done);
  const done   = vows.filter(v =>  v.done).sort((a,b) => (b.doneAt||'').localeCompare(a.doneAt||''));
  let h = `<div class="vow-shrine">
    <div class="vow-shrine-head"><span class="vow-shrine-title">⛩️ 誓いの祠</span></div>
    <div class="vow-shrine-lead">心に決めた目標を、石碑に刻もう。果たしたとき、妖精が祝福してくれる。</div>`;
  if (vowFormOpen) {
    h += `<div class="vow-form">
      <textarea id="vow-input" rows="2" maxlength="80" placeholder="例：英語を毎日30分、3週間続ける"></textarea>
      <div class="vow-form-row">
        <label>いつまでに（任意）</label>
        <input type="date" id="vow-deadline" min="${todayKey()}">
      </div>
      <div class="vow-form-actions">
        <button class="vow-form-cancel" data-vow-cancel>やめる</button>
        <button class="vow-form-commit" data-vow-commit>⛏️ 石碑に刻む</button>
      </div>
    </div>`;
  } else {
    h += `<button class="vow-carve-btn" data-vow-open>⛏️ 新しい誓いを刻む</button>`;
  }
  active.forEach(v => {
    const over = v.deadline && (new Date(v.deadline+'T00:00:00') < new Date(new Date().setHours(0,0,0,0)));
    h += `<div class="vow-stone">
      <div class="vow-stone-text">🪨 ${escHtml(v.text)}</div>
      <div class="vow-stone-foot">
        <span class="vow-stone-deadline${over?' over':''}">${vowDeadlineLabel(v.deadline)}</span>
        <span>
          <button class="vow-stone-del" data-vow-del="${v.id}" title="取り下げる">✕</button>
          <button class="vow-fulfill-btn" data-vow-fulfill="${v.id}">✓ 果たした</button>
        </span>
      </div>
    </div>`;
  });
  if (done.length) {
    h += `<div class="vow-fulfilled-title">🏆 成就した誓い（${done.length}）</div>`;
    done.slice(0, 5).forEach(v => {
      const d = v.doneAt ? v.doneAt.slice(5).replace('-','/') : '';
      h += `<div class="vow-monument">🏆 <span>${escHtml(v.text)}</span><span class="vm-date">${d} 成就</span></div>`;
    });
  }
  h += `</div>`;
  return h;
}

function showVowBlessing(v) {
  const ov = document.getElementById('vow-blessing-overlay');
  if (!ov) return;
  document.getElementById('vb-vow').textContent = `「${v.text}」`;
  document.getElementById('vb-praise').textContent = VOW_PRAISES[Math.floor(Math.random()*VOW_PRAISES.length)];
  document.getElementById('vb-reward').innerHTML = `<span>+50 XP</span><span>自信 +5</span><span>名声 +50</span>`;
  Overlay.open('vow-blessing-overlay');
  spawnVowSparkles();
}
function spawnVowSparkles() {
  const box = document.getElementById('vb-sparkles');
  if (!box) return;
  box.innerHTML = '';
  const marks = ['✨','⭐','💫','🌟'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'vb-sparkle'; s.textContent = marks[i % marks.length];
    const ang = Math.random()*Math.PI*2, dist = 60 + Math.random()*120;
    s.style.left = (50 + (Math.random()*30-15)) + '%';
    s.style.top  = (38 + (Math.random()*20-10)) + '%';
    s.style.setProperty('--sx', (Math.cos(ang)*dist).toFixed(0) + 'px');
    s.style.setProperty('--sy', (Math.sin(ang)*dist).toFixed(0) + 'px');
    s.style.animationDelay = (Math.random()*0.3).toFixed(2) + 's';
    box.appendChild(s);
  }
}

// 累積達成回数の合計（pred でクエストを絞れる）
function guildCompletedTotal(pred) {
  return GUILD_QUESTS.reduce(
    (sum, q) => (!pred || pred(q)) ? sum + (guild.completions[q.id] || 0) : sum, 0);
}

// ── クエスト定義 ──
// rank:難易度 / cat:成長領域 / npc:依頼主 / title:依頼名 / desc:内容
// xp,conf:報酬 / repeat: daily|weekly|once / unlock:解放条件 / unlockText:条件の表示
// special:'comeback' は、連続記録が途切れた直後だけ「おかえり依頼」として推す
const GUILD_QUESTS = [
  // ───── Fランク（誰でも初日から）─────
  { id:'g_izumi', rank:'F', cat:'暮らし', npc:'hotta', title:'生命の泉を補給せよ',
    desc:'水かお茶を一口飲んで、集中力の源を取り戻そう。', xp:5, conf:1, repeat:'daily',
    unlock:() => true, unlockText:'' },
  { id:'g_kokyu', rank:'F', cat:'精神', npc:'hotta', title:'三呼吸の儀',
    desc:'目を閉じて、ゆっくり3回深呼吸する。', xp:5, conf:1, repeat:'daily',
    unlock:() => true, unlockText:'' },
  { id:'g_houi', rank:'F', cat:'集中', npc:'mimi', title:'冒険の方角を定めよ',
    desc:'今日やることを、たった1つだけ決める。', xp:5, conf:0, repeat:'daily',
    writable:true, hint:'例：英語の長文を1つ読む',
    unlock:() => true, unlockText:'' },
  { id:'g_jouka', rank:'F', cat:'暮らし', npc:'mimi', title:'机上の浄化',
    desc:'机の上のものを1つだけ片付ける。', xp:5, conf:0, repeat:'daily',
    unlock:() => true, unlockText:'' },
  { id:'g_tanren', rank:'F', cat:'肉体', npc:'garud', title:'小さな鍛錬',
    desc:'5分だけ身体を動かす。集中力は筋肉から戻る。', xp:10, conf:0, repeat:'daily',
    unlock:() => true, unlockText:'' },
  { id:'g_jisan', rank:'F', cat:'情緒', npc:'noton', title:'自賛の一筆',
    desc:'今日できたことを1つ書き残す。', xp:5, conf:2, repeat:'daily',
    writable:true, hint:'例：苦手な単語を10個おぼえた',
    unlock:() => true, unlockText:'' },

  // ───── Eランク（Fを5回 または Lv2）─────
  { id:'g_shuchu', rank:'E', cat:'集中', npc:'garud', title:'はじまりの集中',
    desc:'25分間、ひとつのことに集中する（ポモドーロ1回）。', xp:25, conf:0, repeat:'daily',
    unlock:() => (data.level||1) >= 2 || guildCompletedTotal(q => q.rank==='F') >= 5,
    unlockText:'Fランク依頼を5回、または Lv2 で解放' },
  { id:'g_manabi', rank:'E', cat:'学習', npc:'noton', title:'一行の学び',
    desc:'今日の学びを、たった1行でいいから記録する。', xp:15, conf:1, repeat:'daily',
    writable:true, hint:'例：関係代名詞 which の使い方',
    unlock:() => (data.level||1) >= 2, unlockText:'Lv2 で解放' },

  // ───── Dランク（Lv5）─────
  { id:'g_nigate', rank:'D', cat:'学習', npc:'garud', title:'苦手への一撃',
    desc:'苦手な分野を、5分だけ復習する。', xp:20, conf:0, repeat:'daily',
    unlock:() => (data.level||1) >= 5, unlockText:'Lv5 で解放' },
  { id:'g_sahou', rank:'D', cat:'暮らし', npc:'hotta', title:'整えの作法',
    desc:'寝る前に、今日の「丁寧だった行動」を1つ記録する。', xp:20, conf:1, repeat:'daily',
    writable:true, hint:'例：使った食器をすぐ洗った',
    unlock:() => (data.level||1) >= 5, unlockText:'Lv5 で解放' },

  // ───── Cランク（Lv10）─────
  { id:'g_hasshin', rank:'C', cat:'創造', npc:'noton', title:'知の発信',
    desc:'学んだことを、誰かに説明できる形に1つまとめる。', xp:40, conf:0, repeat:'daily',
    writable:true, hint:'学んだことを一言で説明すると？',
    unlock:() => (data.level||1) >= 10, unlockText:'Lv10 で解放' },
  { id:'g_kaizen', rank:'C', cat:'創造', npc:'mimi', title:'改善の一案',
    desc:'暮らしや学びの「ここを良くしたい」を1つ書く。', xp:40, conf:0, repeat:'daily',
    writable:true, hint:'例：朝の準備を5分早くする',
    unlock:() => (data.level||1) >= 10, unlockText:'Lv10 で解放' },

  // ───── Bランク（Lv20・週課題）─────
  { id:'g_renzoku', rank:'B', cat:'肉体', npc:'garud', title:'三日連続の証',
    desc:'3日連続で身体を動かし、継続の証を立てる。', xp:100, conf:0, repeat:'weekly',
    unlock:() => (data.level||1) >= 20, unlockText:'Lv20 で解放' },
  { id:'g_asakatsu', rank:'B', cat:'精神', npc:'hotta', title:'朝活の継承',
    desc:'朝のうちに、クエストを3回こなす。', xp:100, conf:0, repeat:'weekly',
    unlock:() => (data.level||1) >= 20, unlockText:'Lv20 で解放' },

  // ───── Aランク（Lv35・週課題）─────
  { id:'g_jussen', rank:'A', cat:'集中', npc:'garud', title:'週間十戦',
    desc:'今週、ポモドーロを合計10回達成する。', xp:250, conf:0, repeat:'weekly',
    unlock:() => (data.level||1) >= 35, unlockText:'Lv35 で解放' },

  // ───── Sランク（Lv50・一生もの）─────
  { id:'g_densetsu', rank:'S', cat:'挑戦', npc:'mimi', title:'伝説への序章',
    desc:'90日かけて成し遂げたい大きな目標を掲げ、最初の一歩を踏み出す。', xp:500, conf:0, repeat:'once',
    unlock:() => (data.level||1) >= 50, unlockText:'Lv50 で解放' },

  // ───── 再開クエスト（途切れた直後に光る）─────
  { id:'g_kikan', rank:'F', cat:'回復', npc:'rista', title:'帰還の報告',
    desc:'ギルドに「戻ってきた」と報告する。それだけで、もう十分えらい。', xp:15, conf:3, repeat:'daily',
    unlock:() => true, unlockText:'', special:'comeback' },
];

// ── 状態判定 ──
function guildIsUnlocked(q) { try { return !!q.unlock(); } catch { return false; } }
function guildCanDoToday(q) {
  if (q.repeat === 'daily')  return !(guild.daily[todayKey()] && guild.daily[todayKey()][q.id]);
  if (q.repeat === 'weekly') { const wk = getWeekKey(new Date()); return !(guild.weekly[wk] && guild.weekly[wk][q.id]); }
  if (q.repeat === 'once')   return !guild.once[q.id];
  return true;
}

// ── 名声ランクの算出 ──
function guildFameInfo() {
  let cur = GUILD_FAME_RANKS[0];
  for (const r of GUILD_FAME_RANKS) if (guild.fame >= r.min) cur = r;
  const idx  = GUILD_FAME_RANKS.indexOf(cur);
  const next = GUILD_FAME_RANKS[idx + 1] || null;
  const pct  = next ? Math.min(100, Math.round((guild.fame - cur.min) / (next.min - cur.min) * 100)) : 100;
  return { name: cur.name, pct, next, fame: guild.fame };
}

// ── クエスト達成 ──
function completeGuildQuest(id, note) {
  const q = GUILD_QUESTS.find(x => x.id === id);
  if (!q || !guildIsUnlocked(q) || !guildCanDoToday(q)) return;

  // 記録（XP付与の前に書き込んで二重達成を防ぐ）
  guild.completions[id] = (guild.completions[id] || 0) + 1;
  guild.contrib[q.cat]  = (guild.contrib[q.cat] || 0) + 1;
  guild.fame += q.xp;
  if (q.repeat === 'daily')  { const k = todayKey();          (guild.daily[k]  = guild.daily[k]  || {})[id] = true; }
  if (q.repeat === 'weekly') { const k = getWeekKey(new Date()); (guild.weekly[k] = guild.weekly[k] || {})[id] = true; }
  if (q.repeat === 'once')   { guild.once[id] = true; }
  // 書く系クエストの記録を残す（後で振り返れる）
  if (note && note.trim()) {
    guild.noteLog = guild.noteLog || [];
    guild.noteLog.push({ date: todayKey(), id, title: q.title, text: note.trim() });
  }
  guildWriteOpen = null;
  saveGuild();

  // 報酬（既存システムを再利用）
  addBonusXP(q.xp);
  if (q.conf > 0) addConfidence(q.conf, 'guild_quest');

  showGuildToast(q);
  renderGuild();
  evaluateUnlocks(false);   // XP増でレベルが上がっていれば新機能解放をチェック
}

function showGuildToast(q) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  const npc = GUILD_NPCS[q.npc];
  t.innerHTML = `📜 依頼を達成！<br>` +
    `<span style="opacity:.85;font-weight:400">${q.title}</span>`;
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

// ── 今日のおすすめ依頼を1つ選ぶ ──
function guildPickRecommended() {
  // ① 連続記録が途切れた直後 → リスタの「おかえり依頼」
  const kikan = GUILD_QUESTS.find(q => q.id === 'g_kikan');
  if (data.streakWasBroken && guildCanDoToday(kikan)) {
    return { q: kikan, tag:'おかえり依頼', line:'戻ってきたんだね。それだけで、もう十分えらい。' };
  }
  // 候補 = 解放済み・今日まだ・通常クエスト
  const cands = GUILD_QUESTS.filter(q =>
    q.special !== 'comeback' && guildIsUnlocked(q) && guildCanDoToday(q));
  if (!cands.length) return null;
  const byRank = (a, b) => GUILD_RANK_ORDER.indexOf(a.rank) - GUILD_RANK_ORDER.indexOf(b.rank);
  // ② 継続中（3日以上）→ ちょっと背伸びした高ランク
  if ((data.streak || 0) >= 3) {
    const q = cands.sort(byRank).reverse()[0];
    return { q, tag:'挑戦の時', line:'いい流れだ。今日は少し、背伸びしてみるか？' };
  }
  // ③ ふだん → 一番やさしいランクから
  const q = cands.sort(byRank)[0];
  return { q, tag:'今日のおすすめ', line:'今のあなたにちょうどいい依頼、ありますよ。' };
}

// ── 1枚のクエストカードHTML ──
// 書く系クエストの入力欄／記録表示を組み立てる共通パーツ
function guildWriteUI(q, context, stateCls) {
  const wid = `${context}:${q.id}`;
  if (q.writable && guildWriteOpen === wid) {
    return `<div class="quest-write">
      <textarea class="quest-write-input" id="qw_${context}_${q.id}" rows="2" maxlength="120" placeholder="${q.hint||''}"></textarea>
      <div class="quest-write-actions">
        <button class="quest-write-cancel" data-write-cancel>やめる</button>
        <button class="quest-write-commit" data-write-commit="${wid}">記録して達成</button>
      </div>
    </div>`;
  }
  if (stateCls === 'done' && q.writable) {
    const note = getGuildNote(q.id, todayKey());
    if (note) return `<div class="quest-done-note">📝 ${escHtml(note)}</div>`;
  }
  return '';
}

function guildQuestCardHTML(q) {
  const npc = GUILD_NPCS[q.npc];
  const reward = `+${q.xp}XP` +
    (q.conf ? `<span class="qr-conf">自信+${q.conf}</span>` : '') +
    `<span class="qr-cat">${q.cat}</span>`;
  let stateCls, footRight;
  if (!guildIsUnlocked(q)) {
    stateCls = 'locked';
    footRight = `<div class="quest-lock-cond">🔒 ${q.unlockText || '？？？'}</div>`;
  } else if (!guildCanDoToday(q)) {
    stateCls = 'done';
    footRight = `<div class="quest-done-stamp">達成済</div>`;
  } else {
    stateCls = 'clickable';
    footRight = `<button class="quest-do-btn" data-do="${q.id}">✓ できた</button>`;
  }
  return `<div class="quest-card ${stateCls}">
    <div class="quest-card-rank qr-${q.rank}">
      <span class="qr-letter">${q.rank}</span><span class="qr-label">RANK</span>
    </div>
    <div class="quest-card-main">
      <div class="quest-card-npc">${npc.icon} ${npc.name}</div>
      <div class="quest-card-title">${q.title}</div>
      <div class="quest-card-desc">${q.desc}</div>
      <div class="quest-card-foot">
        <div class="quest-card-reward">${reward}</div>
        ${footRight}
      </div>
    </div>
  </div>`;
}

// ── ギルド画面の描画 ──
function renderGuild() {
  const body = document.getElementById('guild-body');
  if (!body) return;
  const fi  = guildFameInfo();
  const sub = document.getElementById('guild-sub');
  if (sub) sub.textContent = `${fi.name}　•　名声 ${guild.fame}`;

  let html = '';

  // 名声バー
  html += `<div class="guild-fame">
    <div class="guild-fame-top">
      <span class="guild-fame-rank">🏰 ${fi.name}</span>
      <span class="guild-fame-num">${fi.next ? `次の格まで ${fi.next.min - guild.fame}` : '最高ランク！'}</span>
    </div>
    <div class="guild-fame-track"><div class="guild-fame-fill" style="width:0%" data-w="${fi.pct}"></div></div>
  </div>`;

  // ⛩️ 誓いの祠（自分で立てる大目標）
  html += renderVowsSection();

  // 今日のおすすめ依頼
  const rec = guildPickRecommended();
  html += `<div class="guild-sec-title">📌 今日のおすすめ依頼</div>`;
  if (rec) {
    const npc = GUILD_NPCS[rec.q.npc];
    html += `<div class="guild-pick">
      <span class="guild-pick-tag">${rec.tag}</span>
      <div class="quest-card-npc">${npc.icon} ${npc.name}「${rec.line}」</div>
      <div class="quest-card-title">【${rec.q.rank}】${rec.q.title}</div>
      <div class="quest-card-desc">${rec.q.desc}</div>
      <div class="quest-card-foot">
        <div class="quest-card-reward">+${rec.q.xp}XP${rec.q.conf?`<span class="qr-conf">自信+${rec.q.conf}</span>`:''}</div>
        <button class="quest-do-btn" data-do="${rec.q.id}">✓ できた</button>
      </div>
    </div>`;
  } else {
    html += `<div class="guild-empty">今日の依頼は、ぜんぶ達成済み！また明日、ギルドで会おう。</div>`;
  }

  // クエスト掲示板（ランクフィルター）
  html += `<div class="guild-sec-title">📋 クエスト掲示板</div>`;
  const ranksAvail = ['all', ...GUILD_RANK_ORDER];
  html += `<div class="guild-filter">` + ranksAvail.map(r =>
    `<button class="guild-filter-chip${guildFilter===r?' active':''}" data-filter="${r}">${r==='all'?'すべて':r}</button>`
  ).join('') + `</div>`;

  // 並び：解放済み×未達成（ランク昇順）→ 達成済み → ロック
  const list = GUILD_QUESTS.filter(q => guildFilter === 'all' || q.rank === guildFilter);
  const weight = q => {
    if (!guildIsUnlocked(q)) return 2;
    if (!guildCanDoToday(q)) return 1;
    return 0;
  };
  list.sort((a, b) => weight(a) - weight(b)
    || GUILD_RANK_ORDER.indexOf(a.rank) - GUILD_RANK_ORDER.indexOf(b.rank));
  html += list.length
    ? list.map(guildQuestCardHTML).join('')
    : `<div class="guild-empty">このランクの依頼は、まだありません。</div>`;

  body.innerHTML = html;

  // 名声バーをアニメで伸ばす
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = body.querySelector('.guild-fame-fill[data-w]');
    if (fill) fill.style.width = fill.dataset.w + '%';
  }));
}

// ── 開閉・イベント ──
function openGuild() {
  vowFormOpen = false;
  Overlay.open('guild-overlay');
  renderGuild();
}
document.getElementById('guild-btn')?.addEventListener('click', openGuild);
document.getElementById('guild-close-btn')?.addEventListener('click', () =>
  Overlay.close('guild-overlay'));
document.getElementById('guild-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('guild-overlay'))
    Overlay.close('guild-overlay');
});
// クエスト達成・フィルター・誓いの祠（イベント委譲）
document.getElementById('guild-body')?.addEventListener('click', e => {
  // ── 誓いの祠 ──
  if (e.target.closest('[data-vow-open]'))   { vowFormOpen = true;  renderGuild();
    setTimeout(() => document.getElementById('vow-input')?.focus(), 50); return; }
  if (e.target.closest('[data-vow-cancel]')) { vowFormOpen = false; renderGuild(); return; }
  if (e.target.closest('[data-vow-commit]')) {
    commitVow(document.getElementById('vow-input')?.value, document.getElementById('vow-deadline')?.value);
    return;
  }
  const ful = e.target.closest('[data-vow-fulfill]');
  if (ful) { fulfillVow(ful.dataset.vowFulfill); return; }
  const del = e.target.closest('[data-vow-del]');
  if (del) { if (confirm('この誓いを取り下げますか？')) deleteVow(del.dataset.vowDel); return; }

  // ── ギルドのクエスト ──
  const doBtn = e.target.closest('[data-do]');
  if (doBtn) { completeGuildQuest(doBtn.dataset.do); return; }
  const fBtn = e.target.closest('[data-filter]');
  if (fBtn) { guildFilter = fBtn.dataset.filter; renderGuild(); }
});

// 妖精の祝福モーダルを閉じる
document.getElementById('vb-close-btn')?.addEventListener('click', () =>
  Overlay.close('vow-blessing-overlay'));
document.getElementById('vow-blessing-overlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('vow-blessing-overlay'))
    Overlay.close('vow-blessing-overlay');
});

// ═══════════════════════════════════════════════════════
//  導きの妖精スプライト（絵文字 🧚 → 専用グラフィックへ差し替え）
//  世界樹の緑×ミントの羽を持つ、アプリ世界観に合わせた妖精。
//  複数箇所へ描くため、defのidは呼び出しごとにユニーク化する。
// ═══════════════════════════════════════════════════════
const _FAIRY_INNER = `
  <defs>
    <radialGradient id="glow__U__" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#bbf7d0" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#bbf7d0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wing__U__" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a7f3d0" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#67e8f9" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="dress__U__" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
    <radialGradient id="hair__U__" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="33" r="30" fill="url(#glow__U__)"/>
  <g opacity="0.9" stroke="#5eead4" stroke-width="0.8">
    <path d="M30 30 C 8 14, 4 30, 16 36 C 22 39, 28 36, 30 32 Z" fill="url(#wing__U__)"/>
    <path d="M30 34 C 10 44, 10 56, 22 52 C 28 50, 30 42, 30 36 Z" fill="url(#wing__U__)"/>
    <path d="M34 30 C 56 14, 60 30, 48 36 C 42 39, 36 36, 34 32 Z" fill="url(#wing__U__)"/>
    <path d="M34 34 C 54 44, 54 56, 42 52 C 36 50, 34 42, 34 36 Z" fill="url(#wing__U__)"/>
  </g>
  <path d="M32 36 C 27 36, 25 50, 24 54 C 28 57, 36 57, 40 54 C 39 50, 37 36, 32 36 Z" fill="url(#dress__U__)" stroke="#1e7a52" stroke-width="1"/>
  <circle cx="25" cy="44" r="2.4" fill="#ffe3bc" stroke="#1e7a52" stroke-width="0.7"/>
  <circle cx="39" cy="44" r="2.4" fill="#ffe3bc" stroke="#1e7a52" stroke-width="0.7"/>
  <circle cx="32" cy="22" r="13" fill="url(#hair__U__)" stroke="#d4870f" stroke-width="0.6"/>
  <circle cx="32" cy="24" r="10.5" fill="#ffe7c4" stroke="#caa46a" stroke-width="0.6"/>
  <path d="M22 21 C 23 14, 31 13, 32 18 C 30 16, 26 17, 23.5 21 Z" fill="url(#hair__U__)" stroke="#b45309" stroke-width="0.7"/>
  <path d="M42 21 C 41 14, 33 13, 32 18 C 34 16, 38 17, 40.5 21 Z" fill="url(#hair__U__)" stroke="#b45309" stroke-width="0.7"/>
  <path d="M32 14 C 33 16, 33 18, 32 19 C 31 18, 31 16, 32 14 Z" fill="url(#hair__U__)"/>
  <circle cx="22" cy="27" r="2.4" fill="url(#hair__U__)"/>
  <circle cx="42" cy="27" r="2.4" fill="url(#hair__U__)"/>
  <ellipse cx="27.5" cy="25" rx="2.6" ry="3.3" fill="#3a2b24"/>
  <ellipse cx="36.5" cy="25" rx="2.6" ry="3.3" fill="#3a2b24"/>
  <circle cx="26.6" cy="23.8" r="1" fill="#fff"/>
  <circle cx="35.6" cy="23.8" r="1" fill="#fff"/>
  <circle cx="28.2" cy="26.2" r="0.6" fill="#fff" opacity=".8"/>
  <circle cx="37.2" cy="26.2" r="0.6" fill="#fff" opacity=".8"/>
  <ellipse cx="24.5" cy="28" rx="2" ry="1.3" fill="#fca5a5" opacity=".7"/>
  <ellipse cx="39.5" cy="28" rx="2" ry="1.3" fill="#fca5a5" opacity=".7"/>
  <path d="M30.5 29.5 Q32 31.2 33.5 29.5" fill="none" stroke="#c2683f" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="41" y1="43" x2="46" y2="37" stroke="#fcd34d" stroke-width="1.2" stroke-linecap="round"/>
  <g transform="translate(46 36)">
    <circle r="2.4" fill="#fffbeb"/>
    <circle r="3.8" fill="#fde68a" opacity=".4"/>
    <path d="M0 -5 L1 -1 L5 0 L1 1 L0 5 L-1 1 L-5 0 L-1 -1 Z" fill="#fef9c3"/>
  </g>
  <circle cx="14" cy="20" r="1" fill="#fef08a"/>
  <circle cx="50" cy="50" r="1.2" fill="#a7f3d0"/>
  <circle cx="18" cy="48" r="0.9" fill="#bae6fd"/>`;

let _fairyUid = 0;
function fairySVG(px) {
  const u = 'fy' + (++_fairyUid);
  return `<svg viewBox="0 0 64 64" width="${px}" height="${px}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">${_FAIRY_INNER.replace(/__U__/g, u)}</svg>`;
}

// 🧚 が大きく出る箇所を専用グラフィックへ差し替え（小さなヘッダー絵文字等は据え置き）
function paintFairySprites() {
  const spots = [
    ['.fairy-sprite', 92],   // 世界樹の妖精モーダル
    ['.vb-fairy', 88],       // 誓いの祝福
    ['.onboard-fairy', 46],  // はじめの一歩カード
    ['.fg-sprite', 26],      // 導きの妖精ガイドの見出し
  ];
  spots.forEach(([sel, px]) => {
    document.querySelectorAll(sel).forEach(el => {
      if (el.dataset.fairyPainted) return;
      el.innerHTML = fairySVG(px);
      el.dataset.fairyPainted = '1';
    });
  });
}
paintFairySprites();

// ═══════════════════════════════════════════════════════
//  🎁 ログインボーナス（1日1回）
//  画面を開いた日の最初に「連続ログインN日目」を強調して登場。
//  「受け取る」→ ボーナスがヘッダーの🧚へ吸い込まれ、ヘッダーが豪華に変化。
// ═══════════════════════════════════════════════════════
function _heroGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 11) return ['☀️', 'おはようございます'];
  if (h >= 11 && h < 17) return ['🌤', 'おかえりなさい'];
  if (h >= 17 && h < 22) return ['🌆', 'おかえりなさい'];
  return ['🌙', '今夜もおつかれさま'];
}

// 連続ログイン日数（学習ストリークとは別。アプリを開いた日でカウント）
function _computeLoginStreak() {
  const today = todayKey();
  const last  = localStorage.getItem('gq_login_last');
  let streak  = parseInt(localStorage.getItem('gq_login_streak') || '0') || 0;
  if (last === today) return streak;          // 今日は既にカウント済み
  const y = new Date(); y.setDate(y.getDate() - 1);
  streak = (last === dkey(y)) ? streak + 1 : 1;  // 昨日も来ていれば継続、空けばリセット
  localStorage.setItem('gq_login_streak', String(streak));
  localStorage.setItem('gq_login_last', today);
  return streak;
}

// ボーナスXP：基本20 ＋ 連続日数ボーナス（最大10日分）＋ 節目ボーナス
function _loginBonusXP(streak) {
  let xp = 20 + Math.min(streak, 10) * 10;
  let milestone = '';
  if (streak > 0 && streak % 30 === 0) { xp += 300; milestone = `🎉 ${streak}日達成・特大ボーナス！`; }
  else if (streak > 0 && streak % 7 === 0) { xp += 80; milestone = `✨ ${streak}日達成ボーナス！`; }
  return { xp, milestone };
}

// ヘッダー（赤枠）を豪華な見た目に変える。当日中は維持
function applyHeaderLuxe(burst) {
  const hdr = document.querySelector('#app > header');
  if (!hdr) return;
  hdr.classList.add('header-luxe');
  localStorage.setItem('gq_header_luxe', todayKey());
  if (burst) {
    const layer = document.createElement('div');
    layer.className = 'hdr-spark-layer';
    const cols = ['#fde68a', '#fcd34d', '#a7f3d0', '#fff'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'hdr-spark';
      s.style.left = (8 + Math.random() * 84) + '%';
      s.style.top  = (15 + Math.random() * 70) + '%';
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
      layer.appendChild(s);
    }
    hdr.appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }
}

let _pendingLoginXP = 0;
function renderLoginBonus(streak, reward) {
  const card = document.getElementById('login-bonus-card');
  if (!card) return;
  const [gicon, gtext] = _heroGreeting();
  const nm = (playerName || '').trim();
  const si = getAvatarStageIndex(data.level);
  const stage = AVATAR_STAGES[si];
  const face = (AV_FACE_FRAME[avatarType] || AV_FACE_FRAME.A).src;

  // 週の進み（7日マイルストーンに向けたドット。7日目は宝箱）
  const inWeek = ((streak - 1) % 7) + 1;   // 1..7
  let dots = '';
  for (let i = 1; i <= 7; i++) {
    const on = i <= inWeek;
    dots += i === 7
      ? `<span class="lb-dot lb-dot-gift ${on ? 'on' : ''}">🎁</span>`
      : `<span class="lb-dot ${on ? 'on' : ''}"></span>`;
  }

  card.innerHTML = `
    <div class="lb-sparkles" id="lb-sparkles"></div>
    <div class="lb-badge">${gicon} ${gtext}${nm ? '、' + escHtml(nm) : ''}</div>
    <div class="lb-avatar" style="--ring:${stage.c1}">
      <img src="${face}" alt="" onerror="this.style.display='none'">
      <span class="lb-stage" style="background:linear-gradient(135deg,${stage.c1},${stage.c2})">${stage.title}・Lv${data.level}</span>
    </div>
    <div class="lb-streak-label">🔥 連続ログイン</div>
    <div class="lb-streak-num"><b>${streak}</b><span>日目</span></div>
    <div class="lb-dots">${dots}</div>
    <div class="lb-divider"><span>ログインボーナス</span></div>
    ${reward.milestone ? `<div class="lb-milestone">${reward.milestone}</div>` : ''}
    <div class="lb-reward">
      <div class="lb-orb">✨</div>
      <div class="lb-reward-xp">+${reward.xp} <small>XP</small></div>
    </div>
    <button class="lb-claim" id="lb-claim-btn">受け取る</button>`;

  // きらめき
  const spk = document.getElementById('lb-sparkles');
  if (spk) {
    const cols = ['#fde68a', '#a7f3d0', '#bae6fd', '#fff'];
    let html = '';
    for (let i = 0; i < 14; i++) {
      html += `<span class="hw-spk" style="left:${5 + Math.random()*90}%;top:${6 + Math.random()*86}%;
        --dl:${(Math.random()*2.5).toFixed(2)}s;--sz:${(3 + Math.random()*4).toFixed(1)}px;
        background:${cols[i % cols.length]}"></span>`;
    }
    spk.innerHTML = html;
  }
  document.getElementById('lb-claim-btn').addEventListener('click', claimLoginBonus);
}

function claimLoginBonus() {
  const overlay = document.getElementById('login-bonus-overlay');
  const orb     = document.querySelector('#login-bonus-card .lb-orb');
  const target  = document.getElementById('fairy-guide-btn');   // ヘッダーの🧚
  // 報酬付与＋本日受け取り済みに
  if (_pendingLoginXP > 0 && typeof addBonusXP === 'function') addBonusXP(_pendingLoginXP);
  localStorage.setItem('gq_loginbonus_seen', todayKey());

  const finish = () => {
    if (target) { target.classList.add('fairy-absorb'); setTimeout(() => target.classList.remove('fairy-absorb'), 1000); }
    applyHeaderLuxe(true);
    overlay.classList.remove('open', 'lb-claiming');
  };

  // 🧚へ吸い込まれる飛翔エフェクト
  if (orb && target && document.visibilityState === 'visible') {
    const s = orb.getBoundingClientRect(), t = target.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'lb-fly'; fly.textContent = '✨';
    fly.style.left = (s.left + s.width / 2) + 'px';
    fly.style.top  = (s.top + s.height / 2) + 'px';
    document.body.appendChild(fly);
    overlay.classList.add('lb-claiming');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fly.style.left = (t.left + t.width / 2) + 'px';
      fly.style.top  = (t.top + t.height / 2) + 'px';
      fly.style.transform = 'translate(-50%,-50%) scale(.25)';
      fly.style.opacity = '.15';
    }));
    setTimeout(() => { fly.remove(); finish(); }, 800);
  } else {
    finish();
  }
}

function maybeShowLoginBonus() {
  const today = todayKey();
  // 既に今日受け取り済み → ヘッダーは豪華なまま維持して終了
  if (localStorage.getItem('gq_loginbonus_seen') === today) {
    if (localStorage.getItem('gq_header_luxe') === today) applyHeaderLuxe(false);
    return;
  }
  // 召喚前・完全な新規（記録ゼロ）では出さない（はじめの一歩カードに任せる）
  const summoned = localStorage.getItem('gq_summoned') === '1';
  if (!summoned && !(data.sessions > 0)) return;

  const streak = _computeLoginStreak();
  const reward = _loginBonusXP(streak);
  _pendingLoginXP = reward.xp;
  renderLoginBonus(streak, reward);
  const overlay = document.getElementById('login-bonus-overlay');
  overlay.classList.add('open');
  // 背景タップで閉じる（受け取らずに閉じても、その日は再表示しない）
  overlay.onclick = (e) => {
    if (e.target === overlay) { localStorage.setItem('gq_loginbonus_seen', today); overlay.classList.remove('open'); }
  };
}
maybeShowLoginBonus();
