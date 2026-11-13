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
    check("home timeline has 4 rows, one per agent", page.locator(".tl .tl-row:not(.tutor)").count() == 4)
    check("each timeline row shows a state", page.locator(".tl .tl-row:not(.tutor) .tag").count() == 4)
    check("the Tutor is a fifth row, with no room in the office", page.locator(".tl .tl-row.tutor").count() == 1 and page.locator(".s3-room").count() == 4
          and "5 activities" in page.inner_text(".tl .tl-row.tutor"))
    chips = page.locator(".tl .tl-row:not(.tutor) .chipx.res").all_inner_texts()
    check("timeline rows carry one result chip each", len(chips) == 4 and chips[0] == "6 checks" and chips[1] == "7 sources", str(chips))
    check("a waiting agent shows a dash, not an invented number", chips[3].strip() == "–", chips[3])
    check("home shows the latest result as tiles", page.locator(".latest .tile").count() >= 2)
    check("the long story is no longer on the home screen", page.locator(".dash .story, .dash .steps, .dash .task").count() == 0)
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
    check("rail has Office, Story, the four agents and Playground, all labelled", rail.count() == 7 and page.locator("#rail a[aria-label]").count() == 7)
    check("rail Playground link points at the separate page for this run", page.get_attribute("#rail a[aria-label=Playground]", "href") == "playground.html?run=0")
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

    # --- home timeline rows open the agent; copy still works ---
    page.wait_for_selector(".tl .tl-row")
    page.click(".tl .tl-row >> nth=1"); page.wait_for_timeout(1000)
    check("clicking a timeline row opens that agent's page", page.url.endswith("#/finder"), page.url)
    page.click("a.brand"); page.wait_for_selector("#copyCmd"); page.wait_for_timeout(600)
    page.click("#copyCmd")
    try:  # the clipboard answer can take a moment; wait for the button to report what happened
        page.wait_for_function("document.querySelector('#copyCmd span').textContent !== 'Copy start command'", timeout=2000)
    except Exception:
        pass
    label = page.inner_text("#copyCmd").strip()
    check("copy button confirms", label in ("Copied", "Select it and copy"), label)

    # --- agent pages: a summary card, with the full file behind a disclosure ---
    def lines_over(pg, limit=2.3):
        """Paragraphs in the viewer's own chrome (not inside a full file) that run over two lines."""
        return pg.evaluate("""(limit) => [...document.querySelectorAll('#main p, #main .sub, #main .lead, #main .s3-hint')]
            .filter(e => !e.closest('.md') && e.offsetParent !== null)
            .filter(e => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight) > limit)
            .map(e => e.textContent.trim().slice(0, 50))""", limit)
    check("home has no paragraph over two lines", not lines_over(page), str(lines_over(page)))
    for who, min_tiles in (("analyst", 2), ("finder", 2), ("builder", 2)):
        page.goto(BASE + "/#/" + who); page.wait_for_selector("#stage3d canvas"); page.wait_for_timeout(700)
        n = page.locator(f".rcard[data-result={who}] .tile").count()
        check(f"{who} page shows a summary card with tiles", n >= min_tiles, f"{n} tiles")
    page.goto(BASE + "/#/analyst"); page.wait_for_selector(".rcard"); page.wait_for_timeout(500)
    vals = page.locator(".rcard .tile b").all_inner_texts()
    check("analyst tiles are read from brief.md", vals[:3] == ["2", "6", "1"], str(vals))
    badges = page.locator(".rcard .chipx.file .ext").all_inner_texts()
    check("deliverables show as chips with a file-type badge", badges == [".html", ".docx"], str(badges))
    check("the full file is hidden until asked for", page.locator("#d-full-analyst").is_hidden() and page.locator(".rcard .disc[aria-expanded=false]").count() == 1)
    page.focus(".rcard .disc"); page.keyboard.press("Enter"); page.wait_for_timeout(400)
    check("the disclosure opens the full file (keyboard)", page.locator("#d-full-analyst").is_visible() and "Requirements checklist" in page.inner_text("#d-full-analyst")
          and page.locator(".rcard .disc[aria-expanded=true]").count() == 1)
    check("focus stays on the disclosure button", page.evaluate("document.activeElement && document.activeElement.dataset.disc") == "full-analyst")
    page.click(".rcard .disc"); page.wait_for_timeout(300)
    check("the disclosure closes again", page.locator("#d-full-analyst").is_hidden())
    page.goto(BASE + "/#/finder"); page.wait_for_selector(".rcard"); page.wait_for_timeout(500)
    check("finder card shows websites as chips with page counts", page.locator(".rcard .chipx.site .n").count() >= 3)
    n_log = page.locator(".log li").count()
    check("the log shows only the last 5 steps", n_log == 5, f"{n_log} shown")
    page.click(".panel .disc"); page.wait_for_timeout(400)
    check("'Show all steps' opens the whole log", page.locator(".log li").count() == 10 and page.locator(".panel .disc[aria-expanded=true]").count() == 1)
    page.click(".panel .disc"); page.wait_for_timeout(300)
    page.goto(BASE + "/#/builder"); page.wait_for_selector(".rcard"); page.wait_for_timeout(500)
    check("builder card (still working) lists the files made so far", page.locator(".rcard .chipx.file").count() == 2)
    check("builder card shows a dash where report.md has no numbers yet", "–" in page.locator(".rcard .tile b").all_inner_texts())
    page.goto(BASE + "/#/evaluator"); page.wait_for_selector(".rcard"); page.wait_for_timeout(500)
    check("evaluator card says not written yet when there is no evaluation.md", "Not written yet" in page.inner_text(".rcard") and page.locator(".rcard .ring").count() == 0)
    check("agent pages have no paragraph over two lines", not lines_over(page), str(lines_over(page)))

    # --- the finished demo run: every kind of result ---
    page.select_option("#runSel", "1"); page.wait_for_timeout(1200)
    page.wait_for_selector(".rcard .ring")
    check("evaluator card shows the score from evaluation.md", page.inner_text(".rcard .ring b").strip() == "88", page.inner_text(".rcard .ring b"))
    pills = [x.strip() for x in page.locator(".rcard .marks .tag").all_inner_texts()]
    check("evaluator card shows the verdict and must-fix count", "Pass" in pills and "2 must fix" in pills, str(pills))
    legend = " ".join(page.locator(".rcard .legend span").all_inner_texts())
    check("stacked bar counts pass, partial and fail from the requirements", "7 pass" in legend and "1 partial" in legend and "0 fail" in legend, legend)
    check("first must-fix items are listed as one-liners", page.locator(".rcard .left ol li").count() == 2)
    page.screenshot(path=os.path.join(SHOTS, "test-evaluator-result.png"), full_page=True)
    page.goto(BASE + "/#/builder"); page.wait_for_selector(".rcard"); page.wait_for_timeout(600)
    b_tiles = page.locator(".rcard .tile b").all_inner_texts()
    check("builder tiles: files made, checks ticked, left for you", b_tiles == ["3", "7/8", "4"], str(b_tiles))
    check("builder card has a progress bar and file chips with badges", page.locator(".rcard .prog i").count() == 1
          and page.locator(".rcard .chipx.file .ext").all_inner_texts() == [".xlsx", ".pptx", ".docx"])
    check("'left for you' shows the first 3 and a +1 more chip", page.locator(".rcard .left ol li").count() == 3 and "+1 more" in page.inner_text(".rcard .left"))
    page.goto(BASE + "/#/"); page.wait_for_selector("#office3d canvas"); page.wait_for_timeout(900)
    chips = page.locator(".tl .tl-row:not(.tutor) .chipx.res").all_inner_texts()
    check("a run without a playground says so on the Tutor row", "Not made" in page.inner_text(".tl .tl-row.tutor"))
    check("finished run: timeline chips read 8 checks, 6 sources, 3 files, 88/100 pass", chips == ["8 checks", "6 sources", "3 files", "88/100 pass"], str(chips))
    check("runs table lists both demo runs with the score", page.locator(".runs tbody tr").count() == 2 and "88" in page.inner_text(".runs tbody"))

    # --- the full story page ---
    page.click("text=Open the full story"); page.wait_for_timeout(800)
    check("each story chapter leads with result tiles", page.locator(".story.full .ch .tiles").count() == 4)
    steps = page.locator(".story.full .steps li").count()
    check("story steps are collapsed to the last 4 per chapter", steps == 16, f"{steps} steps")
    for _ in range(page.locator(".story .disc[aria-expanded=false]").count()):
        page.click(".story .disc[aria-expanded=false] >> nth=0"); page.wait_for_timeout(250)
    steps = page.locator(".story.full .steps li").count()
    sites = page.locator(".story.full .chipx.site").count()
    check("opening the toggles lists every step", steps == 28, f"{steps} steps")
    check("story shows the websites used as chips", sites >= 3, f"{sites} sites")
    vague = page.locator(".steps .word", has_text="did").count()
    check("steps get specific labels", vague <= 2, f"{vague} vague 'did' labels")
    check("story page has no paragraph over two lines", not lines_over(page), str(lines_over(page)))
    upper = page.evaluate("""[...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).length""")
    check("no ALL-CAPS labels on the story page", upper == 0)
    page.screenshot(path=os.path.join(SHOTS, "test-story.png"), full_page=True)

    # --- phone width ---
    m = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    m.goto(BASE + "/#/"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(1500)
    overflow = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("no sideways scrolling on a phone", overflow <= 1, f"overflow {overflow}px")
    m.screenshot(path=os.path.join(SHOTS, "test-phone.png"))
    check("runs table and rail are there on a phone", m.locator(".runs tbody tr").count() >= 1 and m.locator("#rail a").count() == 7)
    m.goto(BASE + "/#/analyst"); m.wait_for_timeout(1500)
    check("team page works on a phone", m.locator("#stage3d canvas").count() == 1)
    check("team page has no sideways scrolling on a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
    m.goto(BASE + "/#/story"); m.wait_for_timeout(800)
    check("story page has no sideways scrolling on a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
    m.evaluate("try { localStorage.setItem('pipe.run', '1') } catch (e) {}")
    m.goto(BASE + "/#/evaluator"); m.reload(); m.wait_for_selector(".rcard .ring", timeout=15000); m.wait_for_timeout(800)
    check("evaluator result card fits a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1 and m.locator(".rcard .ring").count() == 1)
    m.click(".rcard .disc"); m.wait_for_timeout(400)
    check("the opened full file does not cause sideways scrolling on a phone", m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
    m.goto(BASE + "/#/"); m.wait_for_selector(".tl .tl-row"); m.wait_for_timeout(600)
    check("home timeline fits a phone", m.locator(".tl .tl-row").count() == 5 and m.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)

    # --- the playground: a separate page, reached from the rail ---
    g = browser.new_page(viewport={"width": 1440, "height": 900})
    g.on("console", lambda msg: errors.append("playground page: " + msg.text) if msg.type == "error" else None)
    g.on("pageerror", lambda e: errors.append("playground page: " + str(e)))
    g.goto(BASE + "/#/"); g.wait_for_selector("#rail a[aria-label=Playground]"); g.wait_for_timeout(800)
    g.click("#rail a[aria-label=Playground]"); g.wait_for_load_state("networkidle")
    check("rail Playground icon opens playground.html", "/playground.html?run=0" in g.url, g.url)
    g.wait_for_selector("iframe#play", timeout=10000)
    check("the playground runs in a sandboxed frame without same-origin", "allow-scripts" in (g.get_attribute("iframe#play", "sandbox") or "")
          and "allow-same-origin" not in (g.get_attribute("iframe#play", "sandbox") or ""), g.get_attribute("iframe#play", "sandbox"))
    head_text = g.inner_text(".play-head")
    check("slim header: title, concept chips, activity count, minutes", "Events, the DOM and saved state" in head_text and "The DOM" in head_text
          and "5 activities" in head_text and "10 min" in head_text, head_text.replace("\n", " | "))
    check("header has Open full screen", g.get_attribute("#full", "href") == "play/0/index.html" and g.get_attribute("#full", "target") == "_blank")
    fr = g.frame_locator("iframe#play")
    fr.locator("#poke").wait_for(timeout=10000)
    fr.locator("#poke").click(); fr.locator("#poke").click()
    check("an activity in the playground responds to a click", fr.locator("#count").inner_text() == "2" and "click on the button" in fr.locator("#evlog").inner_text())
    fr.locator("#st-text").fill("Hi there"); fr.locator("#c-round").check()
    check("an activity responds to typing and a toggle", fr.locator("#sticker").inner_text() == "Hi there" and "classList.add('round')" in fr.locator("#domcode").inner_text())
    fr.locator("#plus").click(); fr.locator("#plus").click(); fr.locator("#refresh").click()
    kept = fr.locator("#pts").inner_text()
    fr.locator("#saving").uncheck(); fr.locator("#plus").click(); fr.locator("#refresh").click()
    check("the save-and-refresh simulator behaves (saved value returns, unsaved is lost)", kept == "2" and fr.locator("#pts").inner_text() == "2", f"{kept} then {fr.locator('#pts').inner_text()}")
    fr.locator("#quiz button[data-q='0'][data-k='0']").click()
    check("the quiz gives instant feedback", fr.locator("#score").inner_text() == "1 of 4" and "Right." in fr.locator("#w0").inner_text())
    net = g.evaluate("performance.getEntriesByType('resource').filter(r => /play\\/0\\//.test(r.name)).length")
    check("the demo playground is one file (no extra requests)", net <= 1, f"{net} requests under play/0/")
    opts = g.locator("#runSel option").all_inner_texts()
    check("the picker lists only runs that have a playground", len(opts) == 1 and "To-Do" in opts[0], str(opts))
    g.screenshot(path=os.path.join(SHOTS, "test-playground.png"))
    g.goto(BASE + "/playground.html?run=1"); g.wait_for_selector("#empty", timeout=10000)
    check("a run without a playground shows the empty state", "No playground yet" in g.inner_text("#empty") and g.locator("iframe#play").count() == 0)
    opts = g.locator("#runSel option").all_inner_texts()
    check("the picker still offers the run that has one", len(opts) == 2 and "(no playground)" in opts[0], str(opts))
    g.select_option("#runSel", "0"); g.wait_for_selector("iframe#play", timeout=10000)
    check("picking a run in the picker loads its playground", "run=0" in g.url and g.locator("iframe#play").count() == 1, g.url)
    g.click("#back"); g.wait_for_selector("#office3d canvas", timeout=15000)
    check("Back to the office returns to index.html", g.url.split("#")[0].endswith("/index.html"), g.url)
    g.close()
    gm = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    gm.on("pageerror", lambda e: errors.append("playground page (phone): " + str(e)))
    gm.goto(BASE + "/playground.html?run=0"); gm.wait_for_selector("iframe#play", timeout=10000); gm.wait_for_timeout(800)
    check("playground page has no sideways scrolling on a phone", gm.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 1)
    inner = gm.frame_locator("iframe#play").locator("main").evaluate("e => document.documentElement.scrollWidth - window.innerWidth")
    check("the demo playground itself has no sideways scrolling on a phone", inner <= 1, f"{inner}px")
    upper = gm.evaluate("[...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).length")
    check("no ALL-CAPS labels on the playground page", upper == 0)
    gm.screenshot(path=os.path.join(SHOTS, "test-playground-phone.png"))
    gm.close()

    # --- one theme: a dark system setting must not change the warm orange look ---
    d = browser.new_page(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    d.on("pageerror", lambda e: errors.append(str(e)))
    d.goto(BASE + "/#/"); d.wait_for_load_state("networkidle"); d.wait_for_selector("#office3d canvas"); d.wait_for_timeout(1200)
    dark = d.evaluate("(() => { const c = getComputedStyle(document.body); return c.backgroundColor + '|' + c.color; })()")
    b_l, f_l = [lum(x) for x in dark.split("|")]
    check("the warm light look stays when the system is in dark mode", b_l > 0.7 and (b_l + 0.05) / (f_l + 0.05) >= 7, dark)
    d.screenshot(path=os.path.join(SHOTS, "test-home-dark.png"))

    check("no JavaScript errors", not errors, "; ".join(errors[:3]))
    browser.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
