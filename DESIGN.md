---
name: Assigent noticeboard
---

# Design

The start page is the school corridor noticeboard: green baize in a wooden frame, with
notices pinned on it. Rules come first and are plain, because students trust tools with
clear rules (see `.impeccable/surfaces/site-index-html.md`).

## Colour

Committed: the green board owns the page; papers carry the content.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--board` | #2c4738 | #1f3428 | page ground (baize) |
| `--wood` / `--wood-dark` | #8a5a34 / #5f3c21 | #5d3d24 / #3f2816 | frame, header, footer |
| `--paper` | #fbfaf4 | #e9e6da | main notices |
| `--yellow` `--pink` `--blue` `--mint` `--kraft` | #f6d86a #f6b3c8 #b4d8f0 #c4e6b8 #e3c59a | dimmed | duplicator-paper slips |
| `--ink` / `--ink-2` | #1d1c19 / #47433b | same | text on paper |
| `--red` / `--red-ink` | #c4301c / #a52816 | same | pins, string, numbers, hover |
| stamp ink | #7f1a0c | same | rubber stamps (AA on every slip colour) |

Dark mode keeps papers light (they are objects) and dims the board and wood.

## Type

- Display: Bricolage Grotesque, weight 800, width 76 to 82%, tracking -0.02em. Headings only.
- Body: Atkinson Hyperlegible Next 400/700, chosen for readers whose first language is not English.
- Hand: Kalam, only for handwritten notes (sticky notes, "take one").
- Code: JetBrains Mono, only for commands.

## Components

- `.paper` (+ colour class): a pinned sheet, soft offset shadow, optional tilt class (`tilt-l/r/ll/rr`, flattened under 720px).
- `.pin`: drawn SVG push pin (`#pin`, `#pin-y`, `#pin-b`), top centre, or both ends on `.label-strip`.
- `.label-strip`: a section header pinned at both ends; holds the h2 and one line.
- `.strips` / `.strip`: tear-off strips; each is a button that copies the install line and tears away.
- `.slip` + `.stamp`: numbered agent notes joined by the red `.string` (drawn in JS from pin to pin).
- `.btn`, `.link-btn`: square ink buttons, red-ink on hover, 44px minimum height.

## Motion

One moment: the string draws pin to pin, then each slip is stamped. Content is visible without
it; reduced motion skips it. Torn strips slide and fade, then all return once every strip is torn.
