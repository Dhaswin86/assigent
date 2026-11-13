# Assigent

Assigent helps you with school and course assignments inside Claude Code. Four agents
work one after another: one reads the brief, one finds sources, one does the work as
far as the assignment's AI rule allows, and one marks it before you hand it in.

It runs on your own computer, on your own Claude plan. You hand in the work yourself.

## What you need

- A Claude plan that includes Claude Code, with Claude Code installed
- Python 3 (already on most Macs and Linux computers)
- Optional: the Claude browser extension in Chrome, Brave or Edge, if you want
  Assigent to read your learning platform for you

## Install

```
curl -fsSL https://raw.githubusercontent.com/Dhaswin86/assigent/main/install.sh | bash
```

Or from a copy of this folder:

```
./install.sh
```

The installer copies four agents to `~/.claude/agents/`, the skill to
`~/.claude/skills/assigent/` and the command to `~/.local/bin/assigent`. It backs up
any file of the same name first and never uses sudo.

Then answer the setup questions:

```
assigent setup
```

## The setup questions

Assigent asks these once, before anything runs.

1. Your name, as it should appear on hand-ins.
2. Where to save assignment folders. The default is `~/Documents/Assignments`.
3. Your learning platform: Zoho Schools, Google Classroom, Canvas, Moodle, Microsoft
   Teams, other, or "I'll paste the brief myself". If you pick a platform, it also
   asks for the portal's web address.
4. The browser to use: Chrome, Brave, Edge or none. If you pick a browser, Assigent
   asks your permission to read your portal through it. It will only read assignment
   pages in the browser you are signed in to. It never signs in, never submits.
5. How much AI help you want when an assignment states no AI rule: full work, coach
   only, or study sources only.
6. The apps you have for slides, sheets, documents, design and code, so files come
   out in a type you can open.
7. Whether Assigent should ask before each assignment which apps it may use (`ask`,
   the default) or use the apps you listed without asking (`auto`).
8. Whether Assigent should ask you the assignment's own questions before starting
   (recommended), or pick defaults for you.

Your answers are saved in `~/.assigent/config.json`. Run `assigent setup` again to
change them. The full list of choices and flags is in
[skill/assigent/setup-questions.md](skill/assigent/setup-questions.md).

You can also give every answer as a flag and skip the prompts:

```
assigent setup --name "Sam Lee" --platform canvas \
  --portal-url "https://school.example/courses" --browser chrome \
  --browser-access yes --ai-help coach --apps "powerpoint,excel,word" \
  --app-permission ask --ask-choices always --yes
```

## What it asks you for each assignment

Before any research or building starts, Assigent asks you one round of questions.

First, the questions the assignment itself needs answered. The rule is simple: if the
assignment names an app, a product, a platform, a tool or anything else that has more
than one possible option, and does not say which, Assigent asks which one you want.
It never picks for you silently.

- "Explore a Zoho product": which product do you want?
- "Post on a social media platform": which platform do you want?
- "Use a design tool": Figma, Photoshop, Illustrator or Canva?
- "Make a spreadsheet": which spreadsheet app?

The same goes for a topic, a brand or an audience. Each question comes with a few
options and a recommended default, and you can type your own answer. Apps you listed
in setup are offered first. If you skip a question, Assigent uses the default and
says so in the report. It does not ask about things the brief already fixes.

Then, in the same round, which apps it may use.

Your answers are saved in the assignment folder (`choices.md` and
`process/app-permissions.md`). The agents hold to them, and the Evaluator fails work
that ignores a choice you made.

## Two ways to use it

### In the terminal

```
assigent run                  start Claude Code on your next assignment
assigent run --paste brief.txt   start from a brief you saved in a file
assigent view                 open the viewer that shows the agents at work
assigent status               list your runs, each agent's state and the score
assigent doctor               check that everything is installed
```

### In Claude Code, with the browser extension

1. Install the Claude extension in Chrome, Brave or Edge.
2. Sign in to your learning platform in that browser, as you normally do.
3. Open Claude Code and type `/assigent`.
4. When Claude asks, allow it to read the portal tab.

Assigent lists the assignments that are open and you pick one. If the portal is signed
out, it asks you to sign in. It does not sign in for you.

No browser? Paste the brief into Claude Code after typing `/assigent`.

## What happens in a run

1. The Analyst reads the brief and writes `brief.md`, a checklist of what is asked.
2. Assigent asks you what the assignment leaves open, such as which product or which
   social media platform. Then it tells you which apps the assignment needs, and asks
   whether it may use each one and whether you want a specific app of your own choice.
3. The Source finder gathers docs and tutorials into `sources.md`.
4. The Builder does the work into `deliverables/` and writes `report.md`.
5. The Evaluator marks it out of 100 and writes `evaluation.md`. If it says revise,
   the Builder gets one round to fix the list.

Everything lands in one folder per assignment, inside your save folder.

## Rules it always keeps

- It never signs in for you and never types passwords.
- It never submits, uploads or hands in anything. That step is yours.
- It never sends messages or posts for you.
- It never gets around an assignment's AI rule. If AI is not allowed, it only gives
  you the brief and a reading list.
- Parts that must come from your own life or in your own voice stay as marked
  placeholders for you to fill.
- It only runs when you start it. Nothing watches your portal in the background.
- Files come out in the type the assignment asks for: a deck is a `.pptx`, a sheet is
  a `.xlsx`, a report is a `.docx`. Never a Markdown file or a PDF stand-in.

Check your school's rules on AI help before you use it. You are responsible for what
you hand in.

## Commands

| Command | What it does |
|---|---|
| `assigent setup` | Ask the setup questions, or take them as flags |
| `assigent run` | Start Claude Code with `/assigent` |
| `assigent view` | Start the viewer and open it. `assigent view --stop` stops it |
| `assigent status` | List runs with each agent's state and the score |
| `assigent doctor` | Check the install, one line per check with a fix |
| `assigent config` | Print your settings |
| `assigent uninstall` | Remove Assigent |
| `assigent --version` | Print the version |

## Uninstall

```
assigent uninstall
```

This removes the agents, the skill and the command. Your assignment folders are left
alone. It asks before it deletes your settings in `~/.assigent`.

## For developers

```
bash tests/test_cli.sh        tests the installer and the command in a temporary home
bash site/build.sh            builds the demo viewer into site/demo/
```

The viewer has its own browser test in `skill/assigent/ui/tests/test_office.py`; the
top of that file says how to run it.

## License

MIT. See [LICENSE](LICENSE).
