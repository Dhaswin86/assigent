/* Assigent page logic: office view, story, team pages, live updates.
   The 3D scenes live in office3d.js. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = t => (window.marked && window.DOMPurify) ? DOMPurify.sanitize(marked.parse(t, { gfm: true })) : '<pre>' + esc(t) + '</pre>';
const fmtTime = t => t ? t.slice(11, 16) : '';
const dur = (a, b) => {
  if (!a) return '';
  const s = Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 1000));
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
};
const size = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
setInterval(() => {
  $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.querySelectorAll('.el[data-start]').forEach(el => { el.textContent = dur(el.dataset.start); });
}, 1000);

// Three workers per team, each an animated icon from /icons (worker 1 uses the team's base icon)
const WORKERS = {
  analyst: [['analyst', 'brief reader'], ['analyst-2', 'planner'], ['analyst-3', 'question sorter']],
  finder:  [['finder', 'web searcher'], ['finder-2', 'doc reader'], ['finder-3', 'source filer']],
  builder: [['builder', 'maker'], ['builder-2', 'coder'], ['builder-3', 'tester']],
  evaluator: [['evaluator', 'rubric checker'], ['evaluator-2', 'fact checker'], ['evaluator-3', 'scorer']],
};
const ICONS = {}, INNER = {};
const iconsReady = Promise.all(Object.values(WORKERS).flat().map(([file]) =>
  fetch('/icons/' + file + '.svg').then(r => r.ok ? r.text() : '').then(t => {
    ICONS[file] = t;
    INNER[file] = t.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }).catch(() => {})));

const TEAM = {
  analyst: { top: '#8fb59a', left: '#6b9478', right: '#7aa086', dot: '#5fa377', verb: 'Analysing' },
  finder:  { top: '#86a8cf', left: '#6283ab', right: '#7093bb', dot: '#5b8fc9', verb: 'Searching' },
  builder: { top: '#e0bd77', left: '#b99752', right: '#caa862', dot: '#d9a531', verb: 'Building' },
  evaluator: { top: '#b9a0cf', left: '#927aab', right: '#a48bbb', dot: '#a17bc4', verb: 'Marking' },
};
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
let spinI = 0;
setInterval(() => { spinI = (spinI + 1) % SPIN.length; document.querySelectorAll('.spin').forEach(el => el.textContent = SPIN[spinI]); }, 120);

function logItems(text) {
  return (text || '').split('\n').filter(l => /^\s*[-*]\s+/.test(l)).map(l => {
    const m = l.replace(/^\s*[-*]\s+/, '').match(/^\*\*(.+?)\*\*\s*(.*)$/);
    return m ? { n: m[1], t: m[2] } : { n: '', t: l.replace(/^\s*[-*]\s+/, '') };
  });
}

// Real numbers per agent, read from its files
function metrics(s, a) {
  const out = a.outputText || '';
  if (a.id === 'analyst') {
    const items = (out.match(/^\s*- \[[ xX]\]/gm) || []).length;
    const blocking = /BLOCKING:\s*yes/i.test(out) ? 'yes' : out ? 'no' : '–';
    return [['checklist items', items || '–'], ['blocking', blocking]];
  }
  if (a.id === 'finder') {
    const urls = new Set(out.match(/https?:\/\/[^\s)>\]]+/g) || []);
    const gaps = (out.split(/^##\s*Gaps.*$/im)[1] || '').split(/^##\s/m)[0];
    return [['sources found', urls.size || '–'], ['gaps', out ? (gaps.match(/^\s*[-*]\s+/gm) || []).length : '–']];
  }
  if (a.id === 'evaluator') {
    const v = verdict(out);
    return [['score', v.score === null ? '–' : `${v.score} / 100`], ['verdict', v.verdict || '–'], ['must fix', out ? v.fixes : '–']];
  }
  const del = s.files.filter(f => f.path.startsWith('deliverables/')).length;
  const all = (out.match(/^\s*- \[[ xX]\]/gm) || []).length, ticked = (out.match(/^\s*- \[[xX]\]/gm) || []).length;
  return [['deliverables', del || '–'], ['checks ticked', all ? `${ticked} / ${all}` : '–']];
}

// The evaluator's marks, read from evaluation.md
function verdict(out) {
  const sc = (out || '').match(/^Score:\s*(\d+)\s*\/\s*100/im), vd = (out || '').match(/^Verdict:\s*(PASS|REVISE)/im);
  const must = ((out || '').split(/^##\s*Must fix.*$/im)[1] || '').split(/^##\s/m)[0];
  return { score: sc ? +sc[1] : null, verdict: vd ? vd[1].toLowerCase() : '', fixes: (must.match(/^\s*(\d+\.|[-*])\s+\S/gm) || []).length };
}

/* ---------- isometric drawing ---------- */
const P = (cx, cy, i, j) => [cx + (i - j), cy + (i + j) / 2];
const pts = arr => arr.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
function isoBox(cx, cy, w, d, h, top, left, right, cls = '') {
  const a = P(cx, cy, -w / 2, -d / 2), b = P(cx, cy, w / 2, -d / 2), c = P(cx, cy, w / 2, d / 2), e = P(cx, cy, -w / 2, d / 2);
  const up = p => [p[0], p[1] - h];
  return `<g class="${cls}"><polygon class="face" points="${pts([e, c, up(c), up(e)])}" fill="${left}"/>
    <polygon class="face" points="${pts([c, b, up(b), up(c)])}" fill="${right}"/>
    <polygon class="face" points="${pts([up(a), up(b), up(c), up(e)])}" fill="${top}"/></g>`;
}
const critterSym = `<symbol id="crit" viewBox="-2 0 12 8" shape-rendering="crispEdges">
  <rect x="0" y="0" width="8" height="6" fill="#d97757"/><rect x="-2" y="2" width="2" height="2" fill="#d97757"/><rect x="8" y="2" width="2" height="2" fill="#d97757"/>
  <rect x="0" y="6" width="1" height="2" fill="#d97757"/><rect x="2" y="6" width="1" height="2" fill="#d97757"/><rect x="5" y="6" width="1" height="2" fill="#d97757"/><rect x="7" y="6" width="1" height="2" fill="#d97757"/>
  <rect x="2" y="1" width="1" height="1" fill="#111522"/><rect x="5" y="1" width="1" height="1" fill="#111522"/></symbol>`;

// Scene layout (viewBox 1000 x 640)
const HUB = { x: 500, y: 350, s: 66 };
const SPOTS = {
  analyst:   { x: 215, y: 250, s: 140, card: [36, 6, 190, 150] },
  finder:    { x: 785, y: 250, s: 140, card: [774, 6, 190, 150] },
  builder:   { x: 785, y: 560, s: 140, card: [503, 470, 160, 150] },
  evaluator: { x: 215, y: 560, s: 140, card: [337, 470, 160, 150] },
};

function props(id, cx, cy, t) {
  if (id === 'analyst') return isoBox(cx + 30, cy + 4, 16, 14, 5, '#f4efe4', '#cfc6b4', '#e2dace', 'paper-flip')
    + isoBox(cx + 30, cy - 1, 16, 14, 4, '#ffffff', '#d8d0c0', '#ece6da')
    + isoBox(cx - 34, cy + 16, 10, 10, 18, '#7a5a3b', '#5a412a', '#6b4e33') + `<circle cx="${cx - 34}" cy="${cy - 2}" r="9" fill="#4f8a5b"/>`;
  if (id === 'finder') return isoBox(cx + 2, cy - 8, 4, 22, 20, '#3a3f48', '#2a2e35', '#30353d')
    + `<polygon class="screen-glow" points="${pts([P(cx + 4, cy - 8, 0, -10), P(cx + 4, cy - 8, 0, 10), [P(cx + 4, cy - 8, 0, 10)[0], P(cx + 4, cy - 8, 0, 10)[1] - 17], [P(cx + 4, cy - 8, 0, -10)[0], P(cx + 4, cy - 8, 0, -10)[1] - 17]])}" fill="#7fb2ff"/>`
    + isoBox(cx + 34, cy + 12, 12, 12, 26, '#566278', '#3c4556', '#485366');
  if (id === 'evaluator') return isoBox(cx + 32, cy + 6, 18, 14, 5, '#f4efe4', '#cfc6b4', '#e2dace')
    + `<path d="M${cx + 26} ${cy - 1} l4 4 l8 -9" stroke="#3f8f5a" stroke-width="2.4" fill="none"/>`
    + isoBox(cx - 36, cy + 14, 10, 10, 16, '#c59cf0', '#845a9c', '#9a6fb5');
  return isoBox(cx + 30, cy + 10, 14, 14, 9, '#d9a066', '#a87440', '#c0874f') + isoBox(cx + 44, cy + 3, 14, 14, 9, '#d9a066', '#a87440', '#c0874f')
    + isoBox(cx + 37, cy - 3, 14, 14, 9, '#e3ad75', '#a87440', '#c0874f', 'drop')
    + isoBox(cx - 36, cy + 14, 14, 10, 6, '#e9b949', '#b28a2e', '#cfa23c');
}

function island(s, a, idx) {
  const sp = SPOTS[a.id], T = TEAM[a.id], half = sp.s / 2;
  const top = [P(sp.x, sp.y, -half, -half), P(sp.x, sp.y, half, -half), P(sp.x, sp.y, half, half), P(sp.x, sp.y, -half, half)];
  const plantAt = P(sp.x, sp.y, -half + 9, half - 9);
  const plant = isoBox(plantAt[0], plantAt[1], 9, 9, 9, '#6b4e33', '#4d3825', '#5c4430')
    + `<circle cx="${plantAt[0]}" cy="${plantAt[1] - 16}" r="8" fill="#3f8a55"/><circle cx="${plantAt[0] + 5}" cy="${plantAt[1] - 21}" r="5" fill="#57a86b"/>`;
  // three workstations: back-left, back-right, front-centre (drawn back to front)
  const spots = [[-64, -4], [64, -4], [0, 38]];
  const W = 86;
  const workers = WORKERS[a.id].map(([file, role], k) => {
    const [dx, dy] = spots[k], ax = sp.x + dx, ay = sp.y + dy;
    const tagW = role.length * 4.9 + 10;
    return `<g class="wk">
      <svg class="worker" x="${ax - W / 2}" y="${ay - W + 6}" width="${W}" height="${W}" viewBox="0 0 32 32" shape-rendering="crispEdges"
        style="--d:${-(k * 1.37 + idx * .61).toFixed(2)}s">${INNER[file] || ''}</svg>
      <rect class="lbl-bg" x="${ax - tagW / 2}" y="${ay - W - 2}" width="${tagW}" height="11" rx="3"/>
      <text class="lbl role" x="${ax}" y="${ay - W + 6}" text-anchor="middle">${esc(role)}</text>
    </g>`;
  }).join('');
  return `<g class="isl s-${a.state}" data-go="${a.id}">
    ${isoBox(sp.x, sp.y + 14, sp.s, sp.s, 14, T.top, T.left, T.right)}
    <polygon class="sel-ring" points="${pts(top)}"/>
    ${plant}${workers}
    <text class="zz" x="${sp.x + 10}" y="${sp.y - 48}">z</text><text class="zz z2" x="${sp.x + 18}" y="${sp.y - 56}">Z</text>
    <g class="done-flag"><circle cx="${sp.x}" cy="${sp.y - 74}" r="7" fill="#3f8f5a"/><path d="M${sp.x - 3} ${sp.y - 74} l2 2.4 l4 -4.6" stroke="#fff" stroke-width="1.6" fill="none"/></g>
  </g>`;
}

function card(s, a) {
  const [x, y, w, h] = SPOTS[a.id].card;
  return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="card s-${a.state}" data-go="${a.id}">${cardBody(s, a)}</div></foreignObject>`;
}
function cardBody(s, a) {
  const T = TEAM[a.id], m = metrics(s, a);
  const steps = logItems(a.logText).length;
  const doing = a.state === 'running' ? 1 : 0, next = a.state === 'waiting' ? 1 : 0;
  const st = a.state === 'running' ? `<span class="ic spin">${SPIN[spinI]}</span><span>${T.verb}… <span style="color:var(--faint)" class="el" data-start="${esc(a.started)}">${dur(a.started)}</span></span>`
    : a.state === 'done' ? `<span class="ic">⏺</span><span>Done in ${dur(a.started, a.finished)}</span>`
    : a.state === 'skipped' ? '<span class="ic">⊘</span><span>Skipped</span>' : '<span class="ic" style="color:var(--faint)">○</span><span style="color:var(--faint)">Waiting</span>';
  return `
      <div class="t"><span class="d" style="background:${T.dot}"></span>${esc(a.label)}</div>
      <div class="big"><b>${steps}</b><span>steps</span></div>
      ${m.map(([k, v]) => `<div class="m"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
      <div class="dnd"><span>doing<b>${doing}</b></span><span>next<b>${next}</b></span><span>done<b>${a.state === 'done' ? steps : Math.max(0, steps - doing)}</b></span></div>
      <div class="st">${st}</div>`;
}

function office(s) {
  const ag = s.agents, busy = ag.some(a => a.state === 'running');
  const roads = ag.map(a => {
    const sp = SPOTS[a.id], d = `M${HUB.x} ${HUB.y} L${sp.x} ${sp.y}`;
    return `<path class="road" d="${d}" stroke-width="26"/><path class="road-line" d="${d}" stroke-width="1.5"/>
      ${a.state === 'running' ? `<path class="road-flow" d="${d}"/><circle class="packet" r="4.5"><animateMotion dur="1.8s" repeatCount="indefinite" path="${d}"/></circle>` : ''}`;
  }).join('');
  const nets = ag.map(a => {
    const sp = SPOTS[a.id], [x, y, w, h] = sp.card, cx = x + w / 2, cy = y + h;
    const ty = cy > sp.y ? y : cy;
    return `<path class="net ${a.state === 'running' ? 'on' : ''}" d="M${HUB.x} ${HUB.y - 24} Q ${(HUB.x + cx) / 2} ${Math.min(HUB.y, ty) - 60} ${cx} ${ty}"/>
      <path class="net" d="M${sp.x} ${sp.y - 40} L${cx} ${ty}"/>`;
  }).join('');
  const nodes = [[-18, -6], [10, -12], [22, 4], [-4, 10], [-24, 8], [4, -2]].map(([dx, dy]) => [HUB.x + dx, HUB.y + dy]);
  const hubLinks = nodes.flatMap((n, i) => nodes.slice(i + 1).map(m => `<line class="hub-link" x1="${n[0]}" y1="${n[1]}" x2="${m[0]}" y2="${m[1]}"/>`)).join('');
  return `<svg class="world" id="world" viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid meet">
    <defs>${critterSym}</defs>
    <g id="cam">
      ${nets}${roads}
      <g class="hub ${busy ? 'busy' : ''}">
        ${isoBox(HUB.x, HUB.y + 10, HUB.s * 1.6, HUB.s * 1.6, 10, '#4a433d', '#332e2a', '#3d3733')}
        ${hubLinks}${nodes.map(n => `<circle class="hub-node" cx="${n[0]}" cy="${n[1]}" r="2.4"/>`).join('')}
      </g>
      ${ag.map((a, i) => island(s, a, i)).join('')}
      <foreignObject x="${HUB.x - 95}" y="${HUB.y - 84}" width="190" height="34">
        <div xmlns="http://www.w3.org/1999/xhtml" class="card hubcard"><div class="t"><span class="d" style="background:var(--accent)"></span>The Brain · ${s.events.length} notes</div></div>
      </foreignObject>
      ${ag.map(a => card(s, a)).join('')}
    </g>
  </svg>`;
}

/* ---------- task status sidebar ---------- */
let filter = 'all';
let copyLabel = 'Copy start command';
function tasks(s) {
  const out = [];
  s.agents.forEach(a => {
    const items = logItems(a.logText);
    items.forEach((it, i) => {
      const live = a.state === 'running' && i === items.length - 1;
      out.push({ st: live ? 'doing' : 'done', txt: it.t, agent: a.label, out: a.output, n: it.n, when: live ? 'now' : (a.finished ? fmtTime(a.finished) : '') });
    });
    if (a.state === 'running' && !items.length) out.push({ st: 'doing', txt: 'Getting started…', agent: a.label, out: a.output, when: 'now' });
    if (a.state === 'waiting') out.push({ st: 'waiting', txt: `Write ${a.output}`, agent: a.label, out: a.output, when: 'next' });
    if (a.state === 'skipped') out.push({ st: 'skipped', txt: a.summary || 'Skipped by AI policy', agent: a.label, out: a.output, when: '' });
  });
  return out.reverse();
}
function sidebar(s) {
  const all = tasks(s), count = k => all.filter(t => t.st === k).length;
  const shown = filter === 'all' ? all : all.filter(t => t.st === filter);
  const f = (k, label, n) => `<button data-filter="${k}" class="${filter === k ? 'on' : ''}">${label} ${n}</button>`;
  return `<aside class="dash-side">
    <section class="dcard side">
      <div class="hd"><h2>What happened</h2><small><a href="#/story">Open the full story</a></small></div>
      <div class="sec"><div class="filters" role="group" aria-label="How to show it"><button data-mode="story" class="${mode === 'story' ? 'on' : ''}">Story</button><button data-mode="list" class="${mode === 'list' ? 'on' : ''}">List</button></div>
      ${mode === 'list' ? `<div class="filters" role="group" aria-label="Filter the list">${f('all', 'all', all.length)}${f('doing', 'doing', count('doing'))}${f('waiting', 'waiting', count('waiting'))}${f('done', 'done', count('done'))}</div>` : ''}</div>
      <div class="tasks">${mode === 'story' ? story(s, false) : shown.length ? shown.map(t => `<div class="task">
        <span class="pill ${t.st}">${t.st}</span><span class="txt">${esc(t.txt)}</span><span class="when">${esc(t.when)}</span>
        ${t.st === 'doing' ? '<div class="bar"><i></i></div>' : ''}
        <span class="sub">${esc(t.agent)}, ${esc(t.out)}${t.n ? ', ' + esc(t.n) : ''}</span></div>`).join('') : '<p class="empty">Nothing here.</p>'}</div>
    </section>
    <section class="dcard">
      <div class="hd"><h2>The four agents</h2><small>AI help: ${esc(String(s.aiPolicy).replace('_', ' '))}</small></div>
      <div class="agents">${s.agents.map(a => {
        const steps = logItems(a.logText).length, T = TEAM[a.id] || { dot: 'var(--faint)' };
        const tag = a.state === 'running' ? ['go', 'Working'] : a.state === 'done' ? ['ok', 'Done'] : a.state === 'error' ? ['no', 'Stopped'] : a.state === 'skipped' ? ['idle', 'Skipped'] : ['idle', 'Waiting'];
        return `<a class="acard s-${a.state}" href="#/${a.id}"><span class="dot" style="background:${T.dot}"></span><b>${esc(a.label)}</b>
          <span class="what">${steps} step${steps === 1 ? '' : 's'} logged, writes ${esc(a.output)}</span><span class="tag ${tag[0]}">${tag[1]}</span></a>`;
      }).join('')}</div>
    </section>
  </aside>`;
}

/* ---------- dashboard pieces: greeting, activity chart, runs table ---------- */
let runsList = [], meName = '';
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
function nowLine(s) {
  const ag = s.agents, run = ag.find(a => a.state === 'running'), title = `<b>${esc(s.title)}</b>`;
  if (run) return `The ${esc(run.label)} is working on ${title}.`;
  if (ag.some(a => a.state === 'error')) return `${title} stopped with a problem. Open the agent to see why.`;
  if (ag.every(a => a.state === 'done' || a.state === 'skipped')) {
    const ev = ag.find(a => a.id === 'evaluator'), v = ev && ev.outputText ? verdict(ev.outputText) : { score: null };
    return `All the agents finished ${title}${v.score === null ? '' : `, marked ${v.score} out of 100`}. Handing it in is your step.`;
  }
  if (ag.every(a => a.state === 'waiting')) return `${title} is set up and waiting to start.`;
  return `Nothing is running right now on ${title}.`;
}
// Real activity only: pipeline notes (which carry a full time) and log steps stamped HH:MM. Untimed steps are left out.
function activity(s) {
  const day = String(s.created || ((s.events || [])[0] || {}).t || '').slice(0, 11), ts = [];
  (s.events || []).forEach(e => { const d = Date.parse(e.t); if (!isNaN(d)) ts.push(d); });
  (s.agents || []).forEach(a => logItems(a.logText).forEach(it => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(it.n).trim());
    if (m && day.length === 11) { const d = Date.parse(day + m[1].padStart(2, '0') + ':' + m[2] + ':00'); if (!isNaN(d)) ts.push(d); }
  }));
  if (ts.length < 2) return null;
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  if (t1 - t0 < 60000) return null;
  const n = 10, counts = new Array(n).fill(0);
  ts.forEach(x => { counts[Math.min(n - 1, Math.floor((x - t0) / (t1 - t0) * n))]++; });
  return { counts, t0, t1, total: ts.length };
}
function chartHtml(s) {
  const a = activity(s);
  if (!a) return '';
  const W = 600, H = 150, top = 16, base = 132, max = Math.max(...a.counts);
  const pt = a.counts.map((c, i) => [i / (a.counts.length - 1) * W, base - c / max * (base - top)]);
  // a smooth line through the midpoints: it stays inside the points, so it never dips below zero
  let d = `M${pt[0][0]} ${pt[0][1].toFixed(1)}`;
  for (let i = 1; i < pt.length - 1; i++) d += ` Q${pt[i][0].toFixed(1)} ${pt[i][1].toFixed(1)} ${((pt[i][0] + pt[i + 1][0]) / 2).toFixed(1)} ${((pt[i][1] + pt[i + 1][1]) / 2).toFixed(1)}`;
  d += ` L${pt[pt.length - 1][0]} ${pt[pt.length - 1][1].toFixed(1)}`;
  const clock = x => new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const grid = [0.25, 0.5, 0.75].map(f => `<line class="gr" x1="${W * f}" y1="${top}" x2="${W * f}" y2="${base}"/>`).join('');
  return `<figure class="chart" style="margin:0" aria-label="Activity over this run: ${a.total} timed notes between ${clock(a.t0)} and ${clock(a.t1)}">
    <span class="cap">Activity in this run<b>${a.total} timed notes</b></span>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-hidden="true">${grid}
      <path class="ar" d="${d} L${W} ${base} L0 ${base} Z"/><path class="ln" d="${d}"/></svg>
    <div class="ax"><span>${clock(a.t0)}</span><span>${clock((a.t0 + a.t1) / 2)}</span><span>${clock(a.t1)}</span></div>
  </figure>`;
}
const RUN_LABELS = ['Analyst', 'Source finder', 'Builder', 'Evaluator'];
function runState(r) {
  const st = r.states || [], i = st.indexOf('running');
  if (i >= 0) return ['run', (RUN_LABELS[i] || 'An agent') + ' working'];
  if (st.includes('error')) return ['err', 'Stopped'];
  if (st.length && st.every(x => x === 'done' || x === 'skipped')) return ['done', 'Finished'];
  if (st.some(x => x === 'done')) return ['', 'Paused'];
  return ['', 'Waiting'];
}
function runsTable() {
  const when = t => { const d = new Date(t); return t && !isNaN(d) ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'; };
  const rule = p => p === 'preferred' ? 'ok' : p === 'banned' ? 'no' : 'go';
  return `<section class="dcard runs"><div class="hd"><h2>Runs</h2><small>${runsList.length} in your save folder</small></div>
    <div class="wrap"><table><thead><tr><th>Name</th><th class="c-started">Started</th><th class="c-rule">AI rule</th><th class="num c-files">Files</th><th class="num">Score</th><th>State</th></tr></thead>
    <tbody>${runsList.map(r => {
      const [cls, label] = runState(r);
      return `<tr data-run="${r.id}" tabindex="0" class="${r.id === runId ? 'cur' : ''}" ${r.id === runId ? 'aria-current="true"' : ''}>
        <td class="nm" title="${esc(r.title)}">${esc(r.title)}</td><td class="c-started">${esc(when(r.created))}</td>
        <td class="c-rule"><span class="tag ${rule(r.aiPolicy)}">${esc(String(r.aiPolicy || 'unknown').replace('_', ' '))}</span></td>
        <td class="num c-files">${r.files == null ? '–' : r.files}</td>
        <td class="num">${r.score == null ? '<span class="none-yet">not marked</span>' : `<b>${r.score}</b>/100`}</td>
        <td><span class="st ${cls}"><i></i>${esc(label)}</span></td></tr>`;
    }).join('')}</tbody></table></div></section>`;
}
function greeting(s) {
  const who = firstName(meName), chart = chartHtml(s);
  return `<section class="greet" ${chart ? '' : 'style="grid-template-columns:minmax(0,1fr)"'}>
    <div><h1>Hello${who ? ' ' + esc(who) : ''}</h1><p class="sub">${nowLine(s)}</p>
      <div class="act"><button class="btn-pill" id="copyCmd"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.500"/><path d="M5 15V6.500A1.500 1.500 0 0 1 6.500 5H15"/></svg><span>${esc(copyLabel)}</span></button>
        <code id="cmdText">/assigent</code></div></div>
    ${chart}
  </section>`;
}

/* ---------- the story: the whole run told simply, start to end ---------- */
let mode = 'story';
const openCh = new Set();
const KID = {
  analyst: { done: 'read the homework and made a to-do list', running: 'is reading the homework', waiting: 'will read the homework first',
    why: 'Like reading the question twice before you start, so nothing gets missed.' },
  finder: { done: 'looked things up', running: 'is looking things up', waiting: 'will look things up next',
    why: 'It visits websites and your old work to find help for every item on the to-do list.' },
  builder: { done: 'did the work and checked it', running: 'is doing the work', waiting: 'will do the work last',
    why: 'It makes the answers, tests that they work, and ticks off the to-do list.' },
  evaluator: { done: 'marked the work like a teacher', running: 'is marking the work', waiting: 'will mark the work at the end',
    why: 'It did not make the work, so it checks it with fresh eyes, gives a score, and says what to fix before you hand it in.' },
};
// What kind of step is this? A picture and a plain word for it.
// A step failed only if it names a failure and isn't just recalling an earlier one ("worked this time (403 last run)")
const recovered = t => /worked this time|no page failed|last run|last time|loaded this time/i.test(t);
function kind(t) {
  if (/as expected|^proved/i.test(t)) return ['✅', 'checked'];
  if (/403|returned empty|couldn.?t open/i.test(t) && !recovered(t)) return ['🚫', "couldn't open"];
  if (/blocked|failed|not allowed|refused/i.test(t) && !recovered(t)) return ['✋', "wasn't allowed"];
  if (/^start/i.test(t)) return ['🚀', 'started'];
  if (/^(search|looking)/i.test(t)) return ['🔍', 'searched'];
  if (/^\S+\.md written|^(wrote|writing|saved)/i.test(t)) return ['✍️', 'wrote'];
  if (/^open/i.test(t)) return ['🌐', 'visited a website'];
  if (/^tried/i.test(t)) return ['🚪', 'tried'];
  if (/^read/i.test(t)) return ['📖', 'read'];
  if (/compil|\bran\b|\bran it\b|tested|executed/i.test(t)) return ['⚙️', 'tested'];
  if (/^(wrote|writing|saved)/i.test(t)) return ['✍️', 'wrote'];
  if (/^(proved|check|verif)/i.test(t)) return ['✅', 'checked'];
  if (/^(found|looking|plan)|flagged|decided/i.test(t)) return ['💡', 'figured out'];
  if (/^(scanned|checked|looked|glanced)/i.test(t)) return ['🔎', 'checked'];
  if (/\b(done|finished|complete)\b[.:,]?/i.test(t)) return ['🏁', 'finished'];
  return ['👉', 'did'];
}
// Say the jargon in plain words, keeping the real name in brackets
const PLAIN = [
  [/\b(deliverables|process|inputs)\/(?=\S)/g, ''],
  [/\bassignment-source\.md\b/g, 'the homework text (assignment-source.md)'],
  [/\bbrief\.md\b/g, 'the to-do list (brief.md)'],
  [/\bsources\.md\b/g, 'the list of helpful websites (sources.md)'],
  [/\breport\.md\b/g, 'the final report (report.md)'],
  [/\bevaluation\.md\b/g, 'the marking sheet (evaluation.md)'],
  [/\banswers\.md\b/g, 'the answers (answers.md)'],
  [/\bevaluation-prep\.md\b/g, 'the practice sheet (evaluation-prep.md)'],
  [/\bBLOCKING: no\b/g, 'nothing stops the work'], [/\bBLOCKING: yes\b/g, 'it needs your answer first'],
  [/\bambiguities\b/gi, 'unclear points'], [/\bdeliverables\b/gi, 'things to hand in'],
  [/\bcompiled with javac[\w .]*\b/gi, 'built the code'], [/\bsub-agent\b/gi, 'helper agent'],
  [/\bblocked \(403\)/gi, 'said "no entry" (blocked)'], [/\breturned empty\b/gi, 'showed a blank page'],
];
const plain = t => PLAIN.reduce((x, [re, to]) => x.replace(re, to), t);
const SITE_NAMES = {
  'docs.oracle.com': 'Oracle: the company that makes Java. Its official lessons.',
  'oracle.com': 'Oracle: the company that makes Java.',
  'w3schools.com': 'W3Schools: a free website that teaches coding.',
  'visual-paradigm.com': 'Visual Paradigm: guides about planning software.',
  'dev.java': 'dev.java: the newest official Java website.',
  'baeldung.com': 'Baeldung: a Java tutorial blog.',
  'geeksforgeeks.org': 'GeeksforGeeks: a coding tutorial website.',
  'developer.mozilla.org': 'MDN: the web\'s reference manual.',
  'helpx.adobe.com': 'Adobe Help: official Photoshop and Illustrator guides.',
};
const siteName = host => {
  const h = host.replace(/^www\./, '');
  const key = Object.keys(SITE_NAMES).find(k => h === k || h.endsWith('.' + k));
  return key ? SITE_NAMES[key] : h;
};
function sitesUsed(s) {
  const finder = s.agents.find(a => a.id === 'finder') || {};
  const urls = [...new Set(((finder.outputText || '').match(/https?:\/\/[^\s)>\]"'`]+/g) || []).map(u => u.replace(/[.,;:]+$/, '')))];
  const by = {};
  urls.forEach(u => {
    let url; try { url = new URL(u); } catch (e) { return; }
    const host = url.hostname.replace(/^www\./, '');
    const page = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || host).replace(/\.(html?|asp|php)$/, '').replace(/[-_]/g, ' ');
    (by[host] = by[host] || { host, pages: [] }).pages.push({ page, url: u });
  });
  const items = logItems(finder.logText);
  return {
    sites: Object.values(by).sort((a, b) => b.pages.length - a.pages.length),
    searches: items.filter(it => /^search/i.test(it.t)).map(it => it.t.replace(/^searched\s*(\(firecrawl\))?\s*:?\s*(for)?\s*/i, '')),
    failed: items.filter(it => /blocked|403|returned empty|failed/i.test(it.t) && !recovered(it.t)).map(it => it.t.replace(/^tried\s*/i, '')),
    local: /~\/|[\\/](Users|home)[\\/]/.test(finder.outputText || '') || items.some(it => /~\/Documents/.test(it.t)),
  };
}
const finderLog = s => ((s.agents.find(a => a.id === 'finder') || {}).logText || '');
function handIns(s) {
  const b = s.agents.find(a => a.id === 'builder') || {};
  const part = ((b.outputText || '').split(/^##\s*What (the user|you) must do.*$/im)[2] || '').split(/^##\s/m)[0];
  return part.split('\n').filter(l => /^\s*(\d+\.|[-*])\s+/.test(l)).map(l => l.replace(/^\s*(\d+\.|[-*])\s+/, '').replace(/\*\*/g, ''));
}

function story(s, full) {
  const ag = s.agents, created = (s.events[0] || {}).t || s.created;
  let n = 0;
  const chapters = ag.map((a, i) => {
    const K = KID[a.id] || { done: 'did its part', running: 'is working', waiting: 'is waiting', why: '' };
    const items = logItems(a.logText), T = TEAM[a.id];
    const first = n + 1; n += items.length;
    const show = full || openCh.has(a.id) || items.length <= 4 ? items : items.slice(-4);
    const hidden = items.length - show.length;
    const verb = a.state === 'done' ? K.done : a.state === 'running' ? K.running : a.state === 'skipped' ? 'was skipped' : K.waiting;
    const when = a.started ? `${fmtTime(a.started)} to ${a.finished ? fmtTime(a.finished) : 'now'}, ${a.finished ? 'took ' + dur(a.started, a.finished) : 'working for ' + dur(a.started)}` : 'Not started yet';
    const steps = show.map((it, k) => {
      const [pic, word] = kind(it.t), num = first + (items.length - show.length) + k, live = a.state === 'running' && k === show.length - 1;
      return `<li class="${live ? 'live' : ''}"><span class="pic">${pic}</span><span><span class="num">Step ${num}</span><span class="word">${word}</span>
        <span class="say">${esc(plain(it.t))}</span></span></li>`;
    }).join('');
    let extra = '';
    if (a.id === 'finder' && items.length) {
      const u = sitesUsed(s);
      extra = `<div class="sites"><div class="sites-h">🌐 Websites it used <small>${u.sites.reduce((x, y) => x + y.pages.length, 0)} pages on ${u.sites.length} websites</small></div>
        ${u.sites.map(st => `<div class="site"><div class="site-top"><b>${esc(st.host)}</b><span class="cnt">${st.pages.length} page${st.pages.length > 1 ? 's' : ''}</span></div>
          <div class="site-what">${esc(siteName(st.host))}</div>
          ${full ? `<div class="pages">${st.pages.map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.page)}</a>`).join('')}</div>` : ''}</div>`).join('') || '<p class="empty">No websites yet.</p>'}
        ${u.local ? '<div class="site local"><div class="site-top"><b>📁 Your own past work</b></div><div class="site-what">It also checked your Documents folder for older homework like this one.</div></div>' : ''}
        ${u.searches.length ? `<div class="sites-h">🔍 What it searched for${/firecrawl/i.test(finderLog(s)) ? ' <small>with Firecrawl</small>' : ''}</div><ul class="mini">${u.searches.map(q => `<li>${esc(plain(q))}</li>`).join('')}</ul>` : ''}
        ${u.failed.length ? `<div class="sites-h">🚫 Websites that wouldn't open</div><ul class="mini">${u.failed.map(q => `<li>${esc(plain(q))}</li>`).join('')}</ul>` : ''}
      </div>`;
    }
    if (a.id === 'evaluator' && a.outputText) {
      const v = verdict(a.outputText);
      extra = `<div class="sites"><div class="sites-h">📝 The marks <small>${v.verdict === 'pass' ? 'good to hand in' : v.verdict === 'revise' ? 'needs fixes first' : ''}</small></div>
        <div class="site"><div class="site-top"><b>${v.score === null ? 'No score yet' : v.score + ' out of 100'}</b><span class="cnt">${v.fixes} to fix</span></div>
          <div class="site-what">${v.verdict === 'pass' ? 'The Evaluator found nothing that must change.' : v.verdict === 'revise' ? 'The Evaluator sent it back to the Builder with a fix list.' : 'The marking sheet has no verdict line.'}</div></div></div>`;
    }
    return `<section class="ch s-${a.state}" style="--team:${T.dot}">
      <div class="ch-head"><span class="ch-n">${i + 1}</span>
        <div><div class="ch-title">The <b>${esc(a.label)}</b> ${esc(verb)}</div><div class="ch-why">${esc(K.why)}</div></div></div>
      <div class="ch-meta"><span>${esc(when)}</span>${items.length ? `<span>${items.length} steps</span>` : ''}</div>
      ${items.length ? `${hidden > 0 ? `<button class="more" data-open="${a.id}">show the first ${hidden} steps too</button>` : ''}<ol class="steps">${steps}</ol>` : `<p class="empty">${a.state === 'waiting' ? 'It is waiting for its turn.' : 'No steps written down.'}</p>`}
      ${a.summary ? `<div class="ch-end">🎯 <b>What it finished with:</b> ${esc(plain(a.summary))}</div>` : ''}
      ${extra}
    </section>`;
  }).join('<div class="hand">⬇︎ passes its work to the next agent</div>');
  const b = ag[ag.length - 1], left = handIns(s), allDone = ag.every(a => a.state === 'done' || a.state === 'skipped');
  return `<div class="story ${full ? 'full' : ''}">
    <section class="ch start"><div class="ch-head"><span class="ch-n">🏁</span><div><div class="ch-title"><b>It started</b> at ${fmtTime(created) || '–'}</div>
      <div class="ch-why">A new assignment came in: <b>${esc(s.title)}</b>. Using AI is <b>${esc(String(s.aiPolicy).replace('_', ' '))}</b> for this one.</div></div></div></section>
    <div class="hand">⬇︎ the Analyst goes first</div>
    ${chapters}
    <div class="hand">⬇︎</div>
    <section class="ch finish ${allDone ? 's-done' : ''}"><div class="ch-head"><span class="ch-n">${allDone ? '🏆' : '⏳'}</span><div>
      <div class="ch-title">${allDone ? `<b>It ended</b> at ${fmtTime(b.finished)}` : '<b>Not finished yet</b>'}</div>
      <div class="ch-why">${allDone ? 'All the agents are done. The agents never hand in your work. That part is yours.' : 'The agents are still working. This story updates by itself.'}</div></div></div>
      ${allDone && left.length ? `<div class="sites-h">🙋 What you still need to do</div><ol class="mini todo">${left.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    </section>
  </div>`;
}

/* ---------- agent page ---------- */
const who =(agents, id) => (agents.find(x => x.id === id) || { label: 'Pipeline' }).label;
const feed = (evs, agents) => evs.length ? `<ul class="feed">${evs.slice().reverse().map(e =>
  `<li class="k-${esc(e.kind || '')}"><span class="ic">${e.kind === 'done' ? '✓' : '⏺'}</span><span><span class="who">${esc(who(agents, e.agent))}</span>${esc(e.msg)}</span><span class="t">${fmtTime(e.t)}</span></li>`).join('')}</ul>`
  : '<p class="empty">Nothing yet.</p>';
const fileList = files => files.length ? `<ul class="files">${files.map(f =>
  `<li><span class="${f.mtime > Date.now() / 1000 - 120 ? 'fresh' : ''}" title="${esc(f.path)}">${esc(f.path)}</span><span class="sz">${size(f.size)}</span></li>`).join('')}</ul>`
  : '<p class="empty">No files yet.</p>';
function agentFiles(s, a) {
  const mine = new Set([a.output, a.log]);
  return s.files.filter(f => mine.has(f.path) ||
    (a.id === 'builder' && (f.path.startsWith('deliverables/') || (f.path.startsWith('process/') && !/(analyst|finder|evaluator)-log\.md$/.test(f.path)))));
}
function statusLine(a) {
  const T = TEAM[a.id] || { verb: 'Working' };
  if (a.state === 'running') return `<div class="status"><span class="ic spin">${SPIN[spinI]}</span><span><span class="verb">${T.verb}…</span> <span class="dim">(<span class="el" data-start="${esc(a.started)}">${dur(a.started)}</span>)</span></span></div>`;
  if (a.state === 'done') return `<div class="status"><span class="ic">⏺</span><span>Done <span class="dim">in ${dur(a.started, a.finished)}</span></span></div>`;
  if (a.state === 'skipped') return `<div class="status"><span class="ic">⊘</span><span>Skipped</span></div>`;
  return `<div class="status"><span class="ic">○</span><span>Waiting</span></div>`;
}
function logHtml(text, running) {
  const items = logItems(text);
  if (!items.length) return `<div class="md">${md(text)}</div>`;
  return `<ul class="log">${items.map((it, i) => `<li class="${running && i === items.length - 1 ? 'last' : ''}"><span class="ic">⏺</span><span>${it.n ? `<span class="n">${esc(it.n)}</span>` : ''}${esc(it.t)}</span></li>`).join('')}</ul>${running ? '<span class="cursor"></span>' : ''}`;
}
function agentPage(s, a) {
  const ag = s.agents, i = ag.indexOf(a), prev = ag[i - 1], next = ag[i + 1];
  const crew2d = `<div class="pen crew">${WORKERS[a.id].map(([file, role], k) =>
    `<figure><div class="agent-icon" style="--d:${-k * 1.37}s">${ICONS[file] || ''}</div><figcaption>${esc(role)}</figcaption></figure>`).join('')}</div>`;
  return `<div class="page">
    <section class="stage3d s-${a.state}" id="stage3d" style="--team:${TEAM[a.id].dot}">
      ${window.THREE && window.Office3D ? '' : crew2d}
      <div class="s3-labels"></div>
      <div class="s3-title"><span class="d"></span>${esc(a.label)}'s room <small>${a.state === 'waiting' ? 'Asleep until its turn' : a.state === 'running' ? 'Working now' : a.state === 'done' ? 'Finished' : ''}</small></div>
      <div class="s3-ui"><button data-3d="in" title="Zoom in" aria-label="Zoom in">+</button><button data-3d="out" title="Zoom out" aria-label="Zoom out">−</button>
        <button data-3d="spin" title="Spin around" aria-label="Spin around">⟳</button><button data-3d="reset" title="Reset view" aria-label="Reset view">⌂</button></div>
      <div class="s3-hint">Drag to look around the room. Pinch, or hold ⌘ and scroll, to zoom.</div>
      ${a.state === 'done' ? '<span class="s3-done">✓ done</span>' : ''}
    </section>
    <section class="hero s-${a.state}">
      <div><h1>${esc(a.label)}</h1><div class="handle">Step ${i + 1} of ${ag.length}, run by the ${esc(a.name)} agent</div>
        <p class="role">${esc(a.role)}</p>${statusLine(a)}
        ${a.summary ? `<div class="result"><span>⎿</span><span>${esc(a.summary)}</span></div>` : ''}
        <div class="meta"><span>started <b>${fmtTime(a.started) || '–'}</b></span><span>finished <b>${fmtTime(a.finished) || '–'}</b></span>
          <span>gets work from <b>${prev ? esc(prev.label) : 'the assignment brief'}</b></span><span>hands to <b>${next ? esc(next.label) : 'you'}</b></span></div>
        <div class="io">reads ${a.reads.map(r => `<span class="chip">${esc(r)}</span>`).join('')} → <span class="chip out">${esc(a.output)}</span></div>
      </div>
    </section>
    <div class="two">
      <section class="panel"><div class="bar"><b>What it's doing</b><span class="r">${esc(a.log)}</span></div>
        <div class="body">${a.logText ? logHtml(a.logText, a.state === 'running') : `<p class="empty">No activity yet.</p>`}</div></section>
      <section class="panel"><div class="bar"><b>Output</b><span class="r">${esc(a.output)}</span></div>
        <div class="body">${a.outputText ? `<div class="md">${md(a.outputText)}</div>` : `<p class="empty">${esc(a.output)} hasn't been written yet.</p>`}</div></section>
    </div>
    <div class="two">
      <section class="panel"><div class="bar"><b>Timeline</b></div><div class="body">${feed(s.events.filter(e => e.agent === a.id), ag)}</div></section>
      <section class="panel"><div class="bar"><b>Files it wrote</b></div><div class="body">${fileList(agentFiles(s, a))}</div></section>
    </div>
    <div class="stepnav"><span>${prev ? `<a href="#/${prev.id}">← ${esc(prev.label)}</a>` : '<a href="#/">← Office</a>'}</span>
      <span>${next ? `<a href="#/${next.id}">${esc(next.label)} →</a>` : '<a href="#/">Office →</a>'}</span></div></div>`;
}

/* ---------- camera: zoom + drag ---------- */
const cam = { k: 1, x: 0, y: 0 };
function applyCam() { const g = $('#cam'); if (g) g.setAttribute('transform', `translate(${cam.x} ${cam.y}) scale(${cam.k})`); }
function zoomBy(f) {
  const k = Math.min(2.4, Math.max(.6, cam.k * f));
  cam.x = 500 - (500 - cam.x) * (k / cam.k); cam.y = 360 - (360 - cam.y) * (k / cam.k); cam.k = k; applyCam();
}
let drag = null, moved = false;
document.addEventListener('pointerdown', e => {
  const svg = e.target.closest('svg.world'); if (!svg) return;
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, scale: 1000 / svg.getBoundingClientRect().width }; moved = false;
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = (e.clientX - drag.x) * drag.scale, dy = (e.clientY - drag.y) * drag.scale;
  if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; $('#world') && $('#world').classList.add('dragging'); }
  cam.x = drag.cx + dx; cam.y = drag.cy + dy; applyCam();
});
document.addEventListener('pointerup', () => { drag = null; $('#world') && $('#world').classList.remove('dragging'); });

/* ---------- render loop ---------- */
// One live 3D room at a time; kept alive across re-renders of the same agent's page
let view3d = null;
function mount3d(a) {
  const host = a && $('#stage3d');
  if (!host || !window.THREE || !window.Office3D) { if (view3d) { view3d.dispose(); view3d = null; } return; }
  if (view3d && view3d.team === a.id) { view3d.attach(host); view3d.setState(a.state); return; }
  if (view3d) view3d.dispose();
  try { view3d = Office3D.mount(host, a.id, a.state); } catch (e) { console.error(e); view3d = null; }
}
// The 360° office on the home screen; kept alive across re-renders
let office3d = null;
function mountOffice3d(s) {
  const host = s && $('#office3d');
  if (!host) { if (office3d) { office3d.dispose(); office3d = null; } return; }
  const list = s.agents.map(a => ({ id: a.id, state: a.state }));
  if (office3d) { office3d.attach(host); office3d.setAgents(list); return; }
  try { office3d = Office3D.mountOffice(host, list, team => { location.hash = '#/' + team; }); } catch (e) { console.error(e); office3d = null; }
}
const route = () => (location.hash.match(/^#\/(\w+)/) || [])[1] || '';
function markRail(s) {
  const r = route();
  document.querySelectorAll('#rail a').forEach(el => {
    const on = el.dataset.nav === r;
    el.classList.toggle('on', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    const ag = s && s.agents.find(x => x.id === el.dataset.nav);
    el.classList.toggle('busy', !!(ag && ag.state === 'running'));
  });
}
function render(s) {
  markRail(s);
  const a = s.agents.find(x => x.id === route());
  $('#crumb').textContent = a ? a.label : route() === 'story' ? 'What happened' : '';
  if (a) { $('#main').innerHTML = agentPage(s, a); mountOffice3d(null); mount3d(a); return; }
  mount3d(null);
  if (route()) mountOffice3d(null);
  if (route() === 'story') {
    $('#main').innerHTML = `<div class="page storypage"><h1>The whole story</h1>
      <p class="lead">Everything that happened, from the moment the homework arrived to the end: who did each step, what they did, and every website they used.</p>
      ${story(s, true)}<div class="stepnav"><a href="#/">← Back to the office</a></div></div>`;
    return;
  }
  const tasksScroll = $('.tasks') ? $('.tasks').scrollTop : 0;
  const has3d = !!(window.THREE && window.Office3D);
  $('#main').innerHTML = `<div class="dash"><div class="dash-main">
    ${greeting(s)}
    ${runsTable()}
    <section class="dcard officecard">${has3d ? `<div class="floor3d">
      <div class="stage3d office3d" id="office3d">
        <div class="s3-labels">${s.agents.map(x => `<div class="card s3-room s-${x.state}" data-go="${x.id}">${cardBody(s, x)}</div>`).join('')}
          <span class="s3-tag s3-brain"><b>The Brain</b>, ${s.events.length} notes</span></div>
        <div class="s3-title"><span class="d" style="background:var(--accent)"></span>The office</div>
        <div class="s3-ui"><button data-3d="in" title="Zoom in" aria-label="Zoom in">+</button><button data-3d="out" title="Zoom out" aria-label="Zoom out">−</button>
          <button data-3d="spin" title="Spin around" aria-label="Spin around">⟳</button><button data-3d="reset" title="Reset view" aria-label="Reset view">⌂</button></div>
        <div class="s3-hint">Drag to look around. Pinch, or hold ⌘ and scroll, to zoom. Click a room to go in.</div>
      </div></div>` : `<div class="floor">${office(s)}
      <div class="hint">Drag to move. Click a team to open it.</div>
      <div class="zoom"><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="reset" aria-label="Reset view">⌂</button></div>
    </div>`}</section>
    </div>${sidebar(s)}</div>`;
  if (has3d) mountOffice3d(s); else applyCam();
  if ($('.tasks')) $('.tasks').scrollTop = tasksScroll;
}

let runId = 0, current = null, lastSig = '';
try { const v = localStorage.getItem('pipe.run'); if (v !== null) runId = +v; } catch (e) {}
async function tick() {
  try {
    const rs = await (await fetch('/api/runs')).json();
    runsList = rs;
    const sel = $('#runSel');
    const opts = rs.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('');
    if (sel.innerHTML !== opts) sel.innerHTML = opts;
    if (!rs.length) {
      markRail(null);
      $('#main').innerHTML = `<div class="none"><b>Hello${firstName(meName) ? ' ' + esc(firstName(meName)) : ''}.</b> No runs yet. Start one with <code>/assigent</code> in Claude Code, or <code>assigent run</code> in your terminal.</div>`;
    } else {
      if (!rs.some(r => r.id === runId)) runId = 0;
      sel.value = runId;
      current = await (await fetch('/api/run?id=' + runId)).json();
      // re-render only when the data changes, so the workers' animations run uninterrupted
      const sig = JSON.stringify(current) + JSON.stringify(rs) + runId + meName + route() + filter;
      if (sig !== lastSig && !drag) { render(current); lastSig = sig; }
    }
    $('#live').classList.remove('off'); $('#live span').textContent = 'live';
  } catch (e) {
    $('#live').classList.add('off'); $('#live span').textContent = 'offline';
  }
}
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]');
  if (z) { if (z.dataset.zoom === 'reset') { cam.k = 1; cam.x = 0; cam.y = 0; applyCam(); } else zoomBy(z.dataset.zoom === 'in' ? 1.2 : 1 / 1.2); return; }
  const m = e.target.closest('[data-mode]');
  if (m) { mode = m.dataset.mode; lastSig = ''; if (current) render(current); return; }
  const o = e.target.closest('[data-open]');
  if (o) { openCh.add(o.dataset.open); lastSig = ''; if (current) render(current); return; }
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; if (current) render(current); return; }
  if (e.target.closest('#copyCmd')) {
    // the label lives in copyLabel so a re-render in between cannot wipe the confirmation
    const t = $('#cmdText').textContent, say = x => { copyLabel = x; const l = $('#copyCmd span'); if (l) l.textContent = x; };
    const after = x => { say(x); setTimeout(() => say('Copy start command'), 1500); };
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => after('Copied'), () => after('Select it and copy'));
    return;
  }
  const row = e.target.closest('tr[data-run]');
  if (row) { pickRun(+row.dataset.run); return; }
  const g = e.target.closest('[data-go]');
  if (g && !moved) location.hash = '#/' + g.dataset.go;
});
document.addEventListener('keydown', e => {
  const row = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('tr[data-run]');
  if (row) { e.preventDefault(); pickRun(+row.dataset.run); }
});
function pickRun(id) {
  runId = id; lastSig = '';
  try { localStorage.setItem('pipe.run', runId); } catch (err) {}
  tick();
}
window.addEventListener('hashchange', () => { if (current) { render(current); lastSig = ''; window.scrollTo(0, 0); } });
$('#runSel').addEventListener('change', e => pickRun(+e.target.value));
// The saved name (if any) for the greeting and the top bar. No name saved: it just says "Hello".
fetch('/api/me').then(r => r.ok ? r.json() : {}).then(m => {
  meName = String((m && m.name) || '').trim();
  if (meName) { $('#meName').textContent = meName; $('#meAv').textContent = meName[0].toUpperCase(); $('#me').hidden = false; lastSig = ''; }
}).catch(() => {});
iconsReady.then(() => { tick(); setInterval(tick, 2000); });
