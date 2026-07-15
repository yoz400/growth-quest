// IIFE外に残す: 仕様§4の急所10。外部ファイルが読み書きする状態。
let skillNotes;
let skillData;
let pendingNewSkills;
let skillTreeAnimated;
let _confPending;
let _confFlushTimer;
let praiseLogs;
let _pendingPraisePrompt;
let _praiseSessionDate;
let _praiseSessionGenre;

(function () {
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
skillNotes = loadSkillNotes();

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

skillData = loadSkillData();
pendingNewSkills = [];
skillTreeAnimated = false;

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

_confPending = { amount: 0, lastMsg: '', levelUp: 0 };
_confFlushTimer = null;

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
praiseLogs = loadPraiseLogs();

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
_pendingPraisePrompt = false;
_praiseSessionDate   = '';
_praiseSessionGenre  = '';

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

window.SKILL_THRESHOLDS = SKILL_THRESHOLDS;
window.addSkillFruit = addSkillFruit;
window.xpForLevel = xpForLevel;
window.addXP = addXP;
window.renderXP = renderXP;
window.setHeaderMotivation = setHeaderMotivation;
window.CONFIDENCE_MESSAGES = CONFIDENCE_MESSAGES;
window.addConfidence = addConfidence;
window.showConfidenceLevelUp = showConfidenceLevelUp;
window.renderConfidence = renderConfidence;
window.addDailyConfidenceOnce = addDailyConfidenceOnce;
window.openPraiseModal = openPraiseModal;
window.closePraiseModal = closePraiseModal;
window.openFairyModal = openFairyModal;
window.closeFairyModal = closeFairyModal;
window.getPraiseLogsForWeek = getPraiseLogsForWeek;
})();
