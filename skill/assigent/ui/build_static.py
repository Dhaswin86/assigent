#!/usr/bin/env python3
"""Build a static, public-safe copy of the Assigent viewer for the public start page.

  python3 build_static.py <out-dir>

The live viewer reads private assignment folders through server.py. This copy instead ships
one made-up demo run (data/run-0.json), so no real assignment content is published.
Timestamps in the demo are shifted to "now" when the page loads, so the working agent's
timer and the story read naturally.
"""
import json, os, re, shutil, sys
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))

BRIEF = """# Brief: Build a Simple To-Do App

## 1. Title and course
Build a Simple To-Do App · Web basics / JavaScript · AI policy: **preferred**

## 2. Goal in one sentence
Show you can build a small web page that adds, ticks off and removes tasks, and remembers them.

## 3. Deliverables
1. A working web page: index.html, style.css, app.js
   Required file type: .html (stated)
2. A short write-up explaining how it works
   Required file type: .docx (chosen from the deliverable's name)

## 4. Requirements checklist
- [ ] A text box and an Add button create a new task
- [ ] Clicking a task ticks it off (strike-through)
- [ ] Each task has a delete button
- [ ] Tasks are saved in localStorage and come back after a refresh
- [ ] Empty tasks are not allowed
- [ ] The page works on a phone screen

## 7. Questions this assignment needs
### Name on the write-up
- Kind: name
- Question: What name should go on the write-up?
- Needed because: the write-up has a cover line with the author's name
- Default: leave a marked placeholder

## 8. Ambiguities / questions for the user
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


BRIEF2 = """# Brief: Plan a Class Bake Sale

## 1. Title and course
Plan a Class Bake Sale · Business basics · AI policy: **preferred**

## 2. Goal in one sentence
Show you can plan a small sale: cost it, price it and pitch it.

## 3. Deliverables
1. Budget sheet with costs, prices and profit
   Required file type: .xlsx (chosen from the deliverable's name)
2. Pitch deck for the class, 5 slides
   Required file type: .pptx (chosen from the deliverable's name)
3. One-page plan for the day
   Required file type: .docx (chosen from the deliverable's name)

## 4. Requirements checklist
- [ ] The budget lists every ingredient with its cost
- [ ] Each item has a price and a profit per item
- [ ] The sheet totals costs, sales and profit with formulas
- [ ] The deck has 5 slides: idea, items, prices, plan, ask
- [ ] The plan names who does what on the day
- [ ] A break-even number of items is stated
- [ ] All three files carry the team name
- [ ] Prices are whole or half amounts

## 7. Questions this assignment needs
### What to sell
- Kind: choice
- Question: Which three items do you want to sell?
- Needed because: the brief says "choose three baked items"
- Options: cookies, brownies, banana bread | cupcakes, cookies, flapjacks | your own three
- Default: cookies, brownies, banana bread

### Team name
- Kind: name
- Question: What team name goes on the files?
- Needed because: all three files carry the team name
- Default: leave a marked placeholder

## 8. Ambiguities / questions for the user
BLOCKING: no
"""

SOURCES2 = """# Sources

## Costing and pricing
- Khan Academy "Break-even point": https://www.khanacademy.org/economics-finance-domain/core-finance
- Investopedia "Break-even analysis": https://www.investopedia.com/terms/b/breakevenanalysis.asp
- Investopedia "Markup": https://www.investopedia.com/terms/m/markup.asp

## Spreadsheet formulas
- Microsoft Support "SUM function": https://support.microsoft.com/en-us/office/sum-function
- Microsoft Support "Create a simple formula": https://support.microsoft.com/en-us/office/create-a-simple-formula

## Pitching
- Canva "How to design a presentation": https://www.canva.com/learn/presentation-design

## Gaps
- None; every requirement has a source.
"""

REPORT2 = """# Report: Plan a Class Bake Sale

## Requirements
- [x] The budget lists every ingredient with its cost
- [x] Each item has a price and a profit per item
- [x] The sheet totals costs, sales and profit with formulas
- [x] The deck has 5 slides: idea, items, prices, plan, ask
- [x] The plan names who does what on the day
- [x] A break-even number of items is stated
- [ ] All three files carry the team name: placeholder left, no team name was given
- [x] Prices are whole or half amounts

## Deliverables
- deliverables/bake-sale-budget.xlsx: 2 sheets, 14 formulas
- deliverables/bake-sale-pitch.pptx: 5 slides
- deliverables/bake-sale-plan.docx: 1 page

## What you must do
1. Put your team name where it says [YOUR TEAM NAME] in all three files.
2. Check the ingredient prices against your local shop.
3. Practise the pitch once out loud.
4. Hand the three files in yourself.
"""

EVAL2 = """# Evaluation: Plan a Class Bake Sale

Score: 88/100
Verdict: PASS
Round: 1

## Requirements
- [x] The budget lists every ingredient with its cost: PASS. 11 rows on the Costs sheet
- [x] Each item has a price and a profit per item: PASS. Columns D and E on the Prices sheet
- [x] The sheet totals costs, sales and profit with formulas: PASS. 14 formulas, none hard-typed
- [x] The deck has 5 slides: PASS. 5 slides in the asked order
- [x] The plan names who does what on the day: PASS. Table of 4 roles
- [x] A break-even number of items is stated: PASS. Stated on slide 3 and in the sheet
- [ ] All three files carry the team name: PARTIAL. Marked placeholder in all three
- [x] Prices are whole or half amounts: PASS. All 3 prices checked

## Must fix
1. bake-sale-pitch.pptx: slide 3 says break-even is 40 items, the sheet says 42. Make them match.
2. bake-sale-plan.docx: the clean-up role has no name or placeholder.

## Nice to fix
- Add a chart of profit per item to the budget sheet.

## Left for the user
- Fill in the team name.
"""

LEARN2 = """# What did you learn: Plan a Class Bake Sale

Status: DONE
Understood: 4/5

## Answers
- [x] 1. What does the break-even number tell the team? Got it. It is the sales that cover the costs.
- [x] 2. The ingredients cost more than planned. What happens to break-even? Got it. It goes up.
- [ ] 3. Why are the totals formulas and not typed numbers? Not yet. A formula updates when a price changes.
- [x] 4. Which price follows the "whole or half amounts" rule? Got it. 1.50 is a half amount.
- [x] 5. In your own words: how did you choose the prices? Got it. Cost plus a markup, then rounded.

## Revisit
- Microsoft Support "Create a simple formula"
"""

LOGS2 = {
    "analyst": ["Started: reading the assignment text", "Read assignment-source.md: 3 deliverables, AI policy preferred",
                "Two things are left open: what to sell, and the team name", "brief.md written: 3 deliverables, 8 checklist items. Done."],
    "finder": ["Started: reading brief.md", "Searched for break-even point for a small sale", "Opened Khan Academy \"Break-even point\"",
               "Opened Investopedia \"Break-even analysis\"", "Opened Investopedia \"Markup\"", "Searched for spreadsheet sum formula",
               "Opened Microsoft Support \"SUM function\"", "Opened Microsoft Support \"Create a simple formula\"",
               "Opened Canva \"How to design a presentation\"", "sources.md written: 6 sources, no gaps. Done."],
    "builder": ["Started: reading brief, sources and choices", "Plan: budget sheet first, then the deck, then the plan",
                "Built bake-sale-budget.xlsx: 2 sheets, 14 formulas", "Opened the sheet again: totals add up, break-even is 42 items",
                "Built bake-sale-pitch.pptx: 5 slides", "Built bake-sale-plan.docx: 1 page with a roles table",
                "Team name not given: left a marked placeholder in all three files", "report.md written: 7 of 8 ticked. Done."],
    "evaluator": ["Started: round 1", "Opened bake-sale-budget.xlsx: 2 sheets, 14 formulas, none hard-typed",
                  "Opened bake-sale-pitch.pptx: 5 slides in the asked order", "Slide 3 says 40 items, the sheet says 42: must fix",
                  "Opened bake-sale-plan.docx: clean-up role is empty: must fix", "evaluation.md written: 88 out of 100, pass, 2 to fix. Done."],
}


def demo_run_done():
    """A second made-up run that has finished, so the viewer has every kind of result to show."""
    now = datetime(2026, 1, 1, 10, 30, 0)
    t = lambda m: (now - timedelta(minutes=m)).isoformat(timespec="seconds")
    base = demo_run()["agents"]
    spans = {"analyst": (95, 93), "finder": (93, 88), "builder": (88, 76), "evaluator": (76, 72)}
    outs = {"analyst": BRIEF2, "finder": SOURCES2, "builder": REPORT2, "evaluator": EVAL2}
    sums = {"analyst": "3 deliverables, 8 checklist items, 2 questions, not blocking.", "finder": "6 sources on 4 websites, no gaps.",
            "builder": "3 of 3 deliverables, 7 of 8 checks ticked.", "evaluator": "88/100, PASS, 2 left to fix"}
    agents, events = [], [{"t": t(96), "agent": "pipeline", "msg": "Pipeline created (AI policy: preferred)"}]
    for a in base:
        s, f = spans[a["id"]]
        a = dict(a, state="done", started=t(s), finished=t(f), summary=sums[a["id"]], outputText=outs[a["id"]],
                 logText=f"# {a['label']} log\n\n" + "".join(f"- **step {i + 1}** {line}\n" for i, line in enumerate(LOGS2[a["id"]])))
        agents.append(a)
        events.append({"t": t(s), "agent": a["id"], "kind": "start", "msg": "Started"})
        if a["id"] == "analyst":
            events.append({"t": t(92.5), "agent": "pipeline", "kind": "event", "msg": "Answers: cookies, brownies, banana bread; team name skipped"})
        events.append({"t": t(f), "agent": a["id"], "kind": "done", "msg": sums[a["id"]]})
    ts = now.timestamp()
    files = [{"path": p, "size": z, "mtime": ts - age} for p, z, age in [
        ("assignment-source.md", 2210, 5800), ("brief.md", len(BRIEF2), 5600), ("choices.md", 410, 5500), ("sources.md", len(SOURCES2), 5300),
        ("deliverables/bake-sale-budget.xlsx", 18432, 4900), ("deliverables/bake-sale-pitch.pptx", 412672, 4700),
        ("deliverables/bake-sale-plan.docx", 24576, 4600), ("report.md", len(REPORT2), 4560), ("evaluation.md", len(EVAL2), 4320), ("learning-check.md", len(LEARN2), 4200),
        ("process/analyst-log.md", 380, 5600), ("process/finder-log.md", 720, 5300), ("process/builder-log.md", 690, 4560),
        ("process/evaluator-log.md", 540, 4320), ("status.json", 2400, 4320)]]
    return {"title": "DEMO · Plan a Class Bake Sale", "aiPolicy": "preferred", "folder": "~/Documents/Assignments/Bake Sale (demo)",
            "created": t(96), "updated": t(72), "agents": agents, "events": events, "files": files, "learningText": LEARN2,
            "demoNow": now.isoformat(timespec="seconds")}


def build(out):
    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    shutil.copytree(os.path.join(HERE, "icons"), os.path.join(out, "icons"), dirs_exist_ok=True)
    for name in ("office3d.js", "style.css"):
        shutil.copy(os.path.join(HERE, name), os.path.join(out, name))
    all_runs = [demo_run(), demo_run_done()]
    # The first demo run has a made-up playground (demo/playground/); the second has none, to show the empty state.
    with open(os.path.join(HERE, "demo", "playground", "playground.json")) as f:
        meta = json.load(f)
    shutil.copytree(os.path.join(HERE, "demo", "playground"), os.path.join(out, "play", "0"), dirs_exist_ok=True)
    all_runs[0]["playground"] = {"state": "done", "title": meta["title"], "hasFile": True, "concepts": meta["concepts"],
                                 "activities": meta["activities"], "minutes": meta["minutes"], "summary": "5 activities, about 10 minutes.",
                                 "started": all_runs[0]["agents"][1]["finished"], "finished": all_runs[0]["agents"][2]["started"]}
    all_runs[1]["playground"] = {"state": "none", "title": "", "hasFile": False, "concepts": [], "activities": [], "minutes": None, "summary": ""}
    listing = []
    for i, run in enumerate(all_runs):
        with open(os.path.join(out, "data", f"run-{i}.json"), "w") as f:
            json.dump(run, f, indent=1)
        ev = next((a for a in run["agents"] if a["id"] == "evaluator"), {})
        sc = re.search(r"^Score:\s*(\d+)\s*/\s*100", ev.get("outputText") or "", re.M)
        vd = re.search(r"^Verdict:\s*(PASS|REVISE)", ev.get("outputText") or "", re.M)
        listing.append({"id": i, "title": run["title"], "aiPolicy": run["aiPolicy"], "updated": run["updated"],
                        "created": run["created"], "files": len(run["files"]), "score": int(sc.group(1)) if sc else None,
                        "verdict": vd.group(1) if vd else None, "demoNow": run["demoNow"],
                        "states": [a["state"] for a in run["agents"]],
                        "playground": {k: run["playground"][k] for k in ("state", "title", "hasFile")}})
    with open(os.path.join(out, "data", "runs.json"), "w") as f:
        json.dump(listing, f, indent=1)
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
    # the separate playground page: same files, with the three addresses pointed at the static copies
    shutil.copy(os.path.join(HERE, "playground.html"), os.path.join(out, "playground.html"))
    js = open(os.path.join(HERE, "playground.js")).read()
    live = "const API = { runs: '/api/runs', run: id => '/api/run?id=' + id, play: id => '/play/' + id + '/index.html' };"
    if live not in js:
        sys.exit("build_static: playground.js no longer has the API line this build rewrites")
    with open(os.path.join(out, "playground.js"), "w") as f:
        f.write(js.replace(live, "const API = { runs: 'data/runs.json', run: id => 'data/run-' + id + '.json', play: id => 'play/' + id + '/index.html' };", 1))
    open(os.path.join(out, ".nojekyll"), "w").close()
    print("built", out)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(os.path.abspath(os.path.expanduser(sys.argv[1])))
