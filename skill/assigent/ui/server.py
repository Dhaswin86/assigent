#!/usr/bin/env python3
"""Local viewer for the Assigent 4-agent pipeline. Serves on 127.0.0.1 only.

GET /                 the viewer page (index.html, style.css, app.js, office3d.js, icons/)
GET /api/runs         every assignment folder that has a status.json (with start time, file count, score)
GET /playground.html  the separate playground page (with playground.js)
GET /play/<id>/<file> a file from that run's playground/ folder, read-only and sandboxed
GET /api/me           {"name": ...}: the saved name from ~/.assigent/config.json, or "" when there is none
GET /api/run?id=N     status + the text of each agent's log and output, and the file list

Runs are looked for under the save folder: the ASSIGENT_ROOT environment variable if set,
else "save_folder" in ~/.assigent/config.json, else ~/Documents/Assignments. Any
status.json up to 4 folders deep counts as a run. PORT sets the port (default 8850).
"""
import json, os, re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

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


PLAY_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
              ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".gif": "image/gif", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8"}
# A playground is written by an agent, so it never runs with this viewer's origin: no access to /api, no network.
PLAY_CSP = "sandbox allow-scripts allow-popups; default-src 'unsafe-inline' data: blob:"


def playground_info(folder, status, full=True):
    """What is known about a run's playground. Runs made before the Tutor existed simply have none."""
    p = status.get("playground") if isinstance(status.get("playground"), dict) else {}
    has = os.path.isfile(os.path.join(folder, "playground", "index.html"))
    meta = {}
    try:
        with open(os.path.join(folder, "playground", "playground.json")) as f:
            meta = json.load(f)
    except (OSError, ValueError):
        pass
    if not isinstance(meta, dict):
        meta = {}
    state = p.get("state") or ("done" if has else "none")
    if state == "waiting" and not has:
        state = "none"
    title = meta.get("title") or p.get("title") or ""
    out = {"state": state, "title": title if isinstance(title, str) else "", "hasFile": has}
    if full:
        texts = lambda xs: [str(x)[:80] for x in xs if isinstance(x, (str, int, float))][:8] if isinstance(xs, list) else []
        acts = meta.get("activities") if isinstance(meta.get("activities"), list) else []
        out.update(concepts=texts(meta.get("concepts")),
                   activities=[{"title": str(a.get("title", ""))[:80], "kind": str(a.get("kind", ""))[:40]} for a in acts if isinstance(a, dict)][:12],
                   minutes=meta.get("minutes") if isinstance(meta.get("minutes"), (int, float)) else None,
                   summary=str(p.get("summary") or ""), started=p.get("started"), finished=p.get("finished"))
    return out


def play_file(idx, rel):
    """(bytes, content type) for a file inside run idx's playground folder, or None. Nothing outside that folder is ever served."""
    rs = runs()
    if not 0 <= idx < len(rs):
        return None
    base = os.path.realpath(os.path.join(rs[idx]["folder"], "playground"))
    target = os.path.realpath(os.path.join(base, rel))
    ctype = PLAY_TYPES.get(os.path.splitext(target)[1].lower())
    if not target.startswith(base + os.sep) or not os.path.isfile(target) or not ctype or os.path.getsize(target) > 5_000_000:
        return None
    with open(target, "rb") as f:
        return f.read(), ctype


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
                    "score": score, "verdict": verdict, "states": states,
                    "playground": playground_info(folder, s, full=False)})
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
    s["playground"] = playground_info(folder, s)
    return s


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype, extra=None):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
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
        if u.path.startswith("/play/"):
            parts = u.path[len("/play/"):].split("/", 1)
            got = play_file(int(parts[0]), unquote(parts[1])) if len(parts) == 2 and parts[0].isdigit() and parts[1] else None
            if got is None:
                return self.send(404, "not found", "text/plain")
            return self.send(200, got[0], got[1], {"Content-Security-Policy": PLAY_CSP, "X-Content-Type-Options": "nosniff"})
        assets = {"/office3d.js": "text/javascript", "/app.js": "text/javascript", "/style.css": "text/css",
                  "/playground.js": "text/javascript", "/playground.html": "text/html"}
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
