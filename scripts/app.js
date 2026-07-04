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
  // ログインボーナス等が開いている間は重ねずに待ち、閉じてから登場する
  if (!force && Overlay.topId() && Overlay.topId() !== 'guide-tutorial-overlay') {
    setTimeout(() => openGuideTutorial(), 800);
    return;
  }
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
    A:'assets/avatar/adventurer-a-fixed.webp',
    B:'assets/avatar/adventurer-b-fixed-v3.webp',
    C:'assets/avatar/adventurer-c-fixed.webp'
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
const ADVENTURERS = {
  A: { fallback: 'レン', title: '凜々しい剣士', role: '剣士', desc: 'まっすぐ突き進む努力家' },
  B: { fallback: 'ミア', title: '聡明な魔法使い', role: '魔法使い', desc: 'コツコツ積み上げる知性派' },
  C: { fallback: 'ソラ', title: '旅する吟遊詩人', role: '吟遊詩人', desc: '自由に楽しく続ける自由人' },
};

let avatarType = localStorage.getItem('gq_av_type') || 'A';
function saveAvatarType() { localStorage.setItem('gq_av_type', avatarType); }

function adventurerName(type = avatarType) {
  const nm = (playerName || '').trim();
  return nm || ADVENTURERS[type]?.fallback || '冒険者';
}

function adventurerMeta(type = avatarType) {
  return ADVENTURERS[type] || ADVENTURERS.A;
}

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
  A: { src: 'assets/avatar/adventurer-a-face.webp' },
  B: { src: 'assets/avatar/adventurer-b-face-v3.webp' },
  C: { src: 'assets/avatar/adventurer-c-face.webp' },
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

  // 選択中の冒険者だけを表示。変更は設定画面に集約する。
  const typeSel = document.getElementById('avatar-type-selector');
  const meta = adventurerMeta();
  typeSel.innerHTML = `
    <div class="av-current-card">
      <div class="av-type-label">あなたの冒険者</div>
      <div class="av-current-name">${escHtml(adventurerName())}</div>
      <div class="av-current-title">${escHtml(meta.title)}</div>
      <div class="av-current-desc">${escHtml(meta.desc)}</div>
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
  { key:'guild',     emoji:'🏰', label:'冒険者ギルド',    hint:'はじめての集中を1回終えると解放', cond:() => (data.sessions||0) >= 1 },
  { key:'board',     emoji:'🎲', label:'すごろく',        hint:'はじめての集中を1回終えると解放', cond:() => (data.sessions||0) >= 1 },
  { key:'badges',    emoji:'🏅', label:'バッジ',          hint:'はじめてのバッジを獲得すると解放', cond:() => Object.keys(earnedBadges||{}).length >= 1 },
  { key:'equipment', emoji:'🎒', label:'装備',            hint:'アイテムを1つ手に入れると解放', cond:() => (typeof inventory!=='undefined' && inventory.length >= 1) },
  { key:'skill',     emoji:'🌳', label:'スキルツリー',    hint:'成長の実を1つ実らせると解放', cond:() => (typeof skillData!=='undefined' && Object.keys(skillData).length >= 1) },
  { key:'timelog',   emoji:'⏱',  label:'1日のタイムログ', hint:'2日分の学習記録がつくと解放', cond:() => Object.keys(data.history||{}).filter(k=>data.history[k]>0).length >= 2 },
  { key:'review',    emoji:'📊', label:'週次レビュー',    hint:'集中セッションを4回終えると解放', cond:() => (data.sessions||0) >= 4 },
];

function applyFeatureVisibility() {
  UNLOCK_DEFS.forEach(def => {
    const btn = document.querySelector(`[data-unlock="${def.key}"]`);
    if (!btn) return;
    const unlocked = featUnlocks.has(def.key);
    btn.classList.toggle('feat-locked', !unlocked);
    const label = btn.querySelector('.icon-btn-label');
    if (label) label.textContent = unlocked ? (btn.dataset.navLabel || def.label) : '？？？';
    btn.setAttribute('aria-label', unlocked ? def.label : 'ロック中の機能（タップで解放条件を表示）');
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

function showLockedHintToast(def) {
  const t = document.getElementById('confidence-toast');
  if (!t) return;
  t.innerHTML = `🔒 まだ見ぬ機能<br><span style="opacity:.9;font-weight:700">${def.hint}</span>`;
  t.classList.remove('levelup');
  t.classList.add('multiline');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('multiline'), 400);
  }, 3000);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.feat-locked[data-unlock]');
  if (!btn) return;
  e.stopPropagation();
  e.preventDefault();
  const def = UNLOCK_DEFS.find(d => d.key === btn.dataset.unlock);
  if (def) showLockedHintToast(def);
}, true);

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
  { key:'welcome', icon:'⚔',  img:'assets/guide-fairy-smile.webp', title:'Growth Quest へようこそ',
    body:'ここは、学習や自己成長が <b>冒険</b> になる世界。<br>あなたの努力が経験値になり、レベルが上がり、世界が広がっていきます。<br>まずは、あなたのキャラクターを選びましょう。' },
  { key:'char',    icon:'🧝', img:'assets/guide-fairy-smile.webp', title:'冒険者を選ぶ',
    body:'あなたといっしょに歩む冒険者を選んでください。<br><span style="opacity:.7;font-size:.82em">（あとから設定で変えられます）</span>' },
  { key:'name',    icon:'✍️', img:'assets/guide-fairy-calm.webp', title:'冒険者の名前',
    body:'なんと呼べばいい？<br>あなたの冒険者名を教えてください。' },
  { key:'ritual',  icon:'✨', img:'assets/guide-fairy-joy.webp', title:'召喚の儀', body:'' },   // body は名前から動的生成
  { key:'genre',   icon:'📚', img:'assets/guide-fairy-smile.webp', title:'使命 ①　育てる力を選ぶ',
    body:'これから冒険で育てたいテーマを選びましょう。<br><span style="opacity:.7;font-size:.82em">（複数OK・あとから追加変更できます）</span>' },
  { key:'build',   icon:'🌱', img:'assets/guide-fairy-joy.webp', title:'使命 ②　身につけたい習慣',
    body:'冒険を通して <b>習慣にしたいこと</b> はありますか？<br><span style="opacity:.7;font-size:.82em">小さなことでOK。無ければ空のままでも進めます。</span>' },
  { key:'quit',    icon:'🔥', img:'assets/guide-fairy-think.webp', title:'使命 ③　断ちたい習慣',
    body:'逆に、<b>やめたい・減らしたい習慣</b> はありますか？<br><span style="opacity:.7;font-size:.82em">例：「寝る前のだらだらスマホ」。無ければ空でOK。</span>' },
  { key:'creed',   icon:'🌟', img:'assets/guide-fairy-calm.webp', title:'冒険者の心得',
    body:'・5分でもOK。<b>始めた時点で前進</b> です。<br>・完了すると XP・すごろく・装備・バッジで成長が見えます。<br>・<b>自信は、小さな行動の積み重ね</b> から育ちます。' },
  { key:'start',   icon:'⚔',  img:'assets/guide-fairy-joy.webp', title:'', body:'準備は整いました。<br>あなたの冒険を、始めましょう！' },  // title は名前から動的生成
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
    const types = ['A', 'B', 'C'];
    slot.innerHTML = `<div class="summon-char-grid">${types.map(t => {
      const meta = adventurerMeta(t);
      const selected = summonDraft.avType === t;
      return `<button class="summon-char-btn${selected ? ' selected' : ''}" data-summon-char="${t}" aria-pressed="${selected ? 'true' : 'false'}">
        <span class="summon-char-check" aria-hidden="true">✓</span>
        <div class="summon-char-pic" style="background-image:url('${(AV_FACE_FRAME[t] || AV_FACE_FRAME.A).src}');background-size:${(SUMMON_CHAR_FRAME[t]||{}).size||'cover'};background-position:${(SUMMON_CHAR_FRAME[t]||{}).pos||'center top'}"></div>
        <div class="summon-char-name">${escHtml(meta.title)}</div>
        <div class="summon-char-desc">${escHtml(meta.desc)}</div>
      </button>`;
    }).join('')}</div>`;
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
  const summonName = nm || adventurerName(summonDraft.avType);
  const summonMeta = adventurerMeta(summonDraft.avType);

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
    body = `<b>${escHtml(summonName)}</b> よ。<br>`
      + 'Growth Quest の世界へ、ようこそ。<br>いま、あなたに3つの <b>使命</b> を授けます。';
  } else if (step.key === 'start') {
    title = `いざ、${escHtml(summonName)}の冒険へ`;
    body = `ようこそ、${summonMeta.role}${escHtml(summonName)}。<br>準備は整いました。<br>あなたの冒険を、始めましょう！`;
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
  const nm = adventurerName();
  const hd = card.querySelector('.mc-header');
  if (hd) hd.textContent = `⚔ ${nm}の使命`;
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
  const nm = adventurerName();
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
    <div class="lb-badge">${gicon} ${gtext}、${escHtml(nm)}</div>
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
    Overlay.close('login-bonus-overlay');
    overlay.classList.remove('lb-claiming');
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
  Overlay.open('login-bonus-overlay');
  // 背景タップで閉じる（受け取らずに閉じても、その日は再表示しない）
  overlay.onclick = (e) => {
    if (e.target === overlay) { localStorage.setItem('gq_loginbonus_seen', today); Overlay.close('login-bonus-overlay'); }
  };
}
maybeShowLoginBonus();
