#!/usr/bin/env python3
"""Draw the twelve worker icons as animated pixel-art SVGs (32x32 grid) into ui/icons/.

Three workers per team, each busy with one part of that agent's job:
  analyst.svg    brief reader: magnifier over the brief, lines getting ticked
  analyst-2.svg  planner: drawing boxes and arrows on a whiteboard
  analyst-3.svg  question sorter: moving papers between trays, "?" bubble
  finder.svg     web searcher: typing a search, results appearing
  finder-2.svg   doc reader: book from the shelf, pages flipping
  finder-3.svg   source filer: folders going into a cabinet drawer
  builder.svg    maker: hammering while a wall of blocks goes up
  builder-2.svg  coder: code lines on a laptop, then a green tick
  builder-3.svg  tester: ticking a clipboard, packing and taping a box
  evaluator.svg    rubric checker: ticks and one cross down a checklist
  evaluator-2.svg  fact checker: magnifier between the work and its source
  evaluator-3.svg  scorer: bars on a scoreboard, stamp on the sheet
Animations run on their own; set --d on the <svg> to shift their timing.
"""
import os
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")

ORANGE, EYE = "#d97757", "#1d1b18"
WOOD, WOOD_TOP, WOOD_DARK = "#8a5a3b", "#a06b47", "#6e4a31"
METAL, METAL_DARK = "#b8bec4", "#8d939a"


def r(x, y, w=1, h=1, fill=None, cls=None, extra=""):
    a = f'<rect x="{x}" y="{y}" width="{w}" height="{h}"'
    if fill:
        a += f' fill="{fill}"'
    if cls:
        a += f' class="{cls}"'
    return a + f"{extra}/>"


def critter(x, y, eyes=(3, 6), legs=True):
    """Body 8x6 at (x, y), arms on rows 2-3, two eyes, optional legs."""
    s = r(x, y, 8, 6, ORANGE) + r(x - 2, y + 2, 2, 2, ORANGE) + r(x + 8, y + 2, 2, 2, ORANGE)
    if legs:
        s += "".join(r(x + dx, y + 6, 1, 2, ORANGE) for dx in (0, 2, 5, 7))
    s += f'<g class="{{p}}eyes">{r(x + eyes[0], y + 1, 1, 1, EYE)}{r(x + eyes[1], y + 1, 1, 1, EYE)}</g>'
    return s


def desk():
    return (r(1, 21, 30, 2, WOOD_TOP) + r(2, 23, 28, 7, WOOD) + r(13, 25, 6, 1, WOOD_DARK)
            + r(2, 29, 28, 1, WOOD_DARK))


def hat(x, y):
    """Builder-team hard hat sitting on a critter whose body top-left is (x, y)."""
    return r(x - 1, y - 1, 10, 1, "#c99a2e") + r(x + 1, y - 2, 6, 1, "#e9b949") + r(x + 2, y - 3, 4, 1, "#e9b949")


def svg(prefix, title, style, body):
    style = style.replace("{p}", prefix)
    body = body.replace("{p}", prefix)
    # Every animation is offset by --d, so several copies of one icon can run out of step.
    style = re.sub(r"(animation:[^;{}]+;)", r"\1 animation-delay: var(--d, 0s);", style)
    body = re.sub(r'style="animation-delay:([\d.]+)s"', r'style="animation-delay:calc(var(--d, 0s) + \1s)"', body)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256" shape-rendering="crispEdges" role="img" aria-label="{title}">
<title>{title}</title>
<style>
.{prefix}eyes {{ animation: {prefix}blink 4s steps(1) infinite; animation-delay: var(--d, 0s); transform-box: fill-box; transform-origin: center; }}
@keyframes {prefix}blink {{ 0%, 92%, 100% {{ transform: scaleY(1); }} 94% {{ transform: scaleY(.2); }} }}
{style}
</style>
{body}
</svg>
'''


def analyst():
    lines = [(9, 9), (11, 8), (13, 9), (15, 6), (17, 8)]
    paper = (r(14, 6, 13, 15, "#f4efe4") + r(25, 6, 2, 2, "#d8d0c0")
             + "".join(r(16, y, w, 1, "#c9bfae") for y, w in lines))
    checks = "".join(
        f'<g class="{{p}}chk" style="animation-delay:{i * 0.8:.1f}s">{r(25, y, 1, 1, "#6fbf5f")}{r(24, y - 1, 1, 1, "#6fbf5f")}</g>'
        for i, (y, _) in enumerate(lines))
    glow = r(15, 8, 11, 2, ORANGE, extra=' opacity=".28"')
    lens = r(20, 7, 4, 4, "#9fd3ff", extra=' opacity=".45"')
    glass = (f'<g class="{{p}}scan">{glow}'
             f'{r(20, 6, 4, 1, METAL)}{r(19, 7, 1, 4, METAL)}{r(24, 7, 1, 4, METAL)}{r(20, 11, 4, 1, METAL)}'
             f'{lens}{r(25, 12, 1, 1, WOOD)}{r(26, 13, 1, 1, WOOD)}</g>')
    style = """
.{p}scan { animation: {p}scan 4s steps(5) infinite; }
@keyframes {p}scan { from { transform: translateY(0); } to { transform: translateY(10px); } }
.{p}chk { opacity: 0; animation: {p}chk 4s steps(1) infinite both; }
@keyframes {p}chk { 0% { opacity: 0; } 20%, 99% { opacity: 1; } 100% { opacity: 0; } }
.{p}arm { animation: {p}arm 1s steps(2) infinite; }
@keyframes {p}arm { 50% { transform: translateY(-1px); } }"""
    body = (paper + checks + glass
            + critter(3, 15, eyes=(5, 7), legs=False).replace(r(11, 17, 2, 2, ORANGE), f'<g class="{{p}}arm">{r(11, 17, 2, 2, ORANGE)}{r(13, 17, 1, 1, ORANGE)}</g>')
            + desk())
    return svg("an-", "Analyst reading the brief", style, body)


def finder():
    monitor = (r(13, 4, 16, 13, "#4a4e55") + r(14, 5, 14, 11, "#1e2a38") + r(20, 17, 2, 3, "#4a4e55")
               + r(17, 20, 8, 1, "#4a4e55"))
    bar = r(15, 6, 12, 2, "#e8e4da") + r(25, 6, 1, 1, ORANGE) + r(26, 7, 1, 1, ORANGE)
    typed = "".join(f'<rect x="{16 + i * 1.5}" y="6.5" width="1" height="1" fill="#555b63" class="{{p}}key" style="animation-delay:{i * 0.25:.2f}s"/>'
                    for i in range(5))
    caret = '<rect x="23.6" y="6.4" width=".5" height="1.2" fill="#d97757" class="{p}caret"/>'
    results = "".join(
        f'<g class="{{p}}res" style="animation-delay:{1.4 + i * 0.4:.1f}s">{r(15, y, 2, 1, ORANGE)}{r(18, y, w, 1, col)}</g>'
        for i, (y, w, col) in enumerate([(9, 8, "#e8e4da"), (11, 6, "#8fa3b8"), (13, 7, "#8fa3b8")]))
    keyboard = r(10, 20, 9, 1, METAL) + "".join(r(11 + i * 2, 20, 1, 1, METAL_DARK) for i in range(4))
    hands = f'<g class="{{p}}type">{r(10, 19, 2, 1, ORANGE)}</g><g class="{{p}}type2">{r(15, 19, 2, 1, ORANGE)}</g>'
    antenna = r(5, 12, 1, 3, METAL_DARK) + f'<g class="{{p}}bulb">{r(4, 10, 3, 2, "#ffd166")}</g>'
    style = """
.{p}key { opacity: 0; animation: {p}key 4s steps(1) infinite both; }
@keyframes {p}key { 0% { opacity: 0; } 4%, 96% { opacity: 1; } 100% { opacity: 0; } }
.{p}res { opacity: 0; animation: {p}res 4s steps(1) infinite both; }
@keyframes {p}res { 0% { opacity: 0; } 6%, 70% { opacity: 1; } 71%, 100% { opacity: 0; } }
.{p}caret { animation: {p}caret .8s steps(1) infinite; }
@keyframes {p}caret { 50% { opacity: 0; } }
.{p}type { animation: {p}type .3s steps(1) infinite; }
.{p}type2 { animation: {p}type .3s steps(1) infinite reverse; }
@keyframes {p}type { 50% { transform: translateY(-1px); } }
.{p}bulb rect { animation: {p}bulb .7s steps(1) infinite; }
@keyframes {p}bulb { 50% { fill: #fff3c4; } }"""
    body = (monitor + bar + typed + caret + results + antenna
            + critter(2, 15, eyes=(5, 7), legs=False) + desk() + keyboard + hands)
    return svg("fi-", "Source finder searching on a computer", style, body)


def builder():
    ground = r(0, 24, 32, 2, "#5b544a") + r(0, 26, 32, 6, "#4a443c")
    blocks_at = [(16, 21), (22, 21), (19, 18), (16, 15), (22, 15)]

    def block(x, y):
        return r(x, y, 6, 3, "#d9a066") + r(x, y, 6, 1, "#e8b98a") + r(x + 5, y, 1, 3, "#b8794a") + r(x, y + 2, 6, 1, "#b8794a")
    blocks = "".join(f'<g class="{{p}}blk" style="animation-delay:{i * 0.6:.1f}s">{block(x, y)}</g>'
                     for i, (x, y) in enumerate(blocks_at))
    hat = r(1, 15, 10, 1, "#c99a2e") + r(3, 14, 6, 1, "#e9b949") + r(4, 13, 4, 1, "#e9b949")
    hammer = f'<g class="{{p}}hammer">{r(12, 13, 1, 6, WOOD)}{r(11, 11, 4, 2, METAL)}{r(14, 11, 1, 2, METAL_DARK)}</g>'
    sparks = f'<g class="{{p}}spark">{r(16, 13, 1, 1, "#ffd166")}{r(18, 12, 1, 1, "#ffd166")}{r(17, 11, 1, 1, "#fff3c4")}</g>'
    style = """
.{p}hammer { transform-box: view-box; transform-origin: 12.5px 19px; animation: {p}swing .6s ease-in infinite; }
@keyframes {p}swing { 0% { transform: rotate(-45deg); } 55% { transform: rotate(38deg); } 70% { transform: rotate(32deg); } 100% { transform: rotate(-45deg); } }
.{p}spark { opacity: 0; animation: {p}spark .6s steps(1) infinite; }
@keyframes {p}spark { 0%, 54% { opacity: 0; } 55%, 75% { opacity: 1; } 76%, 100% { opacity: 0; } }
.{p}blk { opacity: 0; animation: {p}blk 4.2s ease-out infinite both; }
@keyframes {p}blk { 0% { opacity: 0; transform: translateY(-4px); } 6% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 86%, 100% { opacity: 0; } }
.{p}bob { animation: {p}bob .6s steps(2) infinite; }
@keyframes {p}bob { 50% { transform: translateY(-.5px); } }"""
    body = ground + blocks + f'<g class="{{p}}bob">{critter(2, 16, eyes=(4, 7))}{hat}{hammer}</g>' + sparks
    return svg("bu-", "Builder building a wall", style, body)


BLUE, GREEN, GOLD, PAPER = "#3b6fd8", "#6fbf5f", "#e9b949", "#f4efe4"

# Shared keyframe for things that appear one after another and clear at the end of a loop
APPEAR = """
.{p}seq { opacity: 0; animation: {p}seq 5s steps(1) infinite both; }
@keyframes {p}seq { 0% { opacity: 0; } 3%, 88% { opacity: 1; } 89%, 100% { opacity: 0; } }"""


def seq(i, step, inner):
    return f'<g class="{{p}}seq" style="animation-delay:{i * step:.1f}s">{inner}</g>'


def planner():
    board = (r(13, 3, 17, 14, "#9aa0a6") + r(14, 4, 15, 12, "#f4f6f8") + r(15, 17, 1, 7, "#9aa0a6")
             + r(27, 17, 1, 7, "#9aa0a6") + r(14, 16, 15, 1, "#c9ced4"))

    def box(x, col):
        return r(x, 6, 4, 1, col) + r(x, 8, 4, 1, col) + r(x, 6, 1, 3, col) + r(x + 3, 6, 1, 3, col)
    parts = [box(16, BLUE), r(21, 7, 2, 1, ORANGE), box(24, BLUE), r(16, 11, 11, 1, METAL_DARK), r(16, 13, 7, 1, METAL_DARK)]
    drawing = "".join(seq(i, 0.8, p) for i, p in enumerate(parts))
    pen = f'<g class="{{p}}pen">{r(11, 17, 2, 2, ORANGE)}{r(13, 16, 1, 1, "#2a2f38")}</g>'
    style = APPEAR + """
.{p}pen { animation: {p}pen 5s steps(1) infinite; }
@keyframes {p}pen { 0% { transform: translate(4px, -9px); } 16% { transform: translate(9px, -9px); } 32% { transform: translate(12px, -9px); }
  48% { transform: translate(6px, -4px); } 64% { transform: translate(8px, -2px); } 88%, 100% { transform: translate(0, 0); } }"""
    body = board + drawing + critter(2, 16, eyes=(5, 7)) + pen
    return svg("pl-", "Planner drawing on a whiteboard", style, body)


def sorter():
    trays = r(13, 19, 6, 2, WOOD_DARK) + r(22, 19, 6, 2, WOOD_DARK) + r(14, 17, 4, 2, PAPER) + r(23, 18, 4, 1, PAPER)
    stack = "".join(seq(i, 1.4, r(23, 17 - i, 4, 1, "#ffffff" if i % 2 else PAPER)) for i in range(3))
    fly = f'<g class="{{p}}fly">{r(14, 16, 4, 1, "#ffffff")}</g>'
    think = (f'<g class="{{p}}think">{r(9, 5, 6, 5, "#ffffff")}{r(10, 4, 4, 1, "#ffffff")}{r(10, 10, 4, 1, "#ffffff")}'
             f'{r(8, 12, 1, 1, "#ffffff")}{r(7, 13, 1, 1, "#ffffff")}'
             f'{r(11, 5, 2, 1, ORANGE)}{r(13, 6, 1, 1, ORANGE)}{r(12, 7, 1, 1, ORANGE)}{r(12, 9, 1, 1, ORANGE)}</g>')
    arm = f'<g class="{{p}}arm">{r(10, 17, 3, 2, ORANGE)}</g>'
    style = APPEAR.replace("5s", "4.2s") + """
.{p}fly { animation: {p}fly 1.4s ease-in-out infinite; }
@keyframes {p}fly { 0% { transform: translate(0, 0); opacity: 1; } 50% { transform: translate(4.5px, -5px); } 90% { transform: translate(9px, 1px); opacity: 1; } 100% { transform: translate(9px, 1px); opacity: 0; } }
.{p}think { transform-box: fill-box; transform-origin: 0% 100%; animation: {p}think 3s ease-out infinite; }
@keyframes {p}think { 0%, 35% { opacity: 0; transform: scale(.4); } 45%, 90% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
.{p}arm { animation: {p}arm 1.4s steps(2) infinite; }
@keyframes {p}arm { 50% { transform: translate(2px, -1px); } }"""
    body = trays + stack + fly + think + critter(2, 15, eyes=(4, 6), legs=False) + arm + desk()
    return svg("so-", "Question sorter moving papers", style, body)


def bookworm():
    shelf = r(17, 3, 13, 21, WOOD) + r(18, 4, 11, 19, "#5a412a") + r(18, 10, 11, 1, WOOD) + r(18, 16, 11, 1, WOOD)
    cols = ["#d97757", "#8fb3ff", "#e9b949", "#7cc79a", "#c9bfae", "#b07cc7"]
    books = ""
    for row, y in enumerate((5, 11, 17)):
        x = 18
        for k in range(6):
            w = 1 + (k + row) % 2
            if row == 1 and x == 25:
                x += 2
                continue
            if x + w > 29:
                break
            books += r(x, y + (k % 2), w, 5 - (k % 2), cols[(k + row * 2) % 6])
            x += w + (1 if k % 3 == 2 else 0)
    pull = f'<g class="{{p}}pull">{r(25, 11, 2, 5, ORANGE)}</g>'
    book = r(11, 17, 6, 3, PAPER) + r(14, 17, 1, 3, "#c9bfae")
    pages = f'<g class="{{p}}pa">{r(15, 16, 2, 3, "#ffffff")}</g><g class="{{p}}pb">{r(11, 16, 2, 3, "#ffffff")}</g>'
    style = """
.{p}pull { animation: {p}pull 3s ease-in-out infinite; }
@keyframes {p}pull { 0%, 20% { transform: translateX(0); } 40%, 70% { transform: translateX(-3px); } 90%, 100% { transform: translateX(0); } }
.{p}pa { animation: {p}flip .9s steps(1) infinite; }
.{p}pb { animation: {p}flip .9s steps(1) infinite reverse; }
@keyframes {p}flip { 50% { opacity: 0; } }
.{p}bob { animation: {p}bob .9s steps(2) infinite; }
@keyframes {p}bob { 50% { transform: translateY(-.5px); } }"""
    body = shelf + books + pull + f'<g class="{{p}}bob">{critter(2, 16, eyes=(5, 7))}{book}{pages}</g>'
    return svg("bw-", "Doc reader reading a book from the shelf", style, body)


def filer():
    cab = (r(18, 7, 10, 17, "#6b7686") + r(19, 8, 8, 4, "#7f8a9b") + r(19, 18, 8, 4, "#7f8a9b")
           + r(22, 9, 2, 1, "#c9ced4") + r(22, 19, 2, 1, "#c9ced4") + r(19, 13, 8, 4, "#4f5866")
           + r(20, 5, 3, 2, "#ffffff") + r(24, 5, 3, 2, "#ffe08a"))
    drawer = (f'<g class="{{p}}drawer">{r(19, 13, 8, 4, "#8a95a6")}{r(22, 14, 2, 1, "#c9ced4")}'
              f'{r(20, 12, 1, 1, GOLD)}{r(22, 12, 1, 1, "#8fb3ff")}{r(25, 12, 1, 1, GOLD)}</g>')
    folder = f'<g class="{{p}}folder">{r(12, 16, 4, 3, GOLD)}{r(12, 15, 2, 1, GOLD)}</g>'
    style = """
.{p}drawer { animation: {p}drawer 2.6s ease-in-out infinite; }
@keyframes {p}drawer { 0%, 10% { transform: translateX(0); } 25%, 60% { transform: translateX(-4px); } 75%, 100% { transform: translateX(0); } }
.{p}folder { animation: {p}folder 2.6s ease-in-out infinite; }
@keyframes {p}folder { 0%, 25% { transform: translate(0, 0); opacity: 1; } 50% { transform: translate(5px, -4px); opacity: 1; } 55%, 85% { opacity: 0; transform: translate(5px, -4px); } 86%, 100% { opacity: 1; transform: translate(0, 0); } }"""
    body = cab + drawer + critter(3, 16, eyes=(5, 7)) + folder
    return svg("fl-", "Source filer filing folders", style, body)


def coder():
    laptop = (r(15, 9, 11, 9, "#3a3f48") + r(16, 10, 9, 7, "#1e2a38") + r(13, 19, 15, 2, METAL) + r(15, 18, 11, 1, METAL_DARK))
    lines = [(17, 11, 4, "#8fb3ff"), (18, 12, 5, GOLD), (18, 13, 3, ORANGE), (17, 14, 6, "#8fb3ff")]
    code = "".join(seq(i, 0.6, r(x, y, w, 1, c)) for i, (x, y, w, c) in enumerate(lines))
    tick = seq(len(lines), 0.6, r(17, 15, 1, 1, GREEN) + r(18, 16, 1, 1, GREEN) + r(19, 15, 1, 1, GREEN) + r(20, 14, 1, 1, GREEN)
               + r(22, 15, 2, 1, GREEN))
    hands = f'<g class="{{p}}ta">{r(11, 18, 2, 1, ORANGE)}</g><g class="{{p}}tb">{r(14, 18, 2, 1, ORANGE)}</g>'
    style = APPEAR.replace("5s", "4s") + """
.{p}ta { animation: {p}type .3s steps(1) infinite; }
.{p}tb { animation: {p}type .3s steps(1) infinite reverse; }
@keyframes {p}type { 50% { transform: translateY(-1px); } }"""
    body = laptop + code + tick + critter(2, 15, eyes=(5, 7), legs=False) + hat(2, 15) + desk() + hands
    return svg("co-", "Coder writing code on a laptop", style, body)


def tester():
    box = r(17, 15, 11, 8, "#c4834d") + r(17, 15, 11, 1, "#a86d3c") + r(17, 22, 11, 1, "#a86d3c")
    flaps = (f'<g class="{{p}}fl">{r(17, 12, 5, 3, "#d9a066")}</g><g class="{{p}}fr">{r(23, 12, 5, 3, "#d9a066")}</g>')
    tape = f'<g class="{{p}}tape">{r(21, 15, 3, 8, GOLD)}</g>'
    board = r(11, 13, 5, 7, WOOD) + r(12, 14, 3, 5, PAPER) + r(13, 15, 2, 1, "#c9bfae") + r(13, 17, 2, 1, "#c9bfae")
    ticks = seq(0, 0.9, r(12, 15, 1, 1, GREEN)) + seq(1, 0.9, r(12, 17, 1, 1, GREEN))
    style = APPEAR.replace("5s", "4s") + """
.{p}fl, .{p}fr { transform-box: fill-box; transform-origin: 50% 100%; animation: {p}flap 4s ease-in-out infinite; }
@keyframes {p}flap { 0%, 45% { transform: scaleY(1); } 60%, 92% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
.{p}tape { opacity: 0; animation: {p}tape 4s steps(1) infinite; }
@keyframes {p}tape { 0%, 64% { opacity: 0; } 65%, 92% { opacity: 1; } 93%, 100% { opacity: 0; } }
.{p}bob { animation: {p}bob .8s steps(2) infinite; }
@keyframes {p}bob { 50% { transform: translateY(-.5px); } }"""
    body = box + flaps + tape + f'<g class="{{p}}bob">{critter(2, 16, eyes=(5, 7))}{hat(2, 16)}{board}{ticks}</g>'
    return svg("te-", "Tester checking and packing", style, body)


def checker():
    """Rubric checker: a tall checklist, ticks appearing down it and one red cross."""
    sheet = r(15, 4, 13, 19, PAPER) + r(19, 3, 5, 2, METAL) + r(15, 22, 13, 1, "#d8d0c0")
    ys = [7, 10, 13, 16, 19]
    lines = "".join(r(19, y, 7 if i != 2 else 5, 1, "#c9bfae") for i, y in enumerate(ys))
    marks = "".join(seq(i, 0.8, (r(16, y, 2, 1, "#d9534f") + r(17, y - 1, 1, 1, "#d9534f") + r(16, y + 1, 1, 1, "#d9534f")) if i == 3
                        else (r(16, y, 1, 1, GREEN) + r(17, y + 1, 1, 1, GREEN) + r(18, y - 1, 1, 2, GREEN)))
                    for i, y in enumerate(ys))
    pen = f'<g class="{{p}}pen">{r(12, 15, 1, 4, "#2a2f38")}{r(12, 14, 1, 1, "#c59cf0")}</g>'
    style = APPEAR + """
.{p}pen { animation: {p}pen .5s steps(2) infinite; }
@keyframes {p}pen { 50% { transform: translate(1px, -1px); } }
.{p}bob { animation: {p}bob .9s steps(2) infinite; }
@keyframes {p}bob { 50% { transform: translateY(-.5px); } }"""
    body = sheet + lines + marks + f'<g class="{{p}}bob">{critter(2, 17, eyes=(5, 7))}{pen}</g>'
    return svg("ev-", "Evaluator ticking the rubric", style, body)


def factchecker():
    """Fact checker: a magnifier moving between the work and its source, an equals sign lighting up."""
    left = r(11, 8, 8, 11, PAPER) + "".join(r(12, y, 6, 1, "#c9bfae") for y in (10, 12, 14, 16))
    right = r(22, 8, 8, 11, "#ffffff") + "".join(r(23, y, 6, 1, "#8fb3ff") for y in (10, 12, 14, 16))
    same = f'<g class="{{p}}same">{r(19, 12, 3, 1, GREEN)}{r(19, 14, 3, 1, GREEN)}</g>'
    glass = (f'<g class="{{p}}mag">{r(13, 10, 4, 1, METAL)}{r(12, 11, 1, 4, METAL)}{r(17, 11, 1, 4, METAL)}{r(13, 15, 4, 1, METAL)}'
             f'{r(13, 11, 4, 4, "#9fd3ff", extra=" opacity=\'.45\'")}{r(18, 16, 1, 1, WOOD)}{r(19, 17, 1, 1, WOOD)}</g>')
    antenna = r(5, 12, 1, 3, METAL_DARK) + f'<g class="{{p}}bulb">{r(4, 10, 3, 2, "#ffd166")}</g>'
    style = """
.{p}mag { animation: {p}mag 4s ease-in-out infinite; }
@keyframes {p}mag { 0%, 15% { transform: translateX(0); } 40%, 65% { transform: translateX(11px); } 90%, 100% { transform: translateX(0); } }
.{p}same { opacity: 0; animation: {p}same 4s steps(1) infinite; }
@keyframes {p}same { 0%, 44% { opacity: 0; } 45%, 92% { opacity: 1; } 93%, 100% { opacity: 0; } }
.{p}bulb rect { animation: {p}bulb .7s steps(1) infinite; }
@keyframes {p}bulb { 50% { fill: #fff3c4; } }"""
    body = left + right + same + glass + antenna + critter(2, 15, eyes=(5, 7), legs=False) + desk()
    return svg("fc-", "Fact checker comparing the work with its source", style, body)


def scorer():
    """Scorer: bars rise on a scoreboard, then a stamp lands on the marked sheet."""
    board = r(14, 3, 16, 12, "#3a3f48") + r(15, 4, 14, 10, "#1e2a38") + r(21, 15, 2, 3, "#3a3f48")
    cols = ["#8fb3ff", "#c59cf0", "#8fb3ff", GREEN, GOLD]
    bars = "".join(seq(i, 0.6, r(16 + i * 2.6, 13 - h, 2, h, cols[i])) for i, h in enumerate([4, 6, 5, 8, 7]))
    table = r(12, 21, 18, 2, WOOD_TOP) + r(13, 23, 16, 6, WOOD) + r(13, 28, 16, 1, WOOD_DARK)
    sheet = r(18, 19, 9, 2, PAPER)
    seal = f'<g class="{{p}}seal">{r(21, 19, 3, 2, GREEN)}</g>'
    stamp = f'<g class="{{p}}stamp">{r(21, 12, 3, 2, "#845a9c")}{r(22, 9, 1, 3, WOOD_DARK)}</g>'
    style = APPEAR.replace("5s", "4.6s") + """
.{p}stamp { animation: {p}stamp 1.15s ease-in infinite; }
@keyframes {p}stamp { 0%, 40% { transform: translateY(0); } 62%, 72% { transform: translateY(5px); } 100% { transform: translateY(0); } }
.{p}seal { opacity: 0; animation: {p}seal 4.6s steps(1) infinite; }
@keyframes {p}seal { 0%, 60% { opacity: 0; } 61%, 94% { opacity: 1; } 95%, 100% { opacity: 0; } }
.{p}bob { animation: {p}bob .8s steps(2) infinite; }
@keyframes {p}bob { 50% { transform: translateY(-.5px); } }"""
    body = board + bars + table + sheet + seal + stamp + f'<g class="{{p}}bob">{critter(2, 13, eyes=(5, 7))}</g>'
    return svg("sc-", "Scorer filling the scoreboard and stamping the sheet", style, body)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (("analyst", analyst), ("analyst-2", planner), ("analyst-3", sorter),
                     ("finder", finder), ("finder-2", bookworm), ("finder-3", filer),
                     ("builder", builder), ("builder-2", coder), ("builder-3", tester),
                     ("evaluator", checker), ("evaluator-2", factchecker), ("evaluator-3", scorer)):
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(fn())
        print("wrote", os.path.join(OUT, name + ".svg"))
