#!/usr/bin/env python3
"""Local viewer for the Assigent 4-agent pipeline. Serves on 127.0.0.1 only.

GET /                 the viewer page (index.html, style.css, app.js, office3d.js, icons/)
GET /api/runs         every assignment folder that has a status.json (with start time, file count, score)
GET /api/me           {"name": ...}: the saved name from ~/.assigent/config.json, or "" when there is none
GET /api/run?id=N     status + the text of each agent's log and output, and the file list

Runs are looked for under the save folder: the ASSIGENT_ROOT environment variable if set,
else "save_folder" in ~/.assigent/config.json, else ~/Documents/Assignments. Any
status.json up to 4 folders deep counts as a run. PORT sets the port (default 8850).
"""
import json, os, re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "8850"))
HERE = os.path.dirname(os.path.abspath(__file__))
MAX_TEXT = 200_000
MAX_DEPTH = 4


def save_folder():
    root = os.environ.get("ASSIGENT_ROOT")
    if not root:
        try:
            with open(os.path.expanduser("~/.assigent/config.json")) as f:
                root = json.load(f).get("save_folder")
        except (OSError, ValueError, AttributeError):
            root = None
    return os.path.abspath(os.path.expanduser(root or "~/Documents/Assignments"))


def status_files(root):
    """Every status.json under root, at most MAX_DEPTH folders down. Hidden folders are skipped."""
    found = []
    base = root.rstrip(os.sep).count(os.sep)
    for cur, dirs, names in os.walk(root):
        depth = cur.rstrip(os.sep).count(os.sep) - base
        dirs[:] = [] if depth >= MAX_DEPTH else [d for d in dirs if not d.startswith(".")]
        if "status.json" in names:
            found.append(os.path.join(cur, "status.json"))
            dirs[:] = []          # a run folder: no need to look inside it
    return found


def saved_name():
    try:
        with open(os.path.expanduser("~/.assigent/config.json")) as f:
            name = json.load(f).get("name")
    except (OSError, ValueError, AttributeError):
        name = ""
    return name.strip() if isinstance(name, str) else ""


def score_of(folder):
    """(score, verdict) from the Score and Verdict lines of evaluation.md, or (None, None)."""
    try:
        with open(os.path.join(folder, "evaluation.md"), errors="replace") as f:
            text = f.read(20000)
    except OSError:
        return None, None
    s = re.search(r"^Score:\s*(\d{1,3})\s*/\s*100", text, re.M)
    v = re.search(r"^Verdict:\s*(PASS|REVISE)\b", text, re.M)
    return (int(s.group(1)) if s else None), (v.group(1) if v else None)


def runs():
    paths = status_files(save_folder())
    out = []
    for p in paths:
        try:
            with open(p) as f:
                s = json.load(f)
            states = [a["state"] for a in s.get("agents", [])]
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            continue
        folder = os.path.dirname(p)
        score, verdict = score_of(folder)
        out.append({"folder": folder, "title": s.get("title"),
                    "aiPolicy": s.get("aiPolicy"), "updated": s.get("updated", ""),
                    "created": s.get("created", ""), "files": len(file_tree(folder)),
                    "score": score, "verdict": verdict, "states": states})
    out.sort(key=lambda r: r["updated"], reverse=True)
    for i, r in enumerate(out):
        r["id"] = i
    return out


def read_text(folder, rel):
    p = os.path.realpath(os.path.join(folder, rel))
    if not p.startswith(os.path.realpath(folder) + os.sep) or not os.path.isfile(p):
        return None
    with open(p, errors="replace") as f:
        return f.read(MAX_TEXT)


def file_tree(folder):
    files = []
    for root, dirs, names in os.walk(folder):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for n in names:
            if n.startswith(".") or n.endswith(".tmp"):
                continue
            full = os.path.join(root, n)
            st = os.stat(full)
            files.append({"path": os.path.relpath(full, folder), "size": st.st_size,
                          "mtime": st.st_mtime})
    files.sort(key=lambda f: f["path"])
    return files


def run_detail(idx):
    rs = runs()
    if not 0 <= idx < len(rs):
        return None
    folder = rs[idx]["folder"]
    with open(os.path.join(folder, "status.json")) as f:
        s = json.load(f)
    for a in s["agents"]:
        a["logText"] = read_text(folder, a["log"])
        a["outputText"] = read_text(folder, a["output"])
    s["files"] = file_tree(folder)
    return s


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                return self.send(200, f.read(), "text/html; charset=utf-8")
        if u.path.startswith("/icons/") and u.path.endswith(".svg"):
            name = os.path.basename(u.path)
            p = os.path.join(HERE, "icons", name)
            if os.path.isfile(p):
                with open(p, "rb") as f:
                    return self.send(200, f.read(), "image/svg+xml")
        assets = {"/office3d.js": "text/javascript", "/app.js": "text/javascript", "/style.css": "text/css"}
        if u.path in assets:
            with open(os.path.join(HERE, u.path.lstrip("/")), "rb") as f:
                return self.send(200, f.read(), assets[u.path] + "; charset=utf-8")
        if u.path == "/api/me":
            return self.send(200, json.dumps({"name": saved_name()}), "application/json")
        if u.path == "/api/runs":
            return self.send(200, json.dumps(runs()), "application/json")
        if u.path == "/api/run":
            try:
                idx = int(parse_qs(u.query).get("id", ["0"])[0])
            except ValueError:
                idx = -1
            d = run_detail(idx)
            if d is None:
                return self.send(404, '{"error":"no such run"}', "application/json")
            return self.send(200, json.dumps(d), "application/json")
        self.send(404, "not found", "text/plain")

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Assigent viewer on http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
