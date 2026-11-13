#!/usr/bin/env python3
"""End-to-end checks for the Assigent viewer, run against the static demo build.

  python3 build_static.py /tmp/ao-test
  python3 ~/.claude/skills/webapp-testing/scripts/with_server.py \
      --server "python3 -m http.server 8860 --directory /tmp/ao-test" --port 8860 \
      -- python3 tests/test_office.py http://localhost:8860 <screenshot-dir>

Prints one line per check and exits non-zero if any check fails.
"""
import sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8860"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else "/tmp"
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def office_box(page):
    """The office is one card on a scrolling dashboard: bring it to the middle of the window, then measure it."""
    page.evaluate("document.querySelector('#office3d').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(250)
    return page.locator("#office3d canvas").bounding_box()


def view(page, which="office3d"):
    return page.evaluate(f"{which} && {which}.view")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    # --- home: the 360° office ---
    page.goto(BASE + "/#/")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("#office3d canvas", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=os.path.join(SHOTS, "test-home.png"))
    check("home renders the 3D office canvas", page.locator("#office3d canvas").count() == 1)
    check("four room cards float over the office", page.locator(".s3-room").count() == 4)
    check("The Brain label is shown", page.locator(".s3-brain").count() == 1)
    links = page.evaluate("office3d.built.links.length")
    check("dotted links are drawn", links >= 5, f"{links} links")
    check("auto-spin is off by default", view(page)["auto"] is False)

    # --- the dashboard around the office ---
    check("charcoal top bar with the run picker", page.locator("header.top .pick select#runSel").count() == 1)
    check("greeting block says hello", page.inner_text(".greet h1").startswith("Hello"), page.inner_text(".greet h1"))
    check("greeting says what is running now", "Builder is working" in page.inner_text(".greet .sub"), page.inner_text(".greet .sub"))
    rows = page.locator(".runs tbody tr").count()
    check("runs table is shown", rows >= 1 and page.locator(".runs thead th").count() == 6, f"{rows} rows")
    check("the current run is highlighted in the table", page.locator(".runs tbody tr.cur[aria-current=true]").count() == 1)
    check("runs table shows the AI rule as an outlined pill", page.locator(".runs tbody tr .tag").count() >= 1)
    drawn = page.evaluate("!!activity(current)")
    has_line = page.locator(".chart svg path.ln").count() == 1
    check("activity chart is drawn from real timed notes", drawn and has_line, f"data={drawn} line={has_line}")
    hidden = page.evaluate("chartHtml({created: '', events: [], agents: []}) === '' && chartHtml({created: current.created, events: current.events.slice(0, 1), agents: []}) === ''")
    check("activity chart is hidden when there is no data", hidden)
    total = page.evaluate("activity(current).total"); n_ev = page.evaluate("current.events.length")
    check("chart counts only real timed notes (no invented numbers)", total == n_ev, f"{total} plotted, {n_ev} timed notes in the data")
    check("right column has the four agent cards", page.locator(".dash-side .acard").count() == 4)
    orange = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    check("accent is Claude orange", orange.lower() == "#d97757", orange)
    btn = page.evaluate("(() => { const c = getComputedStyle(document.querySelector('#copyCmd')); return c.backgroundColor + '|' + c.color; })()")
    def lum(rgb):
        import re as _re
        r, g, b = [int(x) / 255 for x in _re.findall(r"\d+", rgb)[:3]]
        f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    bg_l, fg_l = [lum(x) for x in btn.split("|")]
    ratio = (max(bg_l, fg_l) + 0.05) / (min(bg_l, fg_l) + 0.05)
    check("orange pill button text has 4.5:1 contrast", ratio >= 4.5, f"{ratio:.2f}:1")

    # --- the icon rail ---
    rail = page.locator("#rail a")
    check("rail has Office, Story and the four agents, all labelled", rail.count() == 6 and page.locator("#rail a[aria-label]").count() == 6)
    check("rail marks the current section", page.locator("#rail a.on[aria-label=Office]").count() == 1)
    page.click("#rail a[aria-label=Story]"); page.wait_for_timeout(700)
    check("rail Story link opens the story", page.url.endswith("#/story") and page.locator(".story.full").count() == 1, page.url)
    page.click("#rail a[aria-label=Evaluator]"); page.wait_for_timeout(900)
    check("rail agent link opens that agent", page.url.endswith("#/evaluator") and page.locator("#rail a.on[aria-label=Evaluator]").count() == 1, page.url)
    page.click("#rail a[aria-label=Office]"); page.wait_for_selector("#office3d canvas"); page.wait_for_timeout(1500)
    check("rail Office link goes back to the dashboard", page.url.endswith("#/") and page.locator(".dash").count() == 1, page.url)
    page.focus(".runs tbody tr"); page.keyboard.press("Enter"); page.wait_for_timeout(600)
    check("a run row can be chosen with the keyboard", page.locator(".runs tbody tr.cur").count() == 1 and page.locator("#office3d canvas").count() == 1)
    page.wait_for_timeout(800)

    upper = page.evaluate("""[...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).length""")
    check("no ALL-CAPS labels", upper == 0, f"{upper} uppercase elements")

    # --- camera controls ---
    r0 = view(page)["r"]
    page.click("[data-3d=in]"); page.wait_for_timeout(1200)
    r1 = view(page)["r"]
    check("zoom-in button moves the camera closer", r1 < r0 - 1, f"{r0} -> {r1}")
    page.click("[data-3d=reset]"); page.wait_for_timeout(1500)
    check("reset button glides back", abs(view(page)["r"] - r0) < 1, f"r={view(page)['r']}")
    page.click("[data-3d=spin]"); t0 = view(page)["theta"]; page.wait_for_timeout(5000); t1 = view(page)["theta"]
    check("spin button turns the office", t1 - t0 > 0.1, f"theta {t0} -> {t1}")
    page.click("[data-3d=spin]")

    box = office_box(page)
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    r_before = view(page)["r"]
    page.mouse.move(cx, cy); page.mouse.wheel(0, 400); page.wait_for_timeout(800)
    check("plain scroll does not zoom (page can scroll)", abs(view(page)["r"] - r_before) < 0.5)
    box = office_box(page)
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.keyboard.down("Control"); page.mouse.wheel(0, 200); page.keyboard.up("Control"); page.wait_for_timeout(1200)
    check("Ctrl + scroll zooms", abs(view(page)["r"] - r_before) > 1, f"{r_before} -> {view(page)['r']}")
    page.click("[data-3d=reset]"); page.wait_for_timeout(1500)

    th = view(page)["theta"]
    box = office_box(page)
    dx, dy = box["x"] + box["width"] * 0.8, box["y"] + box["height"] * 0.85   # open floor, away from the room cards
    page.mouse.move(dx, dy); page.mouse.down(); page.mouse.move(dx - 220, dy, steps=8); page.mouse.up(); page.wait_for_timeout(800)
    check("dragging turns the office", abs(view(page)["theta"] - th) > 0.5, f"theta {th} -> {view(page)['theta']}")
    page.click("[data-3d=reset]"); page.wait_for_timeout(1500)

    # --- hover + click a room in 3D ---
    office_box(page)
    # the camera may still be gliding back after the reset: re-aim until it has settled
    hot = None
    for _ in range(6):
        page.wait_for_timeout(700)
        x, y = page.evaluate("office3d.screenOf(12, 0.5, -10)")
        page.mouse.move(x - 3, y); page.mouse.move(x, y); page.wait_for_timeout(400)
        hot = page.evaluate("(document.querySelector('.s3-room.hot') || {}).dataset?.go || null")
        if hot == "finder":
            break
    check("hovering the blue room highlights its card", hot == "finder", f"hot={hot}")
    page.mouse.click(x, y); page.wait_for_timeout(1500)
    check("clicking the blue room opens the Source finder page", page.url.endswith("#/finder"), page.url)
    check("the team page shows its 3D room", page.locator("#stage3d canvas").count() == 1)
    tags = page.locator("#stage3d .s3-tag").count()
    check("the room labels its 3 workers", tags == 3, f"{tags} tags")
    page.screenshot(path=os.path.join(SHOTS, "test-finder-room.png"))

    # --- room cards also navigate ---
    page.goto(BASE + "/#/"); page.wait_for_selector("#office3d canvas"); page.wait_for_timeout(800)
    page.click(".s3-room[data-go=builder]"); page.wait_for_timeout(1200)
    check("clicking the Builder card opens the Builder page", page.url.endswith("#/builder"), page.url)
    page.goto(BASE + "/#/evaluator"); page.wait_for_timeout(1500)
    check("the Evaluator page shows its 3D room", page.locator("#stage3d canvas").count() == 1)
    check("the Evaluator room labels its 3 workers", page.locator("#stage3d .s3-tag").count() == 3)
    page.screenshot(path=os.path.join(SHOTS, "test-evaluator-room.png"))
    page.goto(BASE + "/#/builder"); page.wait_for_timeout(1200)
    check("Builder page shows its log", page.locator(".log li").count() > 0)
    page.click("a.brand"); page.wait_for_timeout(800)
    check("the Assigent name goes back to the office", page.url.endswith("#/"), page.url)

    # --- sidebar: story, list, copy ---
    page.wait_for_selector(".story")
    check("sidebar opens on the story", page.locator(".story .ch").count() >= 5)
    page.click("[data-mode=list]"); page.wait_for_timeout(400)
    n_tasks = page.locator(".task").count()
    check("list tab shows tasks", n_tasks > 0, f"{n_tasks} tasks")
    page.click("[data-filter=doing]"); page.wait_for_timeout(300)
    pills = page.locator(".task .pill").all_inner_texts()
    check("the 'doing' filter only shows doing tasks", len(pills) > 0 and all(t.lower() == "doing" for t in pills), str(pills))
    page.click("[data-mode=story]"); page.wait_for_timeout(300)
    page.click("#copyCmd")
    try:  # the clipboard answer can take a moment; wait for the button to report what happened
        page.wait_for_function("document.querySelector('#copyCmd span').textContent !== 'Copy start command'", timeout=2000)
    except Exception:
        pass
    label = page.inner_text("#copyCmd").strip()
    check("copy button confirms", label in ("Copied", "Select it and copy"), label)

    # --- the full story page ---
    page.click("text=Open the full story"); page.wait_for_timeout(800)
    steps = page.locator(".story.full .steps li").count()
    sites = page.locator(".story.full .site").count()
    check("full story lists every step", steps >= 15, f"{steps} steps")
    check("full story lists the websites used", sites >= 3, f"{sites} sites")
    vague = page.locator(".steps .word", has_text="did").count()
    check("steps get specific labels", vague <= 2, f"{vague} vague 'did' labels")
    page.screenshot(path=os.path.join(SHOTS, "test-story.png"), full_page=True)

    # --- phone width ---
    m = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    m.goto(BASE + "/#/"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(1500)
    overflow = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no sideways scrolling on a phone", overflow <= 1, f"overflow {overflow}px")
    m.screenshot(path=os.path.join(SHOTS, "test-phone.png"))
    check("runs table and rail are there on a phone", m.locator(".runs tbody tr").count() >= 1 and m.locator("#rail a").count() == 6)
    m.goto(BASE + "/#/analyst"); m.wait_for_timeout(1500)
    check("team page works on a phone", m.locator("#stage3d canvas").count() == 1)
    check("team page has no sideways scrolling on a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
    m.goto(BASE + "/#/story"); m.wait_for_timeout(800)
    check("story page has no sideways scrolling on a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)

    # --- dark variant ---
    d = browser.new_page(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    d.on("pageerror", lambda e: errors.append(str(e)))
    d.goto(BASE + "/#/"); d.wait_for_load_state("networkidle"); d.wait_for_selector("#office3d canvas"); d.wait_for_timeout(1200)
    dark = d.evaluate("(() => { const c = getComputedStyle(document.body); return c.backgroundColor + '|' + c.color; })()")
    b_l, f_l = [lum(x) for x in dark.split("|")]
    check("dark variant: charcoal surface with legible text", b_l < 0.05 and (f_l + 0.05) / (b_l + 0.05) >= 7, dark)
    d.screenshot(path=os.path.join(SHOTS, "test-home-dark.png"))

    check("no JavaScript errors", not errors, "; ".join(errors[:3]))
    browser.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
