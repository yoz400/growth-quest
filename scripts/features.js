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
