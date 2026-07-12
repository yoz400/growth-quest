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

GQ.on('session:complete', () => completeQuest('complete_session'));

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
