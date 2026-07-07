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
  // 目覚めアイテム獲得枠（type='wake' を doSugorokuRoll が検知してオトモン用の目覚めアイテムを付与）
  { id:'wake_gift', name:'目覚めのおくりもの', emoji:'🔆', xp:30, type:'wake' },
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

// 目覚めアイテム枠(wake_gift)などで代替が必要なとき用のボーナスXP
const EQUIPMENT_DUPLICATE_COMPENSATION_XP = 50;

// effect は { type, value, desc } 形。効果は数値バフではなく「体験の変化」：
//   mood / quote_bias / motiv_style / dice_bonus / streak_protect / comment
// imagePath は PNG 用意後に差し替える。null のうちは emoji が表示される。
const ITEM_MASTER = [
  // ── head（頭装備）─────────────────────────────
  { id:'cap_focus',     name:'集中のキャップ',  category:'head', rarity:'common',
    emoji:'🧢', imagePath:'assets/equipment/head/cap_focus.webp',
    effect:{ type:'mood', value:'ember', desc:'タイマーが焚き火の灯に包まれる' },
    flavorText:'被ると、ふと深呼吸したくなる。' },
  { id:'crown_scholar', name:'学者の冠',        category:'head', rarity:'legendary',
    emoji:'👑', imagePath:'assets/equipment/head/crown_scholar.webp',
    effect:{ type:'motiv_style', value:'sage', desc:'ヘッダーの言葉が「賢者の格言」になる' },
    flavorText:'知の頂きに立つ者だけに許された輝き。' },

  // ── body（胴装備）─────────────────────────────
  { id:'vest_adventurer', name:'冒険者のベスト', category:'body', rarity:'common',
    emoji:'🦺', imagePath:'assets/equipment/body/vest_adventurer.webp',
    effect:{ type:'quote_bias', value:'tale', desc:'「物語と英雄」の言葉に出会いやすくなる' },
    flavorText:'走り出す背中を、いつもそっと支える。' },
  { id:'robe_sage',       name:'賢者のローブ',   category:'body', rarity:'rare',
    emoji:'🥋', imagePath:'assets/equipment/body/robe_sage.webp',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'一度結べば、雨の日も心が乾く。' },

  // ── hand（手装備）─────────────────────────────
  { id:'sword_brave',  name:'勇者の剣',         category:'hand', rarity:'rare',
    emoji:'⚔', imagePath:'assets/equipment/hand/sword_brave.webp',
    effect:{ type:'dice_bonus', value:1, desc:'すごろく出目+1' },
    flavorText:'切るのは敵じゃない、迷いだけ。' },
  { id:'staff_wisdom', name:'知恵の杖',         category:'hand', rarity:'epic',
    emoji:'🪄', imagePath:'assets/equipment/hand/staff_wisdom.webp',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'振るたびに、頭の中の霧が晴れていく。' },

  // ── back（背中装備）───────────────────────────
  { id:'bag_explorer', name:'探検家のリュック',  category:'back', rarity:'common',
    emoji:'🎒', imagePath:'assets/equipment/back/bag_explorer.webp',
    effect:{ type:'quote_bias', value:'fable', desc:'「空想の住人」の言葉に出会いやすくなる' },
    flavorText:'今日もどこかへ、何かを掴みに。' },
  { id:'cape_phoenix', name:'不死鳥のマント',    category:'back', rarity:'legendary',
    emoji:'🧥', imagePath:'assets/equipment/back/cape_phoenix.webp',
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
    emoji:'🌙', imagePath:'assets/equipment/head/hood_moonlight.webp',
    effect:{ type:'mood', value:'moonlight', desc:'タイマーが月夜の静けさに包まれる' },
    flavorText:'静かな夜でも、心の灯りは消えない。' },
  { id:'goggles_focus',   name:'集中ゴーグル',      category:'head', rarity:'rare',
    emoji:'🥽', imagePath:'assets/equipment/head/goggles_focus.webp',
    effect:{ type:'mood', value:'deepsea', desc:'タイマーが深海の青に包まれる' },
    flavorText:'余計な景色を閉じて、大事なものだけを見る。' },
  { id:'tiara_starlight', name:'星読みのティアラ',  category:'head', rarity:'epic',
    emoji:'💫', imagePath:'assets/equipment/head/tiara_starlight.webp',
    effect:{ type:'mood', value:'starlight', desc:'タイマーに星々の瞬きが宿る' },
    flavorText:'小さな努力の星座を、未来へつなげる。' },
  { id:'halo_dawn',       name:'夜明けの光輪',      category:'head', rarity:'legendary',
    emoji:'🌅', imagePath:'assets/equipment/head/halo_dawn.webp',
    effect:{ type:'mood', value:'dawn', desc:'タイマーが夜明けの光に包まれる' },
    flavorText:'今日という冒険を、まぶしく始める者の証。' },

  // ── body(追加)─────────────────────────────
  { id:'jacket_morning',      name:'朝活ジャケット',  category:'body', rarity:'common',
    emoji:'🧥', imagePath:'assets/equipment/body/jacket_morning.webp',
    effect:{ type:'motiv_style', value:'morning', desc:'ヘッダーの言葉が「朝の応援」になる' },
    flavorText:'袖を通すだけで、少しだけ早く動き出せる。' },
  { id:'apron_creator',       name:'創作のエプロン',  category:'body', rarity:'rare',
    emoji:'👕', imagePath:'assets/equipment/body/apron_creator.webp',
    effect:{ type:'quote_bias', value:'artist', desc:'「表現者」の言葉に出会いやすくなる' },
    flavorText:'手を動かす人に、ひらめきは降りてくる。' },
  { id:'coat_guardian',       name:'守り人のコート',  category:'body', rarity:'epic',
    emoji:'🛡️', imagePath:'assets/equipment/body/coat_guardian.webp',
    effect:{ type:'streak_protect', value:1, desc:'連続日数1回保護' },
    flavorText:'続けてきた日々を、静かに守る頼もしい一着。' },
  { id:'armor_constellation', name:'星座の軽鎧',      category:'body', rarity:'legendary',
    emoji:'🌌', imagePath:'assets/equipment/body/armor_constellation.webp',
    effect:{ type:'mood', value:'galaxy', desc:'タイマーが銀河の輝きに包まれる' },
    flavorText:'積み重ねた時間が、胸元で星のように輝く。' },

  // ── hand（追加）─────────────────────────────
  { id:'mug_calm',         name:'ひと息のマグ',   category:'hand', rarity:'common',
    emoji:'☕', imagePath:'assets/equipment/hand/mug_calm.webp',
    effect:{ type:'comment', value:'ひと息ついたら、また進もう。', desc:'たまに励ましてくれる' },
    flavorText:'休むことも、前に進むための準備。' },
  { id:'notebook_quest',   name:'冒険者のノート', category:'hand', rarity:'rare',
    emoji:'📓', imagePath:'assets/equipment/hand/notebook_quest.webp',
    effect:{ type:'quote_bias', value:'classic', desc:'「古典・偉人」の言葉に出会いやすくなる' },
    flavorText:'書き残した一行が、明日の道しるべになる。' },
  { id:'compass_momentum', name:'前進のコンパス', category:'hand', rarity:'epic',
    emoji:'🧭', imagePath:'assets/equipment/hand/compass_momentum.webp',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'迷っても大丈夫。進む方角は、もう決まっている。' },
  { id:'lantern_truth',    name:'真理のランタン', category:'hand', rarity:'legendary',
    emoji:'🏮', imagePath:'assets/equipment/hand/lantern_truth.webp',
    effect:{ type:'dice_bonus', value:2, desc:'すごろく出目+2' },
    flavorText:'暗い道でも、学ぶ者の足元だけは照らされる。' },

  // ── back（追加）─────────────────────────────
  { id:'scarf_breeze',       name:'追い風のスカーフ', category:'back', rarity:'common',
    emoji:'🧣', imagePath:'assets/equipment/back/scarf_breeze.webp',
    effect:{ type:'motiv_style', value:'breeze', desc:'ヘッダーの言葉が「そよ風の応援」になる' },
    flavorText:'ほんの少しの追い風が、今日の一歩を軽くする。' },
  { id:'wings_small',        name:'小さな羽',         category:'back', rarity:'rare',
    emoji:'🪽', imagePath:'assets/equipment/back/wings_small.webp',
    effect:{ type:'dice_bonus', value:1, desc:'すごろく出目+1' },
    flavorText:'飛べなくてもいい。昨日より少し浮けばいい。' },
  { id:'cloak_silence',      name:'静寂のクローク',   category:'back', rarity:'epic',
    emoji:'🌫️', imagePath:'assets/equipment/back/cloak_silence.webp',
    effect:{ type:'mood', value:'silence', desc:'タイマーが澄んだ静寂に包まれる' },
    flavorText:'雑音を遠ざけ、集中だけをそっと包み込む。' },
  { id:'wings_phoenix_gold', name:'黄金不死鳥の翼',   category:'back', rarity:'legendary',
    emoji:'🔥', imagePath:'assets/equipment/back/wings_phoenix_gold.webp',
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
    if (itemGained.type === 'wake') {
      const granted = window.Otomon ? window.Otomon.grantRandomWakeItem() : null;
      if (granted) {
        _sgPendingReward = granted;      // 到着マスで演出（即時には出さない）
        message = `🔆 目覚めアイテム「${granted.emoji} ${granted.name}」を入手！ (+${bonusXP} XP)`;
      } else {
        addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
        message = `🔆 目覚めアイテム +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
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
      if (itemGained.type === 'wake') {
        const granted = window.Otomon ? window.Otomon.grantRandomWakeItem() : null;
        if (granted) {
          _sgPendingReward = granted;      // 到着マスで演出（即時には出さない）
          message = `🔆 目覚めアイテム「${granted.emoji} ${granted.name}」を入手！ (+${bonusXP} XP)`;
        } else {
          addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
          message = `🔆 目覚めアイテム +${bonusXP} XP ／ 代替ボーナス +${EQUIPMENT_DUPLICATE_COMPENSATION_XP} XP`;
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
        // 目覚めアイテム枠は“到着マスの特別付与”専用。道中回収では通常アイテムに差し替える
        if (it.type === 'wake') it = SUGOROKU_ITEMS.find(x => x.id === 'study_book') || it;
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
  golden_key:   ['🗝 封印解放',     '目覚めアイテムを1つ入手'],
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
    confirm: '目覚めアイテムを1つ入手（オトモンの卵を起こせる）',
    apply() {
      const g = window.Otomon ? window.Otomon.grantRandomWakeItem() : null;
      if (g) return `🗝 目覚めアイテム「${g.emoji}${g.name}」を入手！`;
      addBonusXP(EQUIPMENT_DUPLICATE_COMPENSATION_XP);
      return `🗝 代わりに +${EQUIPMENT_DUPLICATE_COMPENSATION_XP}XP`;
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
  const all = SUGOROKU_ITEMS.filter(it => it.id !== 'wake_gift');
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

