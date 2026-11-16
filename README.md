# Assigent

Assigent helps you with school and course assignments inside Claude Code. Four agents
work one after another: one reads the brief, one finds sources, one does the work as
far as the assignment's AI rule allows, and one marks it before you hand it in.

It runs on your own computer, on your own Claude plan. You hand in the work yourself.

## What you need

- A Claude plan that includes Claude Code, with Claude Code installed
- Python 3 (already on most Macs and Linux computers)
- Optional: the Claude browser extension in Chrome, Brave or Edge, if you want
  Assigent to read the assignment from your portal tab

## Install and run

```
curl -fsSL https://raw.githubusercontent.com/Dhaswin86/assigent/main/install.sh | bash
assigent run
```

Or from a copy of this folder: `./install.sh`, then `assigent run`.

That is all. There is no setup and no list of questions to get through first.

The installer copies five agents to `~/.claude/agents/`, the skill to
`~/.claude/skills/assigent/` and the command to `~/.local/bin/assigent`. It backs up
any file of the same name first and never uses sudo.

## It asks only what your assignment needs

Assigent has no fixed questions. It reads the assignment first, then asks you only
what that assignment needs an answer to, in one round, before any research or
building starts.

It starts with one question: where is the assignment? You can paste it, give a file,
or have it read from the portal tab open in your browser. Only if you choose the
browser does it ask your permission to read that tab.

Then the questions come from the brief:

| The brief says | Assigent asks |
|---|---|
| "Explore a Zoho product and write a review" | Which product do you want? |
| "Plan a week of posts for social media" | Which platform or platforms do you want? |
| "Make a poster with a design tool" | Figma, Photoshop, Illustrator or Canva? May it use that app? |
| "Hand in a deck with your name on the title slide" | What name should go on it? Asked once, then remembered |
| Nothing about AI | How much help do you want: full work, coach only, or study sources only? |
| "Write 500 words on the water cycle, AI allowed" | Nothing. The brief fixes everything, so it starts |

The rules behind this:

- If the assignment names an app, a product, a platform, a tool or anything else with
  more than one possible option and does not say which, Assigent asks which one you
  want. It never picks silently.
- It never asks what the assignment does not need. An essay gets no app question.
- It never asks what the brief already fixes. If the brief names the platform, there
  is no platform question.
- It never asks twice. Answers it can reuse, such as your name and the apps you have,
  are remembered.
- Each question comes with a few options and a recommended default. You can type your
  own answer. If you skip one, it uses the default and says so in the report.

Answers for one assignment are saved in its folder (`choices.md`). The agents hold to
them, and the Evaluator fails work that ignores a choice you made.

## Learn it first: a playground made for your assignment

Beside the four agents, a Tutor builds one small interactive page for each assignment.
It teaches the idea behind the assignment by letting you try things. It never contains
the answer, so it is made even when AI help is not allowed.

| The assignment is about | The playground lets you |
|---|---|
| An SEO title and description | type them and watch a live search-result preview with length meters |
| Classes and objects | build an object, call its methods and watch its state change |

Open it with `assigent play`, or the Playground icon in the viewer.

Every assignment gets one, earlier ones too: any run without a playground has one built
the next time you start Assigent, or right away with `/assigent make the playgrounds`.

## Two ways to use it

### In the terminal

```
assigent run                     start Claude Code on your next assignment
assigent run --paste brief.txt   start from a brief you saved in a file
assigent view                    open the viewer that shows the agents at work
assigent play                    open the playground for your newest run
assigent status                  list your runs, each agent's state and the score
assigent doctor                  check that everything is installed
assigent update                  get the newest Assigent
```

### In Claude Code, with the browser extension

1. Install the Claude extension in Chrome, Brave or Edge.
2. Sign in to your learning platform in that browser, as you normally do, and open
   your assignments page.
3. Open Claude Code and type `/assigent`.
4. Choose "read it from the portal tab open in my browser" and allow it to read the
   tab.

It works the same way on any platform, because it reads the page you can see. If the
portal is signed out, it asks you to sign in. It does not sign in for you.

No browser? Paste the brief into Claude Code after typing `/assigent`.

## What happens in a run

1. Assigent asks where the assignment is, and reads it.
2. The Analyst writes `brief.md`: a checklist of what is asked, and the questions this
   assignment needs.
3. Assigent asks you those questions, once. If there are none, it says so and goes on.
4. The Source finder gathers docs and tutorials into `sources.md`.
   The Tutor then starts on your playground while the work goes on.
5. The Builder does the work into `deliverables/` and writes `report.md`. The work is
   short on words, with pictures that fit, at high quality. It asks before adding
   pictures or videos.
6. The Evaluator marks it out of 100 and writes `evaluation.md`. If it says revise,
   the Builder gets one round to fix the list.
7. The Evaluator then checks how well you understood the concept: a few opening
   questions to hear your own idea, then 15 to 20 questions in all, easier or harder
   depending on your answers. It remembers what each person understood in
   `~/.assigent/learners/`, on your computer only, so the next check starts from there.
   Your answers never change the score or the files.

Everything lands in one folder per assignment, inside `~/Documents/Assignments`
unless you choose another folder.

## Rules it always keeps

- It never signs in for you and never types passwords.
- It never submits, uploads or hands in anything. That step is yours.
- It never sends messages or posts for you.
- It never gets around an assignment's AI rule. If AI is not allowed, it only gives
  you the brief and a reading list.
- It never picks silently when the assignment leaves a choice to you.
- It opens an app on your computer only after you allowed it for that assignment.
- Parts that must come from your own life or in your own voice stay as marked
  placeholders for you to fill, unless you supply them.
- It only runs when you start it. Nothing watches your portal in the background.
- Files come out in the type the assignment asks for: a deck is a `.pptx`, a sheet is
  a `.xlsx`, a report is a `.docx`. Never a Markdown file or a PDF stand-in.

Check your school's rules on AI help before you use it. You are responsible for what
you hand in.

## Preferences (optional)

Assigent remembers answers it can reuse in `~/.assigent/config.json`: your name, your
save folder, your AI-help preference, the apps you have and your browser permission.
You never have to touch this. If you want to see or change it:

```
assigent config                                   print what is remembered
assigent preferences                              go through the saved answers
assigent preferences --name "Sam Lee" --yes       change one answer
assigent preferences --folder "~/School" --yes    use another save folder
assigent preferences --reset                      forget everything
```

Details are in [skill/assigent/preferences.md](skill/assigent/preferences.md).
`assigent setup` is the old name of `assigent preferences` and still works.

## Commands

| Command | What it does |
|---|---|
| `assigent run` | Start Claude Code with `/assigent` |
| `assigent view` | Start the viewer and open it. `assigent view --stop` stops it |
| `assigent play` | Open a run's playground. `assigent play 2` or `assigent play "essay"` picks a run |
| `assigent status` | List runs with each agent's state, the score and the playground |
| `assigent doctor` | Check the install, one line per check with a fix |
| `assigent update` | Get the newest Assigent. Your answers and assignment folders stay |
| `assigent preferences` | Optional: see or change what Assigent remembers |
| `assigent config` | Print what Assigent remembers |
| `assigent uninstall` | Remove Assigent |
| `assigent --version` | Print the version |

## Uninstall

```
assigent uninstall
```

This removes the agents, the skill and the command. Your assignment folders are left
alone. It asks before it deletes your saved answers in `~/.assigent`.

## For developers

```
bash tests/test_cli.sh        tests the installer and the command in a temporary home
bash site/build.sh            builds the demo viewer into site/demo/
```

The viewer has its own browser test in `skill/assigent/ui/tests/test_office.py`; the
top of that file says how to run it.

## License

MIT. See [LICENSE](LICENSE).
