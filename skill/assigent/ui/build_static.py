#!/usr/bin/env python3
"""Build a static, public-safe copy of the Assigent viewer for the public start page.

  python3 build_static.py <out-dir>

The live viewer reads private assignment folders through server.py. This copy instead ships
one made-up demo run (data/run-0.json), so no real assignment content is published.
Timestamps in the demo are shifted to "now" when the page loads, so the working agent's
timer and the story read naturally.
"""
import json, os, shutil, sys
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))

BRIEF = """# Brief: Build a Simple To-Do App

## 1. Title and track
Build a Simple To-Do App · Technology / JavaScript · AI policy: **preferred**

## 2. Goal in one sentence
Show you can build a small web page that adds, ticks off and removes tasks, and remembers them.

## 3. Deliverables
1. A working web page (index.html, style.css, app.js)
2. A short write-up explaining how it works

## 4. Requirements checklist
- [ ] A text box and an Add button create a new task
- [ ] Clicking a task ticks it off (strike-through)
- [ ] Each task has a delete button
- [ ] Tasks are saved in localStorage and come back after a refresh
- [ ] Empty tasks are not allowed
- [ ] The page works on a phone screen

## 7. Ambiguities / questions for the user
BLOCKING: no
- Should finished tasks move to the bottom? Default: keep them in place.
"""

SOURCES = """# Sources

## Making the page react to clicks
- MDN "Introduction to events": https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events
- MDN "addEventListener": https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener

## Remembering tasks
- MDN "Window.localStorage": https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- web.dev "Storage for the web": https://web.dev/articles/storage-for-the-web

## Building the list
- W3Schools "How to create a to-do list": https://www.w3schools.com/howto/howto_js_todolist.asp
- javascript.info "Modifying the document": https://javascript.info/modifying-document

## Phone screens
- MDN "Responsive design": https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design

## Gaps
- None; every requirement has a source.
"""

LOGS = {
    "analyst": [
        "Started: reading the homework text",
        "Read assignment-source.md: one web page, 2 deliverables, AI policy preferred",
        "Looking for related past work in the save folder",
        "Found an earlier Bill Splitter page that also uses buttons and lists",
        "Writing brief.md (1 ambiguity, BLOCKING: no)",
        "brief.md written: 2 deliverables, 6 checklist items. Done.",
    ],
    "finder": [
        "Started: reading brief.md",
        "Searched for how to add tasks with JavaScript buttons",
        "Opened MDN \"Introduction to events\": how a click runs code",
        "Opened MDN \"addEventListener\": the exact way to listen for clicks",
        "Opened MDN \"Window.localStorage\": saving tasks so they survive a refresh",
        "Tried a blog post about to-do apps: blocked (403). Skipped",
        "Opened W3Schools to-do list guide: a simple full example",
        "Opened javascript.info \"Modifying the document\": adding and removing list items",
        "Opened MDN \"Responsive design\": making it fit a phone",
        "Writing sources.md",
    ],
    "builder": [
        "Started: reading brief, sources and inputs",
        "Read brief and sources. Plan: index.html, style.css, app.js, then a write-up",
        "Wrote index.html and style.css: input, Add button, task list",
        "Writing app.js: add, tick off and delete tasks",
    ],
    "evaluator": [],
}


def demo_run():
    now = datetime(2026, 1, 1, 10, 30, 0)
    t = lambda m: (now - timedelta(minutes=m)).isoformat(timespec="seconds")
    agents = [
        {"id": "analyst", "name": "assigent-analyst", "label": "Analyst",
         "role": "Reads the brief and turns it into a checkable plan",
         "reads": ["assignment-source.md", "inputs/"], "output": "brief.md", "log": "process/analyst-log.md",
         "state": "done", "started": t(9), "finished": t(8), "summary": "2 deliverables, 6 checklist items, not blocking, small effort."},
        {"id": "finder", "name": "assigent-finder", "label": "Source finder",
         "role": "Finds docs, tutorials and past work for each requirement",
         "reads": ["brief.md"], "output": "sources.md", "log": "process/finder-log.md",
         "state": "done", "started": t(8), "finished": t(5), "summary": "7 sources (mostly MDN), every requirement covered."},
        {"id": "builder", "name": "assigent-builder", "label": "Builder",
         "role": "Does the assignment and checks it against the brief",
         "reads": ["brief.md", "sources.md", "inputs/"], "output": "report.md", "log": "process/builder-log.md",
         "state": "running", "started": t(4), "finished": None, "summary": ""},
        {"id": "evaluator", "name": "assigent-evaluator", "label": "Evaluator",
         "role": "Marks the finished work like a strict reviewer and lists what to fix",
         "reads": ["assignment-source.md", "brief.md", "report.md", "deliverables/"], "output": "evaluation.md",
         "log": "process/evaluator-log.md", "state": "waiting", "started": None, "finished": None, "summary": ""},
    ]
    for a in agents:
        a["outputText"] = None
        a["logText"] = None if not LOGS[a["id"]] else f"# {a['label']} log\n\n" + "".join(f"- **step {i + 1}** {line}\n" for i, line in enumerate(LOGS[a["id"]]))
    agents[0]["outputText"], agents[1]["outputText"], agents[2]["outputText"] = BRIEF, SOURCES, None
    events = [
        {"t": t(10), "agent": "pipeline", "msg": "Pipeline created (AI policy: preferred)"},
        {"t": t(9), "agent": "analyst", "kind": "start", "msg": "Reading the brief and inputs"},
        {"t": t(8), "agent": "analyst", "kind": "done", "msg": agents[0]["summary"]},
        {"t": t(8), "agent": "finder", "kind": "start", "msg": "Finding sources for each requirement"},
        {"t": t(5), "agent": "finder", "kind": "done", "msg": agents[1]["summary"]},
        {"t": t(4), "agent": "builder", "kind": "start", "msg": "Building the to-do app"},
        {"t": t(1), "agent": "builder", "kind": "event", "msg": "index.html and style.css written"},
    ]
    ts = now.timestamp()
    files = [{"path": p, "size": z, "mtime": ts - age} for p, z, age in [
        ("assignment-source.md", 1840, 600), ("brief.md", len(BRIEF), 480), ("sources.md", len(SOURCES), 300),
        ("deliverables/index.html", 1210, 150), ("deliverables/style.css", 960, 140),
        ("process/analyst-log.md", 420, 480), ("process/finder-log.md", 760, 300), ("process/builder-log.md", 330, 60),
        ("status.json", 2100, 30)]]
    return {"title": "DEMO · Build a Simple To-Do App", "aiPolicy": "preferred",
            "folder": "~/Documents/Assignments/To-Do App (demo)",
            "created": t(10), "updated": t(1), "agents": agents, "events": events, "files": files,
            "demoNow": now.isoformat(timespec="seconds")}


def build(out):
    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    shutil.copytree(os.path.join(HERE, "icons"), os.path.join(out, "icons"), dirs_exist_ok=True)
    for name in ("office3d.js", "style.css"):
        shutil.copy(os.path.join(HERE, name), os.path.join(out, name))
    run = demo_run()
    with open(os.path.join(out, "data", "run-0.json"), "w") as f:
        json.dump(run, f, indent=1)
    with open(os.path.join(out, "data", "runs.json"), "w") as f:
        json.dump([{"id": 0, "title": run["title"], "aiPolicy": run["aiPolicy"], "updated": run["updated"],
                    "created": run["created"], "files": len(run["files"]), "score": None, "verdict": None,
                    "demoNow": run["demoNow"], "states": [a["state"] for a in run["agents"]]}], f, indent=1)
    with open(os.path.join(out, "data", "me.json"), "w") as f:
        json.dump({"name": ""}, f)

    # index.html holds the page, app.js the page logic; each swap applies to whichever file has the text
    files = {"index.html": open(os.path.join(HERE, "index.html")).read(),
             "app.js": open(os.path.join(HERE, "app.js")).read()}
    swaps = [
        ("fetch('/icons/' + file + '.svg')", "fetch('icons/' + file + '.svg')"),
        ('<script src="/office3d.js"></script>', '<script src="office3d.js"></script>'),
        ("await (await fetch('/api/runs')).json()", "demoRuns(await (await fetch('data/runs.json')).json())"),
        ("fetch('/api/me')", "fetch('data/me.json')"),
        ("current = await (await fetch('/api/run?id=' + runId)).json();",
         "current = demoShift(await (await fetch('data/run-' + runId + '.json')).json());"),
        ('<span class="conn"><i></i>Reading your assignment folders</span>', '<span class="conn"><i></i>Demo data, not a real assignment</span>'),
        ("const route = () =>", """// Static demo: move every timestamp so the demo's "now" is the real now, keeping it looking live.
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
const route = () =>"""),
    ]
    for a, b in swaps:
        name = next((n for n, text in files.items() if a in text), None)
        if not name:
            sys.exit(f"build_static: expected text not found: {a[:60]}")
        files[name] = files[name].replace(a, b, 1)
    for name, text in files.items():
        with open(os.path.join(out, name), "w") as f:
            f.write(text)
    open(os.path.join(out, ".nojekyll"), "w").close()
    print("built", out)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(os.path.abspath(os.path.expanduser(sys.argv[1])))
