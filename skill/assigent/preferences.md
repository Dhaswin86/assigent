# Assigent preferences: what it remembers

Assigent has no setup and no fixed list of questions. It asks only what the assignment
in front of it needs. Some answers are worth keeping, so you are not asked twice. Those
are saved in `~/.assigent/config.json` as you give them.

Nothing depends on this file. If it is missing, Assigent works with defaults and asks
when an assignment needs something.

## What is remembered, and when it is first asked

| Answer | Asked the first time | Default until then |
|---|---|---|
| Your name | an assignment has a hand-in that carries a name | none: nothing is guessed |
| Save folder | never asked; change it if you want | `~/Documents/Assignments`, created on first use |
| How much AI help when an assignment states no rule | an assignment states no AI rule | asked each time, until you say "for every assignment" |
| Apps you have | an assignment needs an app and you say which one you have | none saved |
| Permission to read your portal tab | you choose "read it from the portal tab open in my browser" | no permission |
| Your portal's address | only if you give it | none |

The permission sentence is always shown word for word before the first yes:

> Assigent will only read assignment pages in the browser you are signed in to. It never signs in, never submits.

## What is not remembered

Answers that belong to one assignment: which product to explore, which social media
platform, which topic, which app for this deliverable. They are saved in that
assignment's folder, in `choices.md` and `process/app-permissions.md`, and asked fresh
for the next assignment if it needs them.

## Seeing or changing what is saved (optional)

```
assigent config                     print what is remembered
assigent preferences                go through the saved answers; Enter keeps or skips each
assigent preferences --reset        forget everything
```

Every answer can be a flag. With `--yes` there are no prompts, and only the flags you
pass are changed:

```
assigent preferences --name "Sam Lee" --yes
assigent preferences --folder "~/School/Assignments" --yes
assigent preferences --ai-help coach --yes
assigent preferences --add-apps "figma,keynote" --yes
assigent preferences --browser chrome --browser-access yes --yes
```

| Flag | Values |
|---|---|
| `--name` | text |
| `--folder` | a folder path |
| `--ai-help` | `ask` (ask per assignment), `full`, `coach`, `study` |
| `--apps` | a comma list that replaces the saved apps |
| `--add-apps` | a comma list added to the saved apps |
| `--code-editor` | text, for example `vscode` |
| `--browser` | `chrome`, `brave`, `edge`, `none` |
| `--browser-access` | `yes` or `no`. Without a clear yes it stays `no` |
| `--portal-url` | a web address |
| `--platform` | optional note: `zoho-schools`, `google-classroom`, `canvas`, `moodle`, `microsoft-teams`, `other`, `paste` |
| `--reset` | forget every saved answer |
| `--yes` | no prompts |

`assigent setup` is the old name of this command and still works. The old flags
`--app-permission` and `--ask-choices` are accepted and ignored: asking what the
assignment needs is simply how Assigent works now.

Known app values: `powerpoint`, `keynote`, `google-slides`, `excel`, `numbers`,
`google-sheets`, `word`, `pages`, `google-docs`, `photoshop`, `illustrator`, `figma`,
`canva`. Any other app name is kept under `other`.

## The file: ~/.assigent/config.json

Every field is optional. A missing or empty field means "not known yet".

```json
{
  "version": 2,
  "name": "Sam Lee",
  "save_folder": "/home/sam/Documents/Assignments",
  "ai_help": "coach",
  "apps": {
    "slides": ["powerpoint"],
    "sheets": ["excel"],
    "documents": ["word"],
    "design": ["figma"],
    "other": []
  },
  "code_editor": "vscode",
  "browser": "chrome",
  "browser_access": true,
  "platform": "",
  "portal_url": "https://school.example/courses",
  "created": "2026-01-01T10:00:00",
  "updated": "2026-01-01T10:00:00"
}
```

| Field | Type | Meaning |
|---|---|---|
| `version` | number | `2` |
| `name` | text | the name for hand-ins. Empty: asked when a hand-in needs it |
| `save_folder` | text | full folder path. Empty: `~/Documents/Assignments` |
| `ai_help` | text | `full`, `coach` or `study`. Empty or `ask`: asked when an assignment states no AI rule |
| `apps` | object | lists of app values under `slides`, `sheets`, `documents`, `design`, `other` |
| `code_editor` | text | free text, or empty |
| `browser` | text | `chrome`, `brave`, `edge` or `none` |
| `browser_access` | true or false | `true` only after you said yes to the permission sentence |
| `platform` | text | optional note; Assigent reads every platform the same way |
| `portal_url` | text | a web address, or empty |
| `created`, `updated` | text | date and time |

A file from an older version (with `app_permission` or `ask_choices`) still loads;
those two fields are ignored.
