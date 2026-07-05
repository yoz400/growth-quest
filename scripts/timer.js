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

// ── 誤操作リロード対策：実行中/一時停止中の状態をこまめに保存し、
//    次回起動時に自動復元する（下スワイプ更新・戻るボタン誤操作・アプリのkill等）
const TIMER_SESSION_KEY = 'gq_timer_session';
function saveTimerSession() {
  if (timerState === 'idle') { localStorage.removeItem(TIMER_SESSION_KEY); return; }
  localStorage.setItem(TIMER_SESSION_KEY, JSON.stringify({
    state: timerState, mode: currentMode,
    startWall: timerStartWall, pausedSec: timerPausedSec,
    sessionStartHour: sessionStartHour,
  }));
}
function clearTimerSession() { localStorage.removeItem(TIMER_SESSION_KEY); }

function restoreTimerSession() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(TIMER_SESSION_KEY) || 'null'); } catch (e) { saved = null; }
  if (!saved || (saved.state !== 'running' && saved.state !== 'paused')) return;

  currentMode = MODES[saved.mode] ? saved.mode : currentMode;
  sessionStartHour = typeof saved.sessionStartHour === 'number' ? saved.sessionStartHour : new Date().getHours();
  timerPausedSec = saved.pausedSec || 0;
  timerStartWall = saved.state === 'running' ? saved.startWall : null;
  timerState = saved.state;

  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === currentMode));
  startBtn.textContent = saved.state === 'running' ? '一時停止' : '▶ 再開';
  startBtn.classList.toggle('running', saved.state === 'running');
  stopBtn.style.display = 'inline-flex';

  startAnim();
  if (saved.state === 'paused') pauseAnim();
  tick();   // 表示・ゲージを即座に正しい値へ（超過分はここで自動的にセッション完了へ）

  if (saved.state === 'running' && timerState === 'running') {
    intervalId = setInterval(tick, 1000);
    requestNotifPermission();
  }
}

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
    saveTimerSession();

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
    saveTimerSession();

  } else if (timerState === 'paused') {
    // ── RESUME ──
    timerStartWall = Date.now();
    timerState = 'running';
    startBtn.textContent = '一時停止';
    startBtn.classList.add('running');
    resumeAnim();
    intervalId = setInterval(tick, 1000);
    saveTimerSession();
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
  clearTimerSession();
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
    clearTimerSession();
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

