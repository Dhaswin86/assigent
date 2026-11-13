/* Assigent playground page: one run's playground in a sandboxed frame, with a small header.
   A separate page from the dashboard. It only reads; the playground itself never gets this page's origin. */
const API = { runs: 'data/runs.json', run: id => 'data/run-' + id + '.json', play: id => 'play/' + id + '/index.html' };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5h6a1.5 1.5 0 0 1 1.5 1.5v1.5h1.5a2.500 2.500 0 0 1 0 5H16.500V18a1.500 1.500 0 0 1-1.500 1.500h-2v-1.500a1.500 1.500 0 0 0-3 0v1.500H9A1.500 1.500 0 0 1 7.500 18v-4H6a2 2 0 0 1 0-4h1.500V6A1.500 1.500 0 0 1 9 4.500z"/></svg>';
const asked = new URLSearchParams(location.search).get('run');
let runId = asked !== null && /^\d+$/.test(asked) ? +asked : null, lastHead = '', lastFrame = '';

function empty(title, line, busy) {
  return `<div class="play-stage"><div class="play-empty" id="empty"><span class="glyph${busy ? ' busy' : ''}">${GLYPH}</span><b>${esc(title)}</b><span>${esc(line)}</span></div></div>`;
}
function head(run, p) {
  const n = (p.activities || []).length;
  return `<div class="play-head"><h1>${esc(p.title || run.title || 'Playground')}</h1>
    <div class="chips">${(p.concepts || []).map(c => `<span class="chipx">${esc(c)}</span>`).join('')}
      ${n ? `<span class="tag go">${n} activities</span>` : ''}${p.minutes ? `<span class="tag idle">${esc(p.minutes)} min</span>` : ''}</div>
    ${p.hasFile ? `<a class="btn-pill sm" id="full" href="${API.play(runId)}" target="_blank" rel="noopener">Open full screen</a>` : ''}</div>`;
}
async function tick() {
  try {
    const rs = await (await fetch(API.runs)).json();
    const withPlay = rs.filter(r => r.playground && r.playground.state !== 'none');
    if (runId === null || !rs.some(r => r.id === runId)) runId = withPlay.length ? withPlay[0].id : (rs[0] ? rs[0].id : null);
    const sel = $('#runSel'), here = rs.find(r => r.id === runId);
    // the picker lists the runs that have a playground, newest first; the run that was asked for is always in it
    const listed = withPlay.some(r => r.id === runId) || !here ? withPlay : [here, ...withPlay];
    const opts = listed.map(r => `<option value="${r.id}">${esc(r.title)}${r.playground && r.playground.state !== 'none' ? '' : ' (no playground)'}</option>`).join('');
    if (sel.innerHTML !== opts) sel.innerHTML = opts;
    if (runId !== null) sel.value = runId;
    $('#back').href = 'index.html';
    if (!here) { show('none', empty('No runs yet', 'Start one with /assigent in Claude Code.')); return done(true); }
    const run = await (await fetch(API.run(runId))).json(), p = run.playground || { state: 'none' };
    document.title = (p.title || run.title || 'Playground') + ' · Assigent playground';
    if (p.hasFile && p.state !== 'running') {
      const h = head(run, p), f = runId + '|' + (p.finished || '') ;
      if (lastFrame !== f) {      // (re)load the frame only when the run or the finished file changes
        $('#main').innerHTML = `<div id="head">${h}</div><div class="play-stage"><iframe id="play" sandbox="allow-scripts allow-popups" referrerpolicy="no-referrer"
          title="Playground: ${esc(p.title || run.title || '')}"></iframe></div>`;
        lastFrame = f; lastHead = h;
        // Load the file as text into srcdoc, not by address: a sandboxed frame has no origin, so hosts that
        // send "X-Frame-Options: SAMEORIGIN" (most static hosts) would refuse to show it. The meta tag keeps
        // the playground offline, as the viewer's own server does with a header.
        const frame = $('#play'), url = API.play(runId);
        const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:">`;
        fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(t => { if ($('#play') === frame) frame.srcdoc = CSP + t; })
          .catch(() => { if ($('#play') === frame) frame.src = url; });
      } else if (lastHead !== h) { $('#head').innerHTML = h; lastHead = h; }
    } else if (p.state === 'running') {
      show('running', head(run, p) + empty('The Tutor is making your playground', 'This page opens it by itself when it is ready.', true));
    } else if (p.state === 'skipped') {
      show('skipped', empty('No playground for this run', p.summary || 'The Tutor was skipped.'));
    } else if (p.state === 'error') {
      show('error', empty('The playground could not be made', p.summary || 'Run the Tutor again from Claude Code.'));
    } else {
      show('none', empty('No playground yet', 'The Tutor makes one after the Source finder has finished.'));
    }
    done(true);
  } catch (e) { done(false); }
}
function show(kind, html) {
  const key = kind + '|' + runId + '|' + html.length;
  if (lastFrame === key) return;
  $('#main').innerHTML = html; lastFrame = key; lastHead = '';
}
function done(ok) { $('#live').classList.toggle('off', !ok); $('#live span').textContent = ok ? 'live' : 'offline'; }
$('#runSel').addEventListener('change', e => {
  runId = +e.target.value; lastFrame = '';
  try { history.replaceState(null, '', 'playground.html?run=' + runId); } catch (err) {}
  tick();
});
tick(); setInterval(tick, 3000);
