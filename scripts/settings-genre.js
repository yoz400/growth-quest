// IIFE外に残す: 仕様§4の急所6。外部ファイルが読み書きする状態。
let earnedBadges;
let sessionStartHour;
let lastLevelUp;
let lastStreakMilestone;
let lastAvatarEvolution;
let currentKokuQuote;

(function () {
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
  const avTypeSelect = document.getElementById('set-avatar-type');
  if (avTypeSelect) avTypeSelect.value = avatarType;
}

document.getElementById('settings-btn').addEventListener('click', () => {
  Overlay.open('settings-overlay');
  const cu = document.getElementById('set-cloud-url'); if (cu) cu.value = loadCloudUrl();
  // 冒険者の選択欄は開くたびに現在値へ同期（召喚直後など起動後に変わることがある）
  const av = document.getElementById('set-avatar-type'); if (av) av.value = avatarType;
});
document.getElementById('settings-close-btn').addEventListener('click', () => {
  Overlay.close('settings-overlay');
});
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay'))
    Overlay.close('settings-overlay');
});
document.getElementById('set-cloud-url')?.addEventListener('change', e => saveCloudUrl(e.target.value));
// testCloudNotify は calendar-review.js で定義されるため、読み込み順に依存しないよう遅延参照にする
document.getElementById('cloud-test-btn')?.addEventListener('click', () => testCloudNotify());

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

document.getElementById('set-avatar-type')?.addEventListener('change', e => {
  avatarType = ADVENTURERS[e.target.value] ? e.target.value : 'A';
  saveAvatarType();
  renderAvatarBtn();
  refreshAvatarEquipmentIfOpen();
  applySettings();
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
lastLevelUp         = false;
lastStreakMilestone = false;
lastAvatarEvolution = false;
currentKokuQuote    = null;
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

earnedBadges = loadBadgeData();
sessionStartHour = new Date().getHours();
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

window.applySettings = applySettings;
window.exportAllData = exportAllData;
window.importAllData = importAllData;
window.fixDayRecord = fixDayRecord;
window.runRecordMaintenance = runRecordMaintenance;
window.genreIcon = genreIcon;
window.renderGenreSelector = renderGenreSelector;
window.quickAddGenre = quickAddGenre;
window.quickDeleteGenre = quickDeleteGenre;
window.openGenreModal = openGenreModal;
window.renderGenreList = renderGenreList;
window.showGenreForm = showGenreForm;
window.hideGenreForm = hideGenreForm;
window.saveGenreForm = saveGenreForm;
window.QUOTE_CATS = QUOTE_CATS;
window.SCENE_LABELS = SCENE_LABELS;
window.QUOTES = QUOTES;
window.pickQuote = pickQuote;
window.detectDailyScene = detectDailyScene;
window.SCENE_TAG_LABELS = SCENE_TAG_LABELS;
window.renderDailyQuote = renderDailyQuote;
window.updateDQFavBtn = updateDQFavBtn;
window.updateKokuFavBtn = updateKokuFavBtn;
window.toggleFav = toggleFav;
window.copyQuoteToClipboard = copyQuoteToClipboard;
window.openWordsModal = openWordsModal;
window.renderWordsList = renderWordsList;
window.showWordsForm = showWordsForm;
window.hideWordsForm = hideWordsForm;
window.renderScenePicks = renderScenePicks;
window.saveWordsForm = saveWordsForm;
window.RARITY_LABELS = RARITY_LABELS;
window.CAT_LABELS = CAT_LABELS;
window.checkPerfectWeek = checkPerfectWeek;
window.BADGES = BADGES;
window.loadBadgeData = loadBadgeData;
window.saveBadgeData = saveBadgeData;
window.checkBadges = checkBadges;
window.showNextBadgeToast = showNextBadgeToast;
window.openBadgesModal = openBadgesModal;
window.renderBadgeGrid = renderBadgeGrid;
window.EMOJI_OPTIONS = EMOJI_OPTIONS;
window.COLOR_OPTIONS = COLOR_OPTIONS;
window.SUSPICIOUS_DAY_MIN = SUSPICIOUS_DAY_MIN;
})();
