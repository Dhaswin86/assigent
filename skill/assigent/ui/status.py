#!/usr/bin/env python3
"""Record pipeline progress in <assignment folder>/status.json for the agent viewer.

  status.py init  <folder> "<title>" <aiPolicy>
  status.py policy <folder> <aiPolicy>            (when the AI policy is settled later)
  status.py playground start|done|skip|error <folder> "<text>"   (the Tutor's playground, kept beside the four agents)
  status.py start <folder> <agent> "<what it is doing>"
  status.py event <folder> <agent> "<message>"
  status.py done  <folder> <agent> "<summary>"
  status.py skip  <folder> <agent> "<reason>"
  status.py error <folder> <agent> "<message>"

<agent> is analyst, finder, builder or evaluator.
"""
import json, sys, os
from datetime import datetime

AGENTS = [
    {"id": "analyst", "name": "assigent-analyst", "label": "Analyst",
     "role": "Reads the brief and turns it into a checkable plan",
     "reads": ["assignment-source.md", "inputs/"], "output": "brief.md",
     "log": "process/analyst-log.md"},
    {"id": "finder", "name": "assigent-finder", "label": "Source finder",
     "role": "Finds docs, tutorials and past work for each requirement",
     "reads": ["brief.md"], "output": "sources.md",
     "log": "process/finder-log.md"},
    {"id": "builder", "name": "assigent-builder", "label": "Builder",
     "role": "Does the assignment and checks it against the brief",
     "reads": ["brief.md", "sources.md", "inputs/"], "output": "report.md",
     "log": "process/builder-log.md"},
    {"id": "evaluator", "name": "assigent-evaluator", "label": "Evaluator",
     "role": "Marks the finished work like a strict reviewer and lists what to fix",
     "reads": ["assignment-source.md", "brief.md", "report.md", "deliverables/"],
     "output": "evaluation.md", "log": "process/evaluator-log.md"},
]


def now():
    return datetime.now().isoformat(timespec="seconds")


def load(folder):
    with open(os.path.join(folder, "status.json")) as f:
        return json.load(f)


def save(folder, s):
    s["updated"] = now()
    tmp = os.path.join(folder, "status.json.tmp")
    with open(tmp, "w") as f:
        json.dump(s, f, indent=1)
    os.replace(tmp, os.path.join(folder, "status.json"))


def playground(argv):
    """status.py playground start|done|skip|error <folder> "<text>". Older status.json files have no such key."""
    if len(argv) < 4 or argv[2] not in ("start", "done", "skip", "error"):
        sys.exit(__doc__)
    what, folder, msg = argv[2], os.path.expanduser(argv[3]), argv[4] if len(argv) > 4 else ""
    s = load(folder)
    p = s.get("playground") or {"state": "waiting", "started": None, "finished": None, "title": "", "summary": ""}
    if what == "start":
        p.update(state="running", started=now(), finished=None, summary=msg)
    else:
        p.update(state={"done": "done", "skip": "skipped", "error": "error"}[what], finished=now(), summary=msg)
    try:  # the Tutor writes the title into playground/playground.json
        with open(os.path.join(folder, "playground", "playground.json")) as f:
            title = json.load(f).get("title")
        if isinstance(title, str) and title.strip():
            p["title"] = title.strip()
    except (OSError, ValueError, AttributeError):
        pass
    s["playground"] = p
    s.setdefault("events", []).append({"t": now(), "agent": "tutor", "kind": what, "msg": msg or f"Playground {p['state']}"})
    save(folder, s)


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    if argv[1] == "playground":
        return playground(argv)
    cmd, folder = argv[1], os.path.expanduser(argv[2])
    if cmd == "init":
        title, policy = argv[3], argv[4]
        s = {"title": title, "aiPolicy": policy, "folder": folder,
             "created": now(), "agents": [], "events": []}
        for a in AGENTS:
            s["agents"].append({**a, "state": "waiting", "started": None,
                                "finished": None, "summary": ""})
        s["events"].append({"t": now(), "agent": "pipeline",
                            "msg": f"Pipeline created (AI policy: {policy})"})
        save(folder, s)
        return
    if cmd == "policy":
        s = load(folder)
        s["aiPolicy"] = argv[3]
        s["events"].append({"t": now(), "agent": "pipeline", "kind": "event",
                            "msg": f"AI policy set to {argv[3]}"})
        save(folder, s)
        return
    agent, msg = argv[3], argv[4] if len(argv) > 4 else ""
    s = load(folder)
    a = next((x for x in s["agents"] if x["id"] == agent), None)
    if a is None and agent != "pipeline":
        sys.exit(f"unknown agent {agent}")
    if cmd == "start":
        a.update(state="running", started=now(), finished=None)
    elif cmd == "done":
        a.update(state="done", finished=now(), summary=msg)
    elif cmd == "skip":
        a.update(state="skipped", finished=now(), summary=msg)
    elif cmd == "error":
        a.update(state="error", finished=now(), summary=msg)
    elif cmd != "event":
        sys.exit(f"unknown command {cmd}")
    s["events"].append({"t": now(), "agent": agent, "kind": cmd, "msg": msg})
    save(folder, s)


if __name__ == "__main__":
    main(sys.argv)
