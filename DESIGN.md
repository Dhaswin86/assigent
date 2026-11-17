# Design

The start page (`site/index.html`) is a plain, conventional product page: sticky top bar,
a hero with the install commands, then one section per question a visitor has. Clarity over
decoration. No web fonts, no build step.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg-soft` | #ffffff / #f7f6f3 | page; alternate sections |
| `--text` / `--muted` | #1c1b19 / #5c5852 | text |
| `--line` / `--line-strong` | #e7e4de / #d6d2ca | borders |
| `--accent` / `--accent-hover` | #c2410c / #9a3412 | links, primary button, step numbers |
| `--accent-soft` | #fff1e8 | step circles, note box |
| `--ok` | #15803d | checks, "Done" |
| `--code-bg` | #1c1b19 | command boxes |

Light by default, whatever the system setting (the owner chose this on 2026-11-16). A moon/sun button in the header
switches to dark (`data-theme="dark"` on `<html>`: bg #141312, text #f2f0ec, accent #fb923c, ok #4ade80); the choice is
remembered in localStorage (`assigent-theme`). Command boxes stay dark in both, like a terminal.

## Type

System UI stack for everything (`--sans`), system monospace for commands (`--mono`).
h1 800 weight, clamp(2.3rem, 4.6vw, 3.5rem); h2 750, clamp(1.6rem, 3vw, 2.1rem); body 17px / 1.6.

## Components

- `.cmd` + `.copy`: dark command box with a copy button (falls back to selecting the text).
- `.btn-primary`, `.btn-ghost`: 42px tall, 8px radius.
- `.run`: the made-up example run panel in the hero.
- `.steps`: numbered five-step row (stacks under 960px).
- `.asks`: two-column table; becomes stacked labelled rows under 720px.
- `.rules`: two-column checklist with shield icons; `.note` for the school-rules reminder.
- Icons are inline SVG symbols in one 2px stroke style.

## Motion (scroll scenes, modelled on the RasanAI site's storytelling)

Only when the visitor allows motion (`.motion` on `<html>`); without JS or with reduced motion every scene is a plain, static section.

- Header: floating pill with blur, reading-progress line along its bottom edge.
- Hero: headline words rise in on load.
- `.say`: pinned statement ("Behind that one line, six helpers."), words fill with colour as you scroll.
- `.crew` (#how): pinned scene, the six helpers as voxel characters (drawn by `tools/voxels.py`) on a dashed orbit that turns with scroll; the active agent sits on top, fills the hub and shows its first-person line. Agent colours: Analyst #c2410c, Source finder #2563eb, Researcher #0d9488, Builder #7c3aed, Evaluator #15803d, Tutor #d97706.
- FAQ: `<details>` with a rotating plus and a drop-in answer.
- `.end`: "That's how it works. Your turn." letters fly in and settle, then the install box rises in.
