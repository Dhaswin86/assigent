# Assigent setup questions

New users answer these eight questions before anything runs. They are asked in this
order in two places, and both write the same file, `~/.assigent/config.json`:

- in the terminal: `assigent setup`
- inside Claude Code: the `/assigent` skill asks them when the file is missing

Every answer can also be given as a flag, so setup can run with no prompts:

```
assigent setup --name "Sam Lee" --folder "~/Documents/Assignments" \
  --platform canvas --portal-url "https://school.example/courses" \
  --browser chrome --browser-access yes --ai-help coach \
  --apps "powerpoint,excel,word,figma" --code-editor vscode \
  --app-permission ask --ask-choices always --yes
```

## The questions

### 1. Your name
"What is your name, as it should appear on hand-ins?"
Free text. Required. Flag: `--name`.

### 2. Where to save assignment folders
"Where should Assigent save your assignment folders?"
Free text, a folder path. Default `~/Documents/Assignments`. Flag: `--folder`.

### 3. Learning platform
"Which learning platform do you use?"

| Choice | Value |
|---|---|
| Zoho Schools | `zoho-schools` |
| Google Classroom | `google-classroom` |
| Canvas | `canvas` |
| Moodle | `moodle` |
| Microsoft Teams | `microsoft-teams` |
| Other | `other` |
| I'll paste the brief myself | `paste` |

Flag: `--platform`. When a platform is chosen (anything but `paste`), also ask:
"What is the web address of your portal's assignments page?" Flag: `--portal-url`.
It may be left empty and added later.

Inside Claude Code, AskUserQuestion shows a few choices at a time. Offer the choices
in two groups (platforms, then "other" and "paste") or let the user type the name; all
seven must be reachable.

### 4. Browser
"Which browser should Assigent use? It needs the Claude browser extension."
Choices: Chrome (`chrome`), Brave (`brave`), Edge (`edge`), none (`none`).
Flag: `--browser`.

If a browser is chosen, ask for explicit permission, showing this sentence word for
word:

> Assigent will only read assignment pages in the browser you are signed in to. It never signs in, never submits.

"Do you allow Assigent to read your portal through this browser?" yes or no.
Flag: `--browser-access yes|no`. Without a clear yes the value is `false`.

Skipped when question 3 is `paste`: the browser is recorded as `none` and access as
`false`, because nothing is read from a portal.

### 5. Default AI help
"When an assignment states no AI rule, how much should Assigent help?"

| Choice | Value | What happens |
|---|---|---|
| Full work | `full` | Assigent does the assignment and marks it |
| Coach only | `coach` | A plan, a starter outline and feedback. You do the work |
| Study sources only | `study` | A brief and a reading list. Nothing is built |

Flag: `--ai-help`. Default `coach`. A rule stated by the assignment always wins over
this default.

### 6. Apps and file types
"Which apps do you have?" so deliverables come out in a file type you can open.

| Group | Choices (values) |
|---|---|
| Slides | PowerPoint (`powerpoint`), Keynote (`keynote`), Google Slides (`google-slides`) |
| Sheets | Excel (`excel`), Numbers (`numbers`), Google Sheets (`google-sheets`) |
| Documents | Word (`word`), Pages (`pages`), Google Docs (`google-docs`) |
| Design | Photoshop (`photoshop`), Illustrator (`illustrator`), Figma (`figma`), Canva (`canva`) |
| Code editor | free text, for example `vscode` |

Flags: `--apps "powerpoint,excel,word"` (one comma list for all groups) and
`--code-editor`. Any app not in the table is kept under `other`.

### 7. App permission mode
"Before each assignment, should Assigent ask which apps it may use?"

| Choice | Value |
|---|---|
| Ask me for every assignment | `ask` (default) |
| Use the apps I listed without asking | `auto` |

Flag: `--app-permission`.

In `ask` mode, for every assignment, after the Analyst finishes and before the Builder
starts, Assigent tells you which apps that assignment requires and asks:
(a) whether it may use each app, and
(b) whether you want a specific app of your own choice to complete it.
The answers are saved in the assignment's `process/app-permissions.md` and passed to
the Builder.

### 8. The assignment's own questions
"Many assignments leave a choice to you. Should Assigent ask you, or pick for you?"

| Choice | Value |
|---|---|
| Ask me the assignment's own questions before starting (recommended) | `always` (default) |
| Pick defaults for me | `never` |

Flag: `--ask-choices always|never`.

With `always`, after the Analyst reads the brief and before any research or building
starts, Assigent asks you each thing the assignment leaves open. The rule: whenever
the assignment names an app, product, platform, tool or anything else with more than
one possible option and does not say which, Assigent asks which one you want. It
never picks silently. Two examples: a brief that says "explore a Zoho product" makes
it ask which product you want, and a brief about social media makes it ask which
platform you want. "Use a design tool" makes it ask Figma, Photoshop, Illustrator or
Canva, with the apps you listed in question 6 offered first. Each question comes with
a few options and a recommended default, and you can type your own
answer. The answers are saved in the assignment's `choices.md` and the Source finder,
Builder and Evaluator hold to them. A question you skip gets the default, and
report.md says so.

With `never`, Assigent picks the defaults and lists them in `choices.md` and report.md.

Per assignment there is one round of questions: these first, then the app question
from 7.

## The config file: ~/.assigent/config.json

```json
{
  "version": 1,
  "name": "Sam Lee",
  "save_folder": "/home/sam/Documents/Assignments",
  "platform": "canvas",
  "portal_url": "https://school.example/courses",
  "browser": "chrome",
  "browser_access": true,
  "ai_help": "coach",
  "apps": {
    "slides": ["powerpoint"],
    "sheets": ["excel"],
    "documents": ["word"],
    "design": ["figma"],
    "other": []
  },
  "code_editor": "vscode",
  "app_permission": "ask",
  "ask_choices": "always",
  "created": "2026-01-01T10:00:00",
  "updated": "2026-01-01T10:00:00"
}
```

| Field | Type | Allowed values |
|---|---|---|
| `version` | number | `1` |
| `name` | text | not empty |
| `save_folder` | text | a full folder path (`~` is expanded when saved) |
| `platform` | text | `zoho-schools`, `google-classroom`, `canvas`, `moodle`, `microsoft-teams`, `other`, `paste` |
| `portal_url` | text | a web address, or empty. Always empty for `paste` |
| `browser` | text | `chrome`, `brave`, `edge`, `none` |
| `browser_access` | true or false | `true` only after the user said yes to the permission sentence. Never `true` when `browser` is `none` |
| `ai_help` | text | `full`, `coach`, `study` |
| `apps` | object | lists of app values under `slides`, `sheets`, `documents`, `design`, `other` |
| `code_editor` | text | free text, or empty |
| `app_permission` | text | `ask`, `auto` |
| `ask_choices` | text | `always`, `never` |
| `created`, `updated` | text | date and time, written by setup |

`assigent config` prints the file. `assigent doctor` checks it. Run `assigent setup`
again at any time to change an answer; press Enter to keep the old one.
