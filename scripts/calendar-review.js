// ═══════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════
// IIFE外に残す: 仕様§4の急所4。boot.js/settings-genre.js が読み、再代入もある共有状態。
let weeklyReviews;
let rvWeekKey = '';        // 現在開いている週
let rvPeriod = 'week';     // 'day' | 'week' | 'month' | 'custom'
let rvAnchor = new Date(); // 日次/月次の基準日

(function () {
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
let _plannerEditingId = null;
let _plannerDeleteChoiceId = '';

// その予定が、指定日に「出現」するか（繰り返しを展開して判定）
function planOccursOn(task, dateKey) {
  if ((task.skipDates || []).includes(dateKey)) return false;
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
function updatePlannerTask(taskId, text, time, repeat, remind, kind) {
  const t = plannerTasks.find(x => x.id === taskId); if (!t) return;
  t.text = text;
  t.time = time || null;
  t.repeat = repeat || 'none';
  t.kind = kind === 'event' ? 'event' : 'task';
  t.remind = !!(remind && time);
  t.doneDates = t.doneDates || [];
  t.skipDates = t.skipDates || [];
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
function skipPlannerTaskOn(taskId, dateKey) {
  const t = plannerTasks.find(x => x.id === taskId); if (!t) return;
  t.skipDates = t.skipDates || [];
  if (!t.skipDates.includes(dateKey)) t.skipDates.push(dateKey);
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
      <div class="cdp-task-wrap" data-id="${t.id}">
        <div class="cdp-task ${isEvent ? 'is-event' : ''} ${(!isEvent && t.done) ? 'done' : ''}">
          ${lead}
          <button class="cdp-task-main" data-act="edit" title="編集">
            ${t.time ? `<span class="cdp-task-time">${t.time}</span>` : ''}
            <span class="cdp-task-text">${escHtml(t.text)}</span>
            ${t.repeat !== 'none' ? `<span class="cdp-task-rep">🔁${PLAN_REPEAT_LABEL[t.repeat]}</span>` : ''}
          </button>
          ${t.time ? `<button class="cdp-task-bell ${t.remind ? 'on' : ''}" data-act="bell" title="${t.remind ? '通知オン' : '通知オフ'}">${t.remind ? '🔔' : '🔕'}</button>` : ''}
          <button class="cdp-task-del" data-act="del" title="削除">🗑</button>
        </div>
        ${_plannerDeleteChoiceId === t.id ? `<div class="cdp-delete-choices">
          <button data-act="skip-one">⏭ この日だけスキップ</button>
          <button data-act="delete-all">🗑 すべての回を削除</button>
          <button data-act="cancel-del">やめる</button>
        </div>` : ''}
      </div>`;
    }).join('')
    : `<div class="cdp-plan-empty">まだ予定はありません</div>`;

  el.querySelectorAll('.cdp-task-wrap').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-act="check"]')?.addEventListener('click', () => {
      togglePlannerDone(id, dateKey); renderDayPlanner(dateKey); renderCalendar();
    });
    row.querySelector('[data-act="bell"]')?.addEventListener('click', () => {
      togglePlannerRemind(id); renderDayPlanner(dateKey);
    });
    row.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      beginPlannerEdit(id);
    });
    row.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      const t = plannerTasks.find(x => x.id === id);
      if (t && t.repeat !== 'none') {
        _plannerDeleteChoiceId = id;
        renderDayPlanner(dateKey);
        return;
      }
      deletePlannerTask(id); renderDayPlanner(dateKey); renderCalendar();
    });
    row.querySelector('[data-act="skip-one"]')?.addEventListener('click', () => {
      skipPlannerTaskOn(id, dateKey);
      _plannerDeleteChoiceId = '';
      renderDayPlanner(dateKey); renderCalendar();
    });
    row.querySelector('[data-act="delete-all"]')?.addEventListener('click', () => {
      deletePlannerTask(id);
      _plannerDeleteChoiceId = '';
      renderDayPlanner(dateKey); renderCalendar();
    });
    row.querySelector('[data-act="cancel-del"]')?.addEventListener('click', () => {
      _plannerDeleteChoiceId = '';
      renderDayPlanner(dateKey);
    });
  });
}

function setPlannerKind(kind) {
  document.querySelectorAll('.cdp-kind-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kind === kind);
  });
}

function resetPlannerForm(kind = 'task') {
  _plannerEditingId = null;
  _plannerDeleteChoiceId = '';
  const textEl = document.getElementById('cdp-task-text');
  if (textEl) textEl.value = '';
  const timeEl = document.getElementById('cdp-task-time');
  if (timeEl) timeEl.value = '';
  const repEl = document.getElementById('cdp-task-repeat');
  if (repEl) repEl.value = 'none';
  const remindEl = document.getElementById('cdp-task-remind');
  if (remindEl) remindEl.checked = false;
  setPlannerKind(kind);
  const addBtn = document.getElementById('cdp-task-add');
  if (addBtn) addBtn.textContent = '追加';
  const cancelBtn = document.getElementById('cdp-task-cancel');
  if (cancelBtn) cancelBtn.hidden = true;
}

function beginPlannerEdit(taskId) {
  const t = plannerTasks.find(x => x.id === taskId); if (!t) return;
  _plannerEditingId = taskId;
  _plannerDeleteChoiceId = '';
  document.getElementById('cdp-task-text').value = t.text || '';
  document.getElementById('cdp-task-time').value = t.time || '';
  document.getElementById('cdp-task-repeat').value = t.repeat || 'none';
  const remindEl = document.getElementById('cdp-task-remind');
  if (remindEl) remindEl.checked = !!t.remind;
  setPlannerKind(t.kind === 'event' ? 'event' : 'task');
  const addBtn = document.getElementById('cdp-task-add');
  if (addBtn) addBtn.textContent = '保存';
  const cancelBtn = document.getElementById('cdp-task-cancel');
  if (cancelBtn) cancelBtn.hidden = false;
  document.getElementById('cdp-task-text')?.focus();
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
  if (_plannerEditingId) updatePlannerTask(_plannerEditingId, text, time, repeat, remind, kind);
  else addPlannerTask(dk, text, time, repeat, remind, kind);
  resetPlannerForm(kind);
  renderDayPlanner(dk); renderCalendar();
  textEl.focus();
}
document.getElementById('cdp-task-add')?.addEventListener('click', _plannerAddFromForm);
document.getElementById('cdp-task-cancel')?.addEventListener('click', () => resetPlannerForm());
document.getElementById('cdp-task-text')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); _plannerAddFromForm(); }
});
// やること / 予定(イベント) の切り替え（選んだ種別は次の追加でも維持）
document.querySelectorAll('.cdp-kind-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setPlannerKind(btn.dataset.kind || 'task');
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
  resetPlannerForm();
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

weeklyReviews        = loadReviews();
let reviewStatus     = loadReviewStatus();
let rvGoalMins       = 0;
let rvGoalBadge      = '';
let rvViewMode       = 'current'; // 'current' | 'past'
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

function getPrevWeekKey(weekKey) {
  const mon = new Date(weekKey + 'T00:00:00');
  mon.setDate(mon.getDate() - 7);
  return dkey(mon);
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

function buildGoalMeterHTML(weekKey, totalMins) {
  const target = weeklyReviews[getPrevWeekKey(weekKey)]?.goal?.targetMins || 0;
  if (!target) return '';

  const pct = Math.min(100, Math.round((totalMins / target) * 100));
  const achieved = totalMins >= target;
  const status = achieved ? '🎉 目標達成！' : `あと${target - totalMins}分`;
  return `<div class="rv-goal-meter${achieved ? ' achieved' : ''}">
    <div class="rv-goal-head">🎯 先週たてた目標: <strong>${target}分</strong></div>
    <div class="rv-goal-track"><div class="rv-goal-fill" style="width:${pct}%"></div></div>
    <div class="rv-goal-note">${totalMins}分 / ${target}分 <span>${status}</span></div>
  </div>`;
}

function buildStatDeltaHTML(current, previous, suffix, formatValue) {
  const diff = current - previous;
  if (!diff) return '';

  const isUp = diff > 0;
  const sign = isUp ? '+' : '-';
  const value = formatValue ? formatValue(Math.abs(diff)) : `${Math.abs(diff)}${suffix}`;
  return `<div class="rv-stat-delta ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${sign}${value}</div>`;
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

function buildStreakHeatmapSVG(wk) {
  const curMon = new Date(wk + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const W = 300, H = 90, left = 16, top = 17, cell = 8.5, gap = 1.5;
  const colorFor = mins => {
    if (mins >= 60) return 'rgba(6,182,212,.95)';
    if (mins >= 30) return 'rgba(6,182,212,.70)';
    if (mins >= 15) return 'rgba(6,182,212,.45)';
    if (mins >= 1)  return 'rgba(6,182,212,.22)';
    return 'rgba(255,255,255,.055)';
  };
  const monthLabels = [];

  const cells = Array.from({ length: 26 }, (_, col) => {
    const mon = new Date(curMon);
    mon.setDate(curMon.getDate() - 7 * (25 - col));
    const x = left + col * (cell + gap);
    const days = Array.from({ length: 7 }, (_, row) => {
      const day = new Date(mon);
      day.setDate(mon.getDate() + row);
      if (day > today) return '';
      if (day.getDate() === 1) {
        monthLabels.push(`<text x="${x.toFixed(1)}" y="8" fill="rgba(255,255,255,.45)" font-size="7.5" text-anchor="middle">${day.getMonth()+1}月</text>`);
      }
      const key = dkey(day);
      const mins = data.history?.[key] || 0;
      const y = top + row * (cell + gap);
      return `<g class="rv-day-bar" data-dk="${key}" style="cursor:pointer">
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell}" height="${cell}" rx="1.8" fill="${colorFor(mins)}">
          <title>${day.getMonth()+1}/${day.getDate()} ${mins}分</title>
        </rect>
      </g>`;
    }).join('');
    return days;
  }).join('');

  const dowLabels = DOW_LABELS.map((label, row) =>
    `<text x="1" y="${(top + row * (cell + gap) + cell - 1).toFixed(1)}" fill="rgba(255,255,255,.36)" font-size="7">${label}</text>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="rv-chart-svg rv-heatmap-svg">${monthLabels.join('')}${dowLabels}${cells}</svg>
    <div class="rv-heatmap-legend">
      <span>なし</span><span class="rv-heat-dot lv0"></span><span class="rv-heat-dot lv1"></span><span>少し</span><span class="rv-heat-dot lv2"></span><span>ふつう</span><span class="rv-heat-dot lv3"></span><span>しっかり</span><span class="rv-heat-dot lv4"></span>
    </div>`;
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
    <div class="rv-chart-block">
      <div class="rv-chart-cap">🌱 継続の足あと（直近26週）</div>
      ${buildStreakHeatmapSVG(wk)}
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
  const prevAn = analyzeWeek(getPrevWeekKey(rvWeekKey));
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
  const hasPrevStats = (prevAn.totalMins || prevAn.sessions || prevAn.studyDays) > 0;
  const totalDelta = hasPrevStats ? buildStatDeltaHTML(totalMins, prevAn.totalMins, '分', fmtMins) : '';
  const sessionDelta = hasPrevStats ? buildStatDeltaHTML(sessions, prevAn.sessions, '回') : '';
  const dayDelta = hasPrevStats ? buildStatDeltaHTML(studyDays, prevAn.studyDays, '日') : '';

  if (totalMins === 0) {
    html += `<div style="color:var(--text-dim);font-size:.83rem;padding:8px 0;text-align:center;line-height:1.8">
      今週の学習記録がまだありません。<br>少しデータが溜まると分析できます 📈
    </div>`;
  } else {
    html += `<div class="review-stats-grid">
      <div class="review-stat"><div class="review-stat-val">${fmtMins(totalMins)}</div>${totalDelta}<div class="review-stat-lbl">総学習時間</div></div>
      <div class="review-stat"><div class="review-stat-val">${sessions}</div>${sessionDelta}<div class="review-stat-lbl">セッション数</div></div>
      <div class="review-stat"><div class="review-stat-val">${studyDays}/7</div>${dayDelta}<div class="review-stat-lbl">学習日数</div></div>
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
  html += buildGoalMeterHTML(rvWeekKey, totalMins);
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
  // レビュー機能が未解放（4セッション未満）の間は、ドットも自動プロンプトも出さない
  // ※ featUnlocks(boot.js) はこの関数の初回呼び出し時点で未初期化のため、localStorage を直接見る
  try {
    const unlocked = JSON.parse(localStorage.getItem('gq_unlocks') || '[]');
    if (!unlocked.includes('review')) return;
  } catch (e) { return; }
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

window.dkey = dkey;
window.loadCloudUrl = loadCloudUrl;
window.saveCloudUrl = saveCloudUrl;
window.testCloudNotify = testCloudNotify;
window.addPlannerTask = addPlannerTask;
window.renderCalendar = renderCalendar;
window.getWeekKey = getWeekKey;
window.getWeekDates = getWeekDates;
window.dowIndex = dowIndex;
window.analyzeDays = analyzeDays;
window.escHtml = escHtml;
window._ltDateKey = _ltDateKey;
window.renderReviewFooter = renderReviewFooter;
window.buildFruitsSectionHTML = buildFruitsSectionHTML;
window.renderReviewBody = renderReviewBody;
window.checkWeeklyReviewTrigger = checkWeeklyReviewTrigger;
window.DOW_LABELS = DOW_LABELS;
})();
