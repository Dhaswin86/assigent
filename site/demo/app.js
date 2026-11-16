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
  researcher: [['researcher', 'deep reader'], ['researcher-2', 'cross-checker'], ['researcher-3', 'plan writer']],
  builder: [['builder', 'maker'], ['builder-2', 'coder'], ['builder-3', 'tester']],
  evaluator: [['evaluator', 'rubric checker'], ['evaluator-2', 'fact checker'], ['evaluator-3', 'scorer']],
};
const ICONS = {}, INNER = {};
const iconsReady = Promise.all(Object.values(WORKERS).flat().map(([file]) =>
  fetch('icons/' + file + '.svg').then(r => r.ok ? r.text() : '').then(t => {
    ICONS[file] = t;
    INNER[file] = t.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }).catch(() => {})));

const TEAM = {
  analyst: { top: '#8fb59a', left: '#6b9478', right: '#7aa086', dot: '#5fa377', verb: 'Analysing' },
  finder:  { top: '#86a8cf', left: '#6283ab', right: '#7093bb', dot: '#5b8fc9', verb: 'Searching' },
  researcher: { top: '#d9a0a8', left: '#b07a83', right: '#c38993', dot: '#c9697a', verb: 'Researching' },
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
  if (a.id === 'researcher') {
    const f = researchFacts(out);
    return [['checked facts', dash(f.checked)], ['not confirmed', dash(f.unsure)]];
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
let HUB = { x: 500, y: 350, s: 66 };
const SPOTS4 = {
  analyst:   { x: 215, y: 250, s: 140, card: [36, 6, 190, 150] },
  finder:    { x: 785, y: 250, s: 140, card: [774, 6, 190, 150] },
  builder:   { x: 785, y: 560, s: 140, card: [503, 470, 160, 150] },
  evaluator: { x: 215, y: 560, s: 140, card: [337, 470, 160, 150] },
};
// With the Researcher: three islands along the top, two below, The Brain a little lower
const SPOTS5 = {
  analyst:    { x: 170, y: 262, s: 132, card: [75, 6, 190, 150] },
  finder:     { x: 500, y: 262, s: 132, card: [405, 6, 190, 150] },
  researcher: { x: 830, y: 262, s: 132, card: [735, 6, 190, 150] },
  builder:    { x: 800, y: 610, s: 132, card: [503, 540, 160, 150] },
  evaluator:  { x: 200, y: 610, s: 132, card: [337, 540, 160, 150] },
};
let SPOTS = SPOTS4;

function props(id, cx, cy, t) {
  if (id === 'analyst') return isoBox(cx + 30, cy + 4, 16, 14, 5, '#f4efe4', '#cfc6b4', '#e2dace', 'paper-flip')
    + isoBox(cx + 30, cy - 1, 16, 14, 4, '#ffffff', '#d8d0c0', '#ece6da')
    + isoBox(cx - 34, cy + 16, 10, 10, 18, '#7a5a3b', '#5a412a', '#6b4e33') + `<circle cx="${cx - 34}" cy="${cy - 2}" r="9" fill="#4f8a5b"/>`;
  if (id === 'finder') return isoBox(cx + 2, cy - 8, 4, 22, 20, '#3a3f48', '#2a2e35', '#30353d')
    + `<polygon class="screen-glow" points="${pts([P(cx + 4, cy - 8, 0, -10), P(cx + 4, cy - 8, 0, 10), [P(cx + 4, cy - 8, 0, 10)[0], P(cx + 4, cy - 8, 0, 10)[1] - 17], [P(cx + 4, cy - 8, 0, -10)[0], P(cx + 4, cy - 8, 0, -10)[1] - 17]])}" fill="#7fb2ff"/>`
    + isoBox(cx + 34, cy + 12, 12, 12, 26, '#566278', '#3c4556', '#485366');
  if (id === 'researcher') return isoBox(cx + 30, cy + 8, 18, 14, 4, '#a8515f', '#7e3c47', '#934653')
    + isoBox(cx + 30, cy + 4, 16, 12, 3, '#ffffff', '#d8d0c0', '#ece6da')
    + `<path d="M${cx + 23} ${cy + 1} l12 -6" stroke="#f2c230" stroke-width="2.4" fill="none"/>`
    + isoBox(cx - 36, cy + 14, 10, 12, 20, '#e8a3ad', '#a8515f', '#bd6a77');
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
  // older runs have no Researcher: they keep the four-island layout
  const five = s.agents.some(a => a.id === 'researcher');
  SPOTS = five ? SPOTS5 : SPOTS4; HUB = { x: 500, y: five ? 436 : 350, s: 66 };
  const ag = s.agents.filter(a => SPOTS[a.id]), busy = ag.some(a => a.state === 'running');
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

/* ---------- results at a glance: numbers read from the agents' own files ---------- */
// Everything here is parsed from text the viewer already loaded. A value that cannot be read is null and shows as a dash.
const EXT = 'pptx|xlsx|docx|pdf|psd|ai|fig|indd|png|jpe?g|mp4|html|css|js|py|java|key|numbers|pages|csv|zip|txt|md';
const dash = v => (v === null || v === undefined || v === '') ? '–' : v;
const openDisc = new Set();          // which "show more" parts are open; kept across re-renders
// The text under a heading, whether it is written "## 3. Deliverables" or "3. **Deliverables**: ..."
function sect(out, names) {
  const m = new RegExp('^(?:#{1,4}[ \\t]*)?(?:\\d+\\.[ \\t]*)?\\**[ \\t]*(?:' + names + ')\\b[^\\n]*$', 'im').exec(out || '');
  if (!m) return null;
  const rest = out.slice(m.index + m[0].length), end = /^(?:#{1,2}[ \t]+\S|\d+\.[ \t]*\*\*)/m.exec(rest);
  return m[0].replace(/^[^:]*:?/, '') + '\n' + (end ? rest.slice(0, end.index) : rest);
}
const extOf = name => { const m = new RegExp('\\.(' + EXT + ')\\b', 'i').exec(name || ''); return m ? m[1].toLowerCase() : ''; };
const clip = (x, n) => x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
const bare = x => x.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
function analystFacts(out) {
  if (!out) return { deliverables: null, list: [], checks: null, questions: null, blocking: null };
  const d = sect(out, 'Deliverables'), list = [];
  if (d !== null) d.split('\n').forEach(l => {
    const item = /^\s*\d+\.\s+(.*)$/.exec(l), row = /^\s*\|\s*(?!-)([^|]+)\|\s*`?\.?([a-z0-9]{2,7})`?\s*\|/i.exec(l), type = /Required file type:\s*`?\.?([a-z0-9]{2,7})/i.exec(l);
    if (item) list.push({ name: clip(bare(item[1]).replace(/\s*[(:].*$/, ''), 44), ext: extOf(item[1]) });
    else if (row && new RegExp('^(' + EXT + ')$', 'i').test(row[2])) list.push({ name: clip(bare(row[1]), 44), ext: row[2].toLowerCase() });
    if (type && list.length) list[list.length - 1].ext = type[1].toLowerCase();
  });
  const q = sect(out, 'Questions this assignment needs|Choices for the user');
  const b = /BLOCKING:\s*(yes|no)/i.exec(out);
  return { deliverables: d === null ? null : list.length, list, checks: (out.match(/^\s*- \[[ xX]\]/gm) || []).length,
    questions: q === null ? null : (q.match(/^\s*###\s+\S/gm) || []).length, blocking: b ? b[1].toLowerCase() : null };
}
function finderFacts(s, a) {
  const u = sitesUsed(s), out = a.outputText || '', g = sect(out, 'Gaps');
  const gaps = g === null ? null : (g.match(/^\s*[-*]\s+(?!none\b)\S/gim) || []).length;
  return { sources: out ? u.sites.reduce((x, y) => x + y.pages.length, 0) : null, sites: out ? u.sites.length : null, top: u.sites, gaps, searches: u.searches };
}
// The Researcher's numbers: its own "Facts: n checked · Cross-checked: m · Not confirmed: k" line, else counted from the file
function researchFacts(out) {
  if (!out) return { checked: null, cross: null, unsure: null, plan: [] };
  const num = re => { const m = re.exec(out); return m ? +m[1] : null; };
  const rows = out.split('\n').map(l => /^\s*\|\s*F\d+\s*\|(.*)$/i.exec(l)).filter(Boolean).map(m => m[1].split('|').map(c => c.trim()));
  const no = sect(out, 'Not confirmed'), plan = [];
  (sect(out, 'Build plan') || '').split('\n').forEach(l => {
    const h = /^\s*###\s+(.+)$/.exec(l);
    if (h) plan.push({ name: clip(bare(h[1]), 40), ext: extOf(h[1]), steps: 0 });
    else if (plan.length && /^\s*\d+\.\s+\S/.test(l)) plan[plan.length - 1].steps++;
  });
  return { checked: num(/^Facts:\s*(\d+)\s*checked/im) ?? rows.length,
    cross: num(/Cross-checked:\s*(\d+)/i) ?? rows.filter(c => c[2] && !/^(-|–|none|no)$/i.test(c[2])).length,
    unsure: num(/Not confirmed:\s*(\d+)/i) ?? (no === null ? null : (no.match(/^\s*[-*]\s+(?!none\b)\S/gim) || []).length), plan };
}
function builderFacts(s, a) {
  const out = a.outputText || '', files = s.files.filter(f => f.path.startsWith('deliverables/'));
  const all = (out.match(/^\s*- \[[ xX]\]/gm) || []).length, ticked = (out.match(/^\s*- \[[xX]\]/gm) || []).length;
  return { files, all: out ? all : null, ticked: out ? ticked : null, left: handIns(s) };
}
function evalFacts(out) {
  if (!out) return { score: null, verdict: '', pass: null, partial: null, fail: null, must: [], round: null };
  const v = verdict(out), r = sect(out, 'Requirements') || '', count = k => (r.match(new RegExp(':\\s*\\**' + k + '\\b', 'g')) || []).length;
  const must = (sect(out, 'Must fix') || '').split('\n').map(l => /^\s*(?:\d+\.|[-*])\s+(.+)$/.exec(l)).filter(m => m && !/^(none|nothing)\b/i.test(m[1])).map(m => bare(m[1]));
  const round = /^Round:\s*(\d+)/im.exec(out);
  return { score: v.score, verdict: v.verdict, pass: count('PASS'), partial: count('PARTIAL'), fail: count('FAIL'), must, round: round ? +round[1] : null };
}
// The 2 to 4 numbers that sum an agent up (used on its page, in its story chapter and on the home screen)
function tilesFor(s, a) {
  if (a.id === 'analyst') { const f = analystFacts(a.outputText); return [[f.deliverables, 'things to hand in'], [a.outputText ? f.checks : null, 'checklist items'], [f.questions, 'questions for you']]; }
  if (a.id === 'finder') { const f = finderFacts(s, a); return [[f.sources, 'sources'], [f.sites, 'websites'], [f.gaps, 'gaps']]; }
  if (a.id === 'researcher') { const f = researchFacts(a.outputText); return [[f.checked, 'checked facts'], [f.cross, 'cross-checked'], [f.unsure, 'not confirmed']]; }
  if (a.id === 'builder') { const f = builderFacts(s, a); return [[f.files.length || null, 'files made'], [f.all ? `${f.ticked}/${f.all}` : null, 'checks ticked'], [a.outputText ? f.left.length : null, 'left for you']]; }
  const f = evalFacts(a.outputText);
  return [[f.score === null ? null : f.score, 'out of 100'], [a.outputText ? f.must.length : null, 'must fix'], [f.pass, 'passed']];
}
const tiles = list => `<div class="tiles">${list.map(([v, k]) => `<div class="tile"><b>${esc(dash(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
// One short chip for the home timeline
function resultChip(s, a) {
  if (!a.outputText && a.id !== 'builder') return '';
  if (a.id === 'analyst') { const f = analystFacts(a.outputText); return f.checks ? `${f.checks} checks` : ''; }
  if (a.id === 'finder') { const f = finderFacts(s, a); return f.sources ? `${f.sources} sources` : ''; }
  if (a.id === 'researcher') { const f = researchFacts(a.outputText); return f.checked ? `${f.checked} fact${f.checked === 1 ? '' : 's'}` : ''; }
  if (a.id === 'builder') { const n = builderFacts(s, a).files.length; return n ? `${n} file${n === 1 ? '' : 's'}` : ''; }
  const f = evalFacts(a.outputText); return f.score === null ? '' : `${f.score}/100${f.verdict ? ' ' + f.verdict : ''}`;
}
const badge = ext => ext ? `<i class="ext x-${esc(ext.replace(/jpe?g/, 'jpg'))}">.${esc(ext)}</i>` : '';
const more = (n, shown) => n > shown ? `<span class="chipx more-n">+${n - shown} more</span>` : '';
function disclosure(key, closed, open) {
  const on = openDisc.has(key);
  return `<button class="disc" type="button" data-disc="${esc(key)}" aria-expanded="${on}" aria-controls="d-${esc(key)}"><i aria-hidden="true"></i><span>${on ? open : closed}</span></button>`;
}
// What the user learned: the Evaluator's questions (learning-check.md). They are asked and answered in Claude Code.
function learnFacts(t) {
  if (!t) return null;
  const done = /^Status:\s*DONE/im.test(t), u = /^Understood:\s*(\d+)\s*\/\s*(\d+)/im.exec(t);
  const qs = (sect(t, done ? 'Answers' : 'Questions') || '').split('\n').map(l => /^(?:- \[([ xX])\]\s*)?\d+\.\s+(.+)$/.exec(l)).filter(Boolean)
    .map(m => { const q = bare(m[2]), cut = q.indexOf('?'); return { ok: m[1] ? m[1] !== ' ' : null, q: cut > 0 ? q.slice(0, cut + 1) : q }; });
  return { done, got: u ? +u[1] : null, total: u ? +u[2] : qs.length, qs };
}
function learnBlock(s, compact) {
  const f = learnFacts(s.learningText);
  if (!f || !f.qs.length) return '';
  return `<div class="learn" data-learn="${f.done ? 'done' : 'waiting'}">
    <div class="chips"><span class="lab">What you learned</span>${f.done ? `<span class="tag ${f.got === f.total ? 'ok' : 'go'}">Understood ${f.got} of ${f.total}</span>` : `<span class="tag go">Concept check waiting for you</span>`}</div>
    ${compact ? '' : `<ol>${f.qs.slice(0, 5).map(x => `<li${x.ok === null ? '' : ` class="${x.ok ? 'got' : 'miss'}"`}>${esc(clip(x.q, 120))}${x.ok === null ? '' : `<i>${x.ok ? 'Got it' : 'Not yet'}</i>`}</li>`).join('')}</ol>
    ${f.done ? '' : '<p class="hint">These open the check. 15 to 20 questions follow, chosen from your answers. To start, say <code>ask me the questions</code> in Claude Code.</p>'}`}</div>`;
}
function resultCard(s, a, compact) {
  const has = !!a.outputText;
  let body = '';
  if (a.id === 'analyst') {
    const f = analystFacts(a.outputText);
    body = `${f.list.length ? `<div class="chips" aria-label="Things to hand in">${f.list.slice(0, compact ? 3 : 8).map(d => `<span class="chipx file">${badge(d.ext)}${esc(d.name)}</span>`).join('')}${more(f.list.length, compact ? 3 : 8)}</div>` : ''}
      ${f.blocking ? `<div class="chips"><span class="tag ${f.blocking === 'yes' ? 'go' : 'ok'}">${f.blocking === 'yes' ? 'Needs your answer first' : 'Nothing blocks the work'}</span></div>` : ''}`;
  } else if (a.id === 'finder') {
    const f = finderFacts(s, a);
    body = `${f.top.length ? `<div class="chips" aria-label="Websites used">${f.top.slice(0, compact ? 3 : 6).map(x => `<span class="chipx site">${esc(x.host)}<i class="n">${x.pages.length}</i></span>`).join('')}${more(f.top.length, compact ? 3 : 6)}</div>` : ''}
      ${!compact && f.searches.length ? `<div class="chips searches" aria-label="Searches"><span class="lab">Searched</span>${f.searches.slice(0, 5).map(q => `<span class="chipx q">${esc(clip(plain(q), 38))}</span>`).join('')}${more(f.searches.length, 5)}</div>` : ''}
      ${f.gaps !== null ? `<div class="chips"><span class="tag ${f.gaps ? 'go' : 'ok'}">${f.gaps ? f.gaps + ' gap' + (f.gaps === 1 ? '' : 's') : 'No gaps'}</span></div>` : ''}`;
  } else if (a.id === 'researcher') {
    const f = researchFacts(a.outputText);
    body = `${f.plan.length ? `<div class="chips" aria-label="Build plan"><span class="lab">Plan for</span>${f.plan.slice(0, compact ? 3 : 6).map(d => `<span class="chipx file">${badge(d.ext)}${esc(d.name)}${d.steps ? `<i class="n">${d.steps}</i>` : ''}</span>`).join('')}${more(f.plan.length, compact ? 3 : 6)}</div>` : ''}
      ${f.unsure !== null ? `<div class="chips"><span class="tag ${f.unsure ? 'go' : 'ok'}">${f.unsure ? f.unsure + ' not to use' : 'Every fact confirmed'}</span></div>` : ''}`;
  } else if (a.id === 'builder') {
    const f = builderFacts(s, a), pct = f.all ? Math.round(f.ticked / f.all * 100) : 0;
    body = `${f.all ? `<div class="prog" role="img" aria-label="${f.ticked} of ${f.all} checks ticked"><i style="width:${pct}%"></i></div>` : ''}
      ${f.files.length ? `<div class="chips" aria-label="Files made">${f.files.slice(0, compact ? 3 : 8).map(x => { const n = x.path.replace(/^deliverables\//, ''); return `<span class="chipx file" title="${esc(x.path)}">${badge(extOf(n))}${esc(clip(n, 34))}<i class="n">${size(x.size)}</i></span>`; }).join('')}${more(f.files.length, compact ? 3 : 8)}</div>` : ''}
      ${!compact && f.left.length ? `<div class="left"><span class="lab">Left for you</span><ol>${f.left.slice(0, 3).map(x => `<li>${esc(clip(x, 110))}</li>`).join('')}</ol>${more(f.left.length, 3)}</div>` : ''}`;
  } else {
    const f = evalFacts(a.outputText), n = (f.pass || 0) + (f.partial || 0) + (f.fail || 0), C = 2 * Math.PI * 34;
    const seg = (k, v) => v ? `<i class="${k}" style="flex:${v}" title="${v} ${k}"></i>` : '';
    body = has ? `<div class="marks">
        <div class="ring ${f.verdict || 'none'}" role="img" aria-label="${f.score === null ? 'No score yet' : f.score + ' out of 100'}">
          <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="bg" cx="40" cy="40" r="34"/>${f.score === null ? '' : `<circle class="fg" cx="40" cy="40" r="34" stroke-dasharray="${(C * Math.min(100, f.score) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/>`}</svg>
          <b>${dash(f.score)}</b><span>of 100</span></div>
        <div class="marks-side"><div class="chips">${f.verdict ? `<span class="tag ${f.verdict === 'pass' ? 'ok' : 'go'}">${f.verdict === 'pass' ? 'Pass' : 'Revise'}</span>` : ''}${f.round ? `<span class="tag idle">Round ${f.round}</span>` : ''}<span class="tag ${f.must.length ? 'no' : 'ok'}">${f.must.length} must fix</span></div>
          ${n ? `<div class="stack" role="img" aria-label="${f.pass} passed, ${f.partial} partial, ${f.fail} failed">${seg('pass', f.pass)}${seg('partial', f.partial)}${seg('fail', f.fail)}</div>
          <div class="legend"><span><i class="pass"></i>${f.pass} pass</span><span><i class="partial"></i>${f.partial} partial</span><span><i class="fail"></i>${f.fail} fail</span></div>` : ''}</div></div>
      ${!compact && f.must.length ? `<div class="left"><span class="lab">Must fix</span><ol>${f.must.slice(0, 3).map(x => `<li>${esc(clip(x, 110))}</li>`).join('')}</ol>${more(f.must.length, 3)}</div>` : ''}` : '';
  }
  if (a.id === 'evaluator') body += learnBlock(s, compact);
  const key = 'full-' + a.id;
  return `<section class="rcard${compact ? ' compact' : ''}" data-result="${a.id}">
    ${compact ? '' : `<div class="rhead"><b>Result</b><code>${esc(a.output)}</code></div>`}
    ${a.id === 'evaluator' && has ? '' : tiles(tilesFor(s, a))}
    ${body}
    ${!has && a.id !== 'builder' ? `<p class="empty">Not written yet.</p>` : ''}
    ${!compact && has ? `${disclosure(key, 'Read the full file', 'Hide the full file')}<div class="full md" id="d-${key}" ${openDisc.has(key) ? '' : 'hidden'}>${md(a.outputText)}</div>` : ''}
  </section>`;
}

/* ---------- home: what happened, one row per agent (plus the Tutor, which has no room) ---------- */
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.500h6a1.500 1.500 0 0 1 1.500 1.500v1.500h1.500a2.500 2.500 0 0 1 0 5H16.500V18a1.500 1.500 0 0 1-1.500 1.500h-2v-1.500a1.500 1.500 0 0 0-3 0v1.500H9A1.500 1.500 0 0 1 7.500 18v-4H6a2 2 0 0 1 0-4h1.500V6A1.500 1.500 0 0 1 9 4.500z"/></svg>';
function tutorRow(s) {
  const p = s.playground || { state: 'none' }, n = (p.activities || []).length;
  const tag = p.state === 'running' ? ['go', 'Making it'] : p.state === 'done' && p.hasFile ? ['ok', 'Ready'] : p.state === 'skipped' ? ['idle', 'Skipped'] : p.state === 'error' ? ['no', 'Stopped'] : ['idle', 'Not made'];
  const chip = p.hasFile ? (n ? `${n} activities` : 'Open') : '';
  return `<li><a class="tl-row tutor s-${esc(p.state)}" href="playground.html?run=${runId}" aria-label="Tutor: playground ${tag[1]}${chip ? ', ' + chip : ''}">
    <span class="tl-ic glyph" aria-hidden="true">${PLAY_ICON}</span>
    <span class="tl-main"><b>Tutor</b><span class="tl-sub"><span class="tag ${tag[0]}">${tag[1]}</span><span class="tl-time">Playground</span></span></span>
    ${chip ? `<span class="chipx res">${esc(chip)}</span>` : '<span class="chipx res none">–</span>'}</a></li>`;
}
let copyLabel = 'Copy start command';
function sidebar(s) {
  const tagOf = a => a.state === 'running' ? ['go', 'Working'] : a.state === 'done' ? ['ok', 'Done'] : a.state === 'error' ? ['no', 'Stopped'] : a.state === 'skipped' ? ['idle', 'Skipped'] : ['idle', 'Waiting'];
  const last = s.agents.slice().reverse().find(a => a.outputText) || null;
  return `<aside class="dash-side">
    <section class="dcard side">
      <div class="hd"><h2>What happened</h2><small><a href="#/story">Open the full story</a></small></div>
      <ol class="tl">${s.agents.map(a => {
        const tag = tagOf(a), chip = resultChip(s, a), file = (WORKERS[a.id] || [[]])[0][0];
        const time = a.state === 'running' ? `<span class="el" data-start="${esc(a.started)}">${dur(a.started)}</span>` : a.started && a.finished ? dur(a.started, a.finished) : '';
        return `<li><a class="tl-row s-${a.state}" href="#/${a.id}" aria-label="${esc(a.label)}: ${tag[1]}${chip ? ', ' + esc(chip) : ''}">
          <span class="tl-ic" aria-hidden="true">${ICONS[file] || ''}</span>
          <span class="tl-main"><b>${esc(a.label)}</b><span class="tl-sub"><span class="tag ${tag[0]}">${tag[1]}</span>${time ? `<span class="tl-time">${time}</span>` : ''}</span></span>
          ${chip ? `<span class="chipx res">${esc(chip)}</span>` : '<span class="chipx res none">–</span>'}</a></li>`;
      }).join('')}${tutorRow(s)}</ol>
    </section>
    ${last ? `<section class="dcard latest"><div class="hd"><h2>Latest result</h2><small><a href="#/${last.id}">${esc(last.label)}</a></small></div>${resultCard(s, last, true)}</section>` : ''}
  </aside>`;
}

/* ---------- home: where the results are (folder, file name, format) ---------- */
const FORMATS = { xlsx: 'Excel workbook', xls: 'Excel workbook', csv: 'CSV table', pptx: 'PowerPoint deck', docx: 'Word document', pdf: 'PDF', md: 'Markdown text', txt: 'Plain text',
  html: 'Web page', css: 'Style sheet', js: 'JavaScript', json: 'JSON data', py: 'Python code', java: 'Java code', png: 'PNG image', jpg: 'JPEG image', jpeg: 'JPEG image', svg: 'SVG image',
  gif: 'GIF image', psd: 'Photoshop file', ai: 'Illustrator file', fig: 'Figma file', mp4: 'MP4 video', zip: 'Zip archive' };
const RESULT_FILES = { 'brief.md': 'The plan', 'choices.md': 'Your answers', 'sources.md': 'The sources', 'research.md': 'Checked facts and build plan', 'report.md': 'What was made', 'evaluation.md': 'The marks',
  'learning-check.md': 'Questions for you', 'playground/index.html': 'The playground' };
function whereCard(s) {
  const files = s.files || [], base = p => p.slice(p.lastIndexOf('/') + 1), dir = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : 'top of the folder';
  const ext = p => { const m = /\.([a-z0-9]+)$/i.exec(p); return m ? m[1].toLowerCase() : ''; };
  const hand = files.filter(f => f.path.startsWith('deliverables/')), res = Object.keys(RESULT_FILES).map(k => files.find(f => f.path === k)).filter(Boolean);
  if (!s.folder && !hand.length && !res.length) return '';
  const row = (f, what, cls) => `<tr><td class="fn"><b>${esc(base(f.path))}</b></td><td class="fmt">${esc(FORMATS[ext(f.path)] || 'File')}${ext(f.path) ? ` <code>.${esc(ext(f.path))}</code>` : ''}</td><td class="in"><code>${esc(dir(f.path))}</code></td><td><span class="tag ${cls}">${esc(what)}</span></td></tr>`;
  const rest = files.length - hand.length - res.length;
  return `<section class="dcard where" aria-label="Where your files are">
    <div class="hd"><h2>Where your files are</h2><small>${hand.length} to hand in, ${res.length} to read</small></div>
    ${s.folder ? `<p class="path"><span class="lab">Folder</span><code>${esc(s.folder)}</code></p>` : ''}
    ${hand.length || res.length ? `<div class="wrap"><table><thead><tr><th>File name</th><th>Format</th><th>Inside the folder</th><th>What it is</th></tr></thead>
      <tbody>${hand.map(f => row(f, 'Hand in', 'ok')).join('')}${res.map(f => row(f, RESULT_FILES[f.path], 'idle')).join('')}</tbody></table></div>` : '<p class="empty">No files yet.</p>'}
    ${rest > 0 ? `<p class="rest">Plus ${rest} working file${rest === 1 ? '' : 's'} (logs, saved pages, scripts), mostly in <code>process/</code>.</p>` : ''}
  </section>`;
}

/* ---------- dashboard pieces: greeting, activity chart, runs table ---------- */
let runsList = [], meName = '';
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
function nowLine(s) {
  const ag = s.agents, run = ag.find(a => a.state === 'running'), title = `<b>${esc(clip(String(s.title || ''), 46))}</b>`;
  if (run) return `The ${esc(run.label)} is working on ${title}.`;
  if (ag.some(a => a.state === 'error')) return `${title} stopped with a problem.`;
  if (ag.every(a => a.state === 'done' || a.state === 'skipped')) {
    const ev = ag.find(a => a.id === 'evaluator'), v = ev && ev.outputText ? verdict(ev.outputText) : { score: null };
    return `${title} is finished${v.score === null ? '' : `: ${v.score} out of 100`}.`;
  }
  if (ag.every(a => a.state === 'waiting')) return `${title} is waiting to start.`;
  return `Nothing is running on ${title}.`;
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
const RUN_LABELS = ['Analyst', 'Source finder', 'Researcher', 'Builder', 'Evaluator'];
function runState(r) {
  const st = r.states || [], i = st.indexOf('running');
  // older runs have no Researcher: their states are in the old order
  const labels = st.length < RUN_LABELS.length ? RUN_LABELS.filter(l => l !== 'Researcher') : RUN_LABELS;
  if (i >= 0) return ['run', (labels[i] || 'An agent') + ' working'];
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
const KID = {
  analyst: { done: 'read the brief and made a checklist', running: 'is reading the brief', waiting: 'reads the brief first' },
  finder: { done: 'looked things up', running: 'is looking things up', waiting: 'looks things up next' },
  researcher: { done: 'read the sources closely and planned the work', running: 'is reading the sources closely', waiting: 'checks the facts before the work starts' },
  builder: { done: 'did the work and checked it', running: 'is doing the work', waiting: 'does the work after that' },
  evaluator: { done: 'marked the work', running: 'is marking the work', waiting: 'marks the work at the end' },
};
// What kind of step is this? A picture and a plain word for it.
// A step failed only if it names a failure and isn't just recalling an earlier one ("worked this time (403 last run)")
const recovered = t => /worked this time|no page failed|last run|last time|loaded this time/i.test(t);
function kind(t) {
  if (/as expected|^proved/i.test(t)) return ['✅', 'checked'];
  if (/403|returned empty|couldn.?t open/i.test(t) && !recovered(t)) return ['🚫', "couldn't open"];
  if (/blocked|failed|not allowed|refused/i.test(t) && !recovered(t)) return ['✋', "wasn't allowed"];
  if (/^start/i.test(t)) return ['🚀', 'started'];
  if (/must fix|does not match|mismatch/i.test(t)) return ['⚠️', 'flagged'];
  if (/^(built|made|created)\b/i.test(t)) return ['🧱', 'built'];
  if (/placeholder|left open|not given|skipped by/i.test(t)) return ['📝', 'noted'];
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
  [/\bresearch\.md\b/g, 'the checked facts and plan (research.md)'],
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
  const part = sect(b.outputText || '', 'What (?:the user|you) (?:must|still need to) do|Left for (?:you|the user)|Manual steps|Your remaining steps|By hand') || '';
  return part.split('\n').filter(l => /^\s*(\d+\.|[-*])\s+/.test(l)).map(l => l.replace(/^\s*(\d+\.|[-*])\s+/, '').replace(/\*\*/g, ''));
}

function story(s) {
  const ag = s.agents, created = (s.events[0] || {}).t || s.created;
  let n = 0;
  const chapters = ag.map((a, i) => {
    const K = KID[a.id] || { done: 'did its part', running: 'is working', waiting: 'is waiting' };
    const items = logItems(a.logText), T = TEAM[a.id], key = 'ch-' + a.id, open = openDisc.has(key);
    const first = n + 1; n += items.length;
    const show = open || items.length <= 4 ? items : items.slice(-4);
    const verb = a.state === 'done' ? K.done : a.state === 'running' ? K.running : a.state === 'skipped' ? 'was skipped' : K.waiting;
    const when = a.started ? `${fmtTime(a.started)} to ${a.finished ? fmtTime(a.finished) : 'now'}` : '';
    const took = a.started ? (a.finished ? dur(a.started, a.finished) : dur(a.started)) : '';
    const steps = show.map((it, k) => {
      const [pic, word] = kind(it.t), num = first + (items.length - show.length) + k, live = a.state === 'running' && k === show.length - 1;
      return `<li class="${live ? 'live' : ''}"><span class="pic">${pic}</span><span><span class="num">Step ${num}</span><span class="word">${word}</span>
        <span class="say${open ? '' : ' clamp'}" title="${esc(plain(it.t))}">${esc(plain(it.t))}</span></span></li>`;
    }).join('');
    let extra = '';
    if (a.id === 'finder' && items.length) {
      const u = sitesUsed(s);
      extra = `${u.sites.length ? `<div class="chips">${u.sites.slice(0, 8).map(st => `<a class="chipx site" href="${esc(st.pages[0].url)}" target="_blank" rel="noopener" title="${esc(siteName(st.host))}">${esc(st.host)}<i class="n">${st.pages.length}</i></a>`).join('')}${more(u.sites.length, 8)}</div>` : ''}
        ${u.failed.length ? `<div class="chips"><span class="tag idle">${u.failed.length} would not open</span></div>` : ''}`;
    }
    return `<section class="ch s-${a.state}" style="--team:${T.dot}">
      <div class="ch-head"><span class="ch-n">${i + 1}</span>
        <div class="ch-title">The <b>${esc(a.label)}</b> ${esc(verb)}</div>
        <div class="ch-meta">${when ? `<span>${esc(when)}</span>` : ''}${took ? `<span>${esc(took)}</span>` : ''}${items.length ? `<span>${items.length} steps</span>` : ''}</div></div>
      ${a.state === 'waiting' ? '' : tiles(tilesFor(s, a))}
      ${extra}
      ${items.length ? `<ol class="steps" id="d-${key}">${steps}</ol>${items.length > 4 ? disclosure(key, `Show all ${items.length} steps`, 'Show only the last 4') : ''}` : ''}
    </section>`;
  }).join('');
  const b = ag[ag.length - 1], left = handIns(s), allDone = ag.every(a => a.state === 'done' || a.state === 'skipped');
  return `<div class="story full">
    <section class="ch start"><div class="ch-head"><span class="ch-n">🏁</span><div class="ch-title"><b>Started</b> at ${fmtTime(created) || '–'}</div>
      <div class="ch-meta"><span class="tag idle">AI help: ${esc(String(s.aiPolicy).replace('_', ' '))}</span></div></div></section>
    ${chapters}
    <section class="ch finish ${allDone ? 's-done' : ''}"><div class="ch-head"><span class="ch-n">${allDone ? '🏆' : '⏳'}</span>
      <div class="ch-title">${allDone ? `<b>Ended</b> at ${fmtTime(b.finished)}` : '<b>Not finished yet</b>'}</div>
      <div class="ch-meta"><span>${allDone ? 'Handing in is your step' : 'Updates by itself'}</span></div></div>
      ${allDone && left.length ? `<div class="left"><span class="lab">Left for you</span><ol>${left.slice(0, 3).map(x => `<li>${esc(clip(x, 110))}</li>`).join('')}</ol>${more(left.length, 3)}</div>` : ''}
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
    (a.id === 'builder' && (f.path.startsWith('deliverables/') || (f.path.startsWith('process/') && !/(analyst|finder|researcher|evaluator)-log\.md$/.test(f.path)))));
}
function statusLine(a) {
  const T = TEAM[a.id] || { verb: 'Working' };
  if (a.state === 'running') return `<div class="status"><span class="ic spin">${SPIN[spinI]}</span><span><span class="verb">${T.verb}…</span> <span class="dim">(<span class="el" data-start="${esc(a.started)}">${dur(a.started)}</span>)</span></span></div>`;
  if (a.state === 'done') return `<div class="status"><span class="ic">⏺</span><span>Done <span class="dim">in ${dur(a.started, a.finished)}</span></span></div>`;
  if (a.state === 'skipped') return `<div class="status"><span class="ic">⊘</span><span>Skipped</span></div>`;
  return `<div class="status"><span class="ic">○</span><span>Waiting</span></div>`;
}
// The log as a compact timeline: the last 5 steps, each clamped to 2 lines, with one toggle for the rest
function logHtml(a) {
  const items = logItems(a.logText), running = a.state === 'running', key = 'log-' + a.id, open = openDisc.has(key);
  if (!items.length) return `<div class="md clamp4">${md(a.logText)}</div>`;
  const show = open || items.length <= 5 ? items : items.slice(-5), skip = items.length - show.length;
  return `<ol class="log" id="d-${key}" start="${skip + 1}">${show.map((it, i) => `<li class="${running && i === show.length - 1 ? 'last' : ''}"><span class="ic" aria-hidden="true"></span><span class="tx${open ? '' : ' clamp'}" title="${esc(it.t)}">${it.n ? `<span class="n">${esc(it.n)}</span>` : ''}${esc(it.t)}</span></li>`).join('')}</ol>
    ${items.length > 5 ? disclosure(key, `Show all ${items.length} steps`, 'Show only the last 5') : ''}`;
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
      <div class="s3-hint">Drag to look around</div>
      ${a.state === 'done' ? '<span class="s3-done">✓ done</span>' : ''}
    </section>
    <section class="hero s-${a.state}">
      <div class="hero-top"><h1>${esc(a.label)}</h1><span class="handle">Step ${i + 1} of ${ag.length}</span>${statusLine(a)}</div>
      <div class="io"><span class="lab">Reads</span>${a.reads.map(r => `<span class="chip">${esc(r)}</span>`).join('')}<span class="lab">Writes</span><span class="chip out">${esc(a.output)}</span>
        <span class="lab">Then</span><span class="chip plain">${next ? esc(next.label) : 'you'}</span></div>
    </section>
    <div class="two">
      ${resultCard(s, a, false)}
      <section class="panel"><div class="bar"><b>What it's doing</b><span class="r">${logItems(a.logText).length || 'no'} steps</span></div>
        <div class="body">${a.logText ? logHtml(a) : `<p class="empty">No activity yet.</p>`}</div></section>
    </div>
    <div class="two tight">
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
  // a run with the Researcher has five rooms, an older one four: build the office again when that changes
  if (office3d && office3d.five !== list.some(a => a.id === 'researcher')) { office3d.dispose(); office3d = null; }
  if (office3d) { office3d.attach(host); office3d.setAgents(list); return; }
  try { office3d = Office3D.mountOffice(host, list, team => { location.hash = '#/' + team; }); } catch (e) { console.error(e); office3d = null; }
}
// Static demo: move every timestamp so the demo's "now" is the real now, keeping it looking live.
let demoOffset = null;
function demoShift(d) {
  if (!d.demoNow) return d;
  if (demoOffset === null) demoOffset = Date.now() - new Date(d.demoNow).getTime();
  const local = t => { if (!t) return t; const x = new Date(new Date(t).getTime() + demoOffset); const p = n => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`; };
  d.created = local(d.created); d.updated = local(d.updated);
  d.agents.forEach(a => { a.started = local(a.started); a.finished = local(a.finished); });
  d.events.forEach(e => { e.t = local(e.t); });
  d.files.forEach(f => { f.mtime += demoOffset / 1000; });
  delete d.demoNow;
  return d;
}
function demoRuns(rs) {
  rs.forEach(r => {
    if (!r.demoNow) return;
    const off = Date.now() - new Date(r.demoNow).getTime(), p = n => String(n).padStart(2, '0');
    const local = t => { if (!t) return t; const x = new Date(new Date(t).getTime() + off);
      return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`; };
    r.created = local(r.created); r.updated = local(r.updated); delete r.demoNow;
  });
  return rs;
}
const route = () => (location.hash.match(/^#\/(\w+)/) || [])[1] || '';
function markRail(s) {
  const r = route(), play = $('#railPlay');
  if (play) play.href = 'playground.html?run=' + runId;      // the playground is a separate page
  document.querySelectorAll('#rail a').forEach(el => {
    const on = el.dataset.nav === r;
    el.classList.toggle('on', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    const ag = s && s.agents.find(x => x.id === el.dataset.nav);
    el.classList.toggle('busy', !!(ag && ag.state === 'running'));
    if (el.dataset.nav === 'researcher') el.hidden = !!s && !ag;   // older runs have no Researcher
  });
}
const sigNow = () => JSON.stringify(current) + JSON.stringify(runsList) + runId + meName + route();
// Redraw, keeping the keyboard focus on a "show more" button if it had it
function render(s) {
  const held = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.disc : null;
  draw(s);
  if (held) { const again = document.querySelector(`[data-disc="${held}"]`); if (again) again.focus({ preventScroll: true }); }
}
function draw(s) {
  markRail(s);
  const a = s.agents.find(x => x.id === route());
  $('#crumb').textContent = a ? a.label : route() === 'story' ? 'What happened' : '';
  if (a) { $('#main').innerHTML = agentPage(s, a); mountOffice3d(null); mount3d(a); return; }
  mount3d(null);
  if (route()) mountOffice3d(null);
  if (route() === 'story') {
    $('#main').innerHTML = `<div class="page storypage"><h1>The whole story</h1>
      <p class="lead">${esc(s.title)}</p>
      ${story(s)}<div class="stepnav"><a href="#/">← Back to the office</a></div></div>`;
    return;
  }
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
        <div class="s3-hint">Drag to look around. Click a room to open it.</div>
      </div></div>` : `<div class="floor">${office(s)}
      <div class="hint">Drag to move. Click a team to open it.</div>
      <div class="zoom"><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="reset" aria-label="Reset view">⌂</button></div>
    </div>`}</section>
    ${whereCard(s)}
    </div>${sidebar(s)}</div>`;
  if (has3d) mountOffice3d(s); else applyCam();
}

let runId = 0, current = null, lastSig = '';
try { const v = localStorage.getItem('pipe.run'); if (v !== null) runId = +v; } catch (e) {}
async function tick() {
  try {
    const rs = demoRuns(await (await fetch('data/runs.json')).json());
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
      current = demoShift(await (await fetch('data/run-' + runId + '.json')).json());
      // re-render only when the data changes, so the workers' animations run uninterrupted
      const sig = sigNow();
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
  const dsc = e.target.closest('[data-disc]');
  if (dsc) {   // a "show more" button: remember it, redraw, and put the keyboard focus back on the same button
    const key = dsc.dataset.disc, y = window.scrollY;
    if (openDisc.has(key)) openDisc.delete(key); else openDisc.add(key);
    if (current) { render(current); lastSig = sigNow(); }
    const again = document.querySelector(`[data-disc="${key}"]`); if (again) again.focus({ preventScroll: true });
    window.scrollTo(0, y);
    return;
  }
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
fetch('data/me.json').then(r => r.ok ? r.json() : {}).then(m => {
  meName = String((m && m.name) || '').trim();
  if (meName) { $('#meName').textContent = meName; $('#meAv').textContent = meName[0].toUpperCase(); $('#me').hidden = false; lastSig = ''; }
}).catch(() => {});
iconsReady.then(() => { tick(); setInterval(tick, 2000); });
