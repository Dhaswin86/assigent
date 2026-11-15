# Design

The start page (`site/index.html`) is a plain, conventional product page: sticky top bar,
a hero with the install commands, then one section per question a visitor has. Clarity over
decoration. No web fonts, no build step.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--bg-soft` | #ffffff / #f7f6f3 | #141312 / #1c1b19 | page; alternate sections |
| `--text` / `--muted` | #1c1b19 / #5c5852 | #f2f0ec / #b5b0a8 | text |
| `--line` / `--line-strong` | #e7e4de / #d6d2ca | #2e2c29 / #3d3a36 | borders |
| `--accent` / `--accent-hover` | #c2410c / #9a3412 | #fb923c / #fdba74 | links, primary button, step numbers |
| `--accent-soft` | #fff1e8 | #2a1d14 | step circles, note box |
| `--ok` | #15803d | #4ade80 | checks, "Done" |
| `--code-bg` | #1c1b19 | #0c0b0a | command boxes |

Light and dark follow the system setting; `data-theme` on `<html>` can force either.

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
