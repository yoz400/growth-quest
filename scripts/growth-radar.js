// 表示専用。既存のジャンル・履歴を読み、保存データには書き込まない。
(function () {
  'use strict';
  let page = 0, days = 30, selected = null;
  const size = 6;
  const num = value => Number.isFinite(value) && value >= 0 ? value : 0;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function level(xp) {
    // xpForLevel(lv) = lv * 100。累積閾値を逆算（ゲームの状態は変えない）。
    return Math.floor((1 + Math.sqrt(1 + 8 * num(xp) / 100)) / 2);
  }
  function stats(list, history, now, offset) {
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const cutoff = dateKey(target), today = dateKey(now);
    const entries = Object.entries(history || {}).filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= today);
    return { cutoff, rows: list.map(g => {
      const xp = num(g.xp), minutes = num(g.minutes);
      const records = entries.filter(([, v]) => v && v.genres && Object.prototype.hasOwnProperty.call(v.genres, g.id));
      const valid = records.every(([, v]) => Number.isFinite(v.genres[g.id]) && v.genres[g.id] >= 0);
      const total = records.reduce((sum, [, v]) => sum + num(v.genres[g.id]), 0);
      const available = valid && records.some(([key]) => key <= cutoff) && Math.abs(total - minutes) < 0.000001 && Math.abs(total - xp) < 0.000001;
      const past = available ? records.filter(([key]) => key <= cutoff).reduce((sum, [, v]) => sum + v.genres[g.id], 0) : null;
      return { id: g.id, name: g.name, xp, minutes, level: level(xp), past, pastLevel: past === null ? null : level(past) };
    }) };
  }
  function render() {
    const host = document.getElementById('avatar-growth');
    if (!host) return;
    const model = stats(genres, data.historyDetails, new Date(), days);
    page = Math.min(page, Math.max(0, Math.ceil(model.rows.length / size)-1));
    const rows = model.rows.slice(page*size, (page+1)*size);
    if (!model.rows.some(r => r.id === selected)) selected = rows[0]?.id;
    const scale = Math.max(100, Math.ceil(Math.max(0, ...model.rows.map(r => r.xp)) / 100) * 100);
    host.replaceChildren();
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const button = (text, fn) => { const b = el('button', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    host.append(el('h3', '✧ 成長の星図'));
    host.append(el('p', '積み重ねた学びは、休んでも減りません。', 'growth-muted'));
    const controls = el('div', undefined, 'growth-controls');
    const label = el('label', '比較する記録 '), select = el('select');
    [30,90].forEach(d => { const o = el('option', `${d}日前`); o.value = d; select.append(o); });
    select.value = days;
    select.addEventListener('change', () => { days = Number(select.value); render(); host.querySelector('select').focus(); });
    label.append(select); controls.append(label); host.append(controls);
    host.append(el('p', `● 現在　 ◇ ${model.cutoff} 終了時点`, 'growth-legend'));
    if (!rows.length) { host.append(el('p', 'ジャンルを登録すると成長を表示します。')); return; }
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox','0 0 320 280'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',`ジャンル別累積XP。外周 ${scale} XP。詳細は下のジャンルボタンで選択できます。`);
    const shape = (tag, attrs) => { const n = document.createElementNS(svgNS,tag); Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v)); svg.append(n); return n; };
    const point = (i, value) => { const angle = i * Math.PI*2/rows.length-Math.PI/2; return [160+90*value/scale*Math.cos(angle),140+90*value/scale*Math.sin(angle)]; };
    if (rows.length >= 3) {
      [0.25,0.5,0.75,1].forEach(f => shape('polygon',{points: rows.map((_,i)=>point(i,scale*f).join(',')).join(' '), class:'growth-grid'}));
      rows.forEach((r,i)=> { const p=point(i,scale); shape('line',{x1:160,y1:140,x2:p[0],y2:p[1],class:'growth-grid'}); });
      shape('polygon',{points:rows.map((r,i)=>point(i,r.xp).join(',')).join(' '),class:'growth-now'});
      // 未知の頂点を0扱いして多角形を作らない。完全な場合のみ線を結ぶ。
      if (rows.every(r=>r.past !== null)) shape('polygon',{points:rows.map((r,i)=>point(i,r.past).join(',')).join(' '),class:'growth-past'});
      rows.forEach((r,i)=> {
        if (r.past !== null) { const p=point(i,r.past); shape('circle',{cx:p[0],cy:p[1],r:4,class:'growth-past'}); }
        const p=point(i,r.xp); shape('circle',{cx:p[0],cy:p[1],r:4,class:'growth-dot'});
        const a=point(i,scale*1.3), t=shape('text',{x:a[0],y:a[1],class:'growth-axis','text-anchor':'middle',tabindex:0,role:'button','aria-label':r.name});
        t.textContent = Array.from(r.name).slice(0,8).join('')+(Array.from(r.name).length>8?'…':'');
        t.addEventListener('click',()=>choose(r.id)); t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(r.id);}});
      });
      host.append(svg);
    } else {
      rows.forEach(r=> { const wrap=el('div',undefined,'growth-bar'); wrap.append(el('span',`${r.name} · ${r.xp} XP`)); const meter=el('meter'); meter.min=0;meter.max=scale;meter.value=r.xp;meter.setAttribute('aria-label',r.name+' 累積XP');wrap.append(meter); if(r.past!==null) wrap.append(el('small',`◇ ${r.past} XP`));host.append(wrap); });
    }
    host.append(el('p', `共通目盛り：0〜${scale} XP${rows.length<3?' · 3ジャンルからレーダー表示':''}`, 'growth-muted'));
    const choices=el('div',undefined,'growth-choices');
    rows.forEach(r=> { const b=button(r.name,()=>choose(r.id)); b.setAttribute('aria-pressed',String(r.id===selected));choices.append(b); });host.append(choices);
    if(model.rows.length>size){const nav=el('div',undefined,'growth-controls');const prev=button('← 前',()=>{page--;selected=model.rows[page*size].id;render();});prev.disabled=page===0;const next=button('次 →',()=>{page++;selected=model.rows[page*size].id;render();});next.disabled=(page+1)*size>=model.rows.length;nav.append(prev,el('span',`${page+1} / ${Math.ceil(model.rows.length/size)}`),next);host.append(nav);}
    const r=model.rows.find(r=>r.id===selected) || rows[0];
    const detail=el('div',undefined,'growth-detail');detail.setAttribute('aria-live','polite');
    detail.append(el('h4',r.name),el('p',`Lv ${r.level}　·　${r.xp.toLocaleString()} XP　·　${r.minutes.toLocaleString()} 分`));
    detail.append(el('p',r.past===null ? `${days}日前：履歴不足のため比較できません。` : `${days}日前：Lv ${r.pastLevel} · ${r.past.toLocaleString()} XP · ${r.past.toLocaleString()} 分 → +${(r.xp-r.past).toLocaleString()} XP`, 'growth-muted'));host.append(detail);
    host.append(el('p','レベルは累積ジャンルXPと既存の必要XP規則から算出。日別履歴と累計を照合できる場合のみ過去を表示します。全体XPの倍率ボーナスは含みません。','growth-muted'));
  }
  function choose(id) { selected=id; render(); document.querySelector('#avatar-growth button[aria-pressed="true"]')?.focus({preventScroll:true}); }
  window.GQGrowth = { render, stats, level };
})();
