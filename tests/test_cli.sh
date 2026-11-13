#!/usr/bin/env bash
# Tests for install.sh and the assigent command. Everything happens in a temporary HOME,
# so your real settings and your real ~/.claude are never touched.
#
#   bash tests/test_cli.sh
#
# Prints one line per check and exits non-zero if any check fails.
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REAL_PY="$(command -v python3)"
TMPBASE="${TMPDIR:-/tmp}"
TMP="$(mktemp -d "${TMPBASE%/}/assigent-test.XXXXXX")"
trap 'HOME="$TMP/home" "$REAL_PY" "$REPO/bin/assigent" view --stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
mkdir -p "$HOME" "$TMP/pybin" "$TMP/fakebin"
ln -s "$REAL_PY" "$TMP/pybin/python3"

# A stand-in for Claude Code: it only prints what it was started with.
cat > "$TMP/fakebin/claude" <<'FAKE'
#!/bin/sh
echo "FAKE-CLAUDE:$*"
FAKE
chmod +x "$TMP/fakebin/claude"

BASE_PATH="$TMP/pybin:/usr/bin:/bin"                    # no claude on it
export PATH="$HOME/.local/bin:$TMP/fakebin:$BASE_PATH"
unset ASSIGENT_ROOT ASSIGENT_REPO PORT 2>/dev/null

pass=0; failed=0
check() {  # check "name" <command...>   passes when the command exits 0
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then pass=$((pass + 1)); echo "PASS $name"
  else failed=$((failed + 1)); echo "FAIL $name"; fi
}
has() { grep -qF -- "$2" "$1"; }          # has <file> <text>
code_is() { [ "$1" = "$2" ]; }
cfg() { python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); v=c
for k in sys.argv[2].split("."): v=v[k]
print(json.dumps(v))' "$HOME/.assigent/config.json" "$1"; }
cfg_is() { [ "$(cfg "$1")" = "$2" ]; }
http_ok() { python3 -c 'import sys,urllib.request; sys.exit(0 if urllib.request.urlopen(sys.argv[1],timeout=3).status==200 else 1)' "$1"; }
OUT="$TMP/out.txt"

echo "--- install.sh from the local clone"
PATH="$TMP/fakebin:$BASE_PATH" bash "$REPO/install.sh" > "$OUT" 2>&1; rc=$?
check "install exits 0" code_is $rc 0
for a in analyst finder builder evaluator tutor; do
  check "agent assigent-$a.md installed" test -f "$HOME/.claude/agents/assigent-$a.md"
done
check "install says it installed five agents" has "$OUT" "Installed 5 agents"
check "exactly five assigent agents are installed" sh -c "[ \$(ls '$HOME/.claude/agents' | grep -c '^assigent-') = 5 ]"
check "the separate playground page is installed with the viewer" sh -c "[ -f '$HOME/.claude/skills/assigent/ui/playground.html' ] && [ -f '$HOME/.claude/skills/assigent/ui/playground.js' ]"
check "skill SKILL.md installed" test -f "$HOME/.claude/skills/assigent/SKILL.md"
check "skill preferences.md installed" test -f "$HOME/.claude/skills/assigent/preferences.md"
check "old setup-questions.md is not shipped" test ! -e "$HOME/.claude/skills/assigent/setup-questions.md"
check "viewer installed with the skill" test -f "$HOME/.claude/skills/assigent/ui/server.py"
check "viewer icons installed" test -f "$HOME/.claude/skills/assigent/ui/icons/analyst.svg"
check "command installed and executable" test -x "$HOME/.local/bin/assigent"
check "install warns that ~/.local/bin is not on PATH" has "$OUT" "is not on your PATH"
check "install ends with Next: assigent run" sh -c "tail -1 '$OUT' | grep -q '^Next: .*assigent run$'"
check "install does not send people to setup" sh -c "! grep -q 'assigent setup' '$OUT'"
check "install says there is nothing to set up" has "$OUT" "nothing to set up"
check "install made no config" test ! -e "$HOME/.assigent/config.json"

echo "--- install.sh again: existing files are backed up"
echo "# my own edit" >> "$HOME/.claude/agents/assigent-analyst.md"
bash "$REPO/install.sh" > "$OUT" 2>&1; rc=$?
check "second install exits 0" code_is $rc 0
check "second install says it backed files up" has "$OUT" "Backed up your existing"
check "the edited agent is kept in a backup" sh -c "grep -rqF '# my own edit' '$HOME/.assigent/backups'"
check "the installed agent is the fresh copy" sh -c "! grep -qF '# my own edit' '$HOME/.claude/agents/assigent-analyst.md'"
check "no PATH warning when ~/.local/bin is on PATH" sh -c "! grep -qF 'is not on your PATH' '$OUT'"
check "with PATH set, the last line is exactly Next: assigent run" sh -c "[ \"\$(tail -1 '$OUT')\" = 'Next: assigent run' ]"

echo "--- install.sh piped (the download is replaced by a local tarball)"
mkdir -p "$TMP/curlbin" "$TMP/home2"
tar -czf "$TMP/repo.tar.gz" -C "$(dirname "$REPO")" --exclude .git --exclude demo "$(basename "$REPO")"
cat > "$TMP/curlbin/curl" <<FAKE
#!/bin/sh
# stand-in for curl: records the address, writes the local tarball to the -o path
out=""; url=""
while [ \$# -gt 0 ]; do case "\$1" in -o) out="\$2"; shift ;; http*) url="\$1" ;; esac; shift; done
echo "\$url" > "$TMP/curl-url.txt"
cp "$TMP/repo.tar.gz" "\$out"
FAKE
chmod +x "$TMP/curlbin/curl"
HOME="$TMP/home2" PATH="$TMP/curlbin:$BASE_PATH" bash < "$REPO/install.sh" > "$OUT" 2>&1; rc=$?
check "piped install exits 0" code_is $rc 0
check "piped install asks GitHub for the default repo" has "$TMP/curl-url.txt" "github.com/Dhaswin86/assigent/"
check "piped install puts the command in place" test -x "$TMP/home2/.local/bin/assigent"
check "piped install puts the skill in place" test -f "$TMP/home2/.claude/skills/assigent/ui/status.py"
HOME="$TMP/home2" ASSIGENT_REPO="someone/fork" PATH="$TMP/curlbin:$BASE_PATH" bash < "$REPO/install.sh" > "$OUT" 2>&1
check "ASSIGENT_REPO changes where it downloads from" has "$TMP/curl-url.txt" "github.com/someone/fork/"

echo "--- assigent --version, --help"
assigent --version > "$OUT" 2>&1; rc=$?
check "--version exits 0 and prints a version" sh -c "[ $rc = 0 ] && grep -qE '^assigent [0-9]+\.[0-9]+\.[0-9]+' '$OUT'"
assigent --help > "$OUT" 2>&1; rc=$?
check "--help exits 0 and lists the commands" sh -c "[ $rc = 0 ] && grep -q 'doctor' '$OUT' && grep -q 'uninstall' '$OUT'"

echo "--- straight after install: no config, everything works"
check "there is no config yet" test ! -e "$HOME/.assigent/config.json"
assigent run > "$OUT" 2>&1; rc=$?
check "run works with no config" sh -c "[ $rc = 0 ] && grep -qx 'FAKE-CLAUDE:/assigent' '$OUT'"
check "run creates the default save folder" test -d "$HOME/Documents/Assignments"
check "run wrote no config by itself" test ! -e "$HOME/.assigent/config.json"
check "run never mentions setup" sh -c "! grep -qi 'setup' '$OUT'"
rmdir "$HOME/Documents/Assignments"
assigent status > "$OUT" 2>&1; rc=$?
check "status works with no config and no folder" sh -c "[ $rc = 0 ] && grep -q 'No runs yet' '$OUT'"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor exits 0 with no config" code_is $rc 0
check "doctor treats a missing config as fine" has "$OUT" "ok   Preferences: no saved preferences yet"
check "doctor has no FIX line with no config" sh -c "! grep -q '^FIX' '$OUT'"
check "doctor accepts a save folder that does not exist yet" has "$OUT" "(created on the first run)"
assigent config > "$OUT" 2>&1; rc=$?
check "config with no saved preferences exits 0" sh -c "[ $rc = 0 ] && grep -q 'No saved preferences yet' '$OUT'"
assigent view --no-open > "$OUT" 2>&1; rc=$?
URL0="$(grep -oE 'http://127\.0\.0\.1:[0-9]+/' "$OUT" | head -1)"
check "view works with no config" sh -c "[ $rc = 0 ] && [ -n '$URL0' ]"
python3 -c "import json,urllib.request as u; assert json.load(u.urlopen('${URL0}api/runs',timeout=3)) == []" > /dev/null 2>&1
check "viewer with no config lists no runs" code_is $? 0
assigent view --stop > /dev/null 2>&1
assigent preferences --yes > "$OUT" 2>&1; rc=$?
check "preferences --yes with no answers saves nothing and exits 0" sh -c "[ $rc = 0 ] && [ ! -e '$HOME/.assigent/config.json' ]"

echo "--- assigent preferences with flags (optional)"
SAVE="$HOME/School Work"
assigent preferences --name "Sam O'Lee" --folder "$SAVE" --platform canvas \
  --portal-url "school.example/courses" --browser brave --browser-access yes \
  --ai-help full --apps "powerpoint, Excel,word,figma,blender" --code-editor vscode --yes > "$OUT" 2>&1; rc=$?
check "preferences with flags exits 0" code_is $rc 0
check "config.json is valid JSON" python3 -c "import json; json.load(open('$HOME/.assigent/config.json'))"
check "name saved (with its apostrophe)" cfg_is name "\"Sam O'Lee\""
check "save folder saved" cfg_is save_folder "\"$SAVE\""
check "save folder created" test -d "$SAVE"
check "portal address gets https://" cfg_is portal_url '"https://school.example/courses"'
check "browser saved" cfg_is browser '"brave"'
check "browser_access true after an explicit yes" cfg_is browser_access true
check "ai_help saved" cfg_is ai_help '"full"'
check "apps sorted into slides" cfg_is apps.slides '["powerpoint"]'
check "apps sorted into sheets" cfg_is apps.sheets '["excel"]'
check "apps sorted into documents" cfg_is apps.documents '["word"]'
check "apps sorted into design" cfg_is apps.design '["figma"]'
check "unknown app kept under other" cfg_is apps.other '["blender"]'
check "code editor saved" cfg_is code_editor '"vscode"'
check "no app_permission field is written" sh -c "! grep -q 'app_permission' '$HOME/.assigent/config.json'"
check "no ask_choices field is written" sh -c "! grep -q 'ask_choices' '$HOME/.assigent/config.json'"
check "preferences ends with Next: assigent run" sh -c "[ \"\$(tail -1 '$OUT')\" = 'Next: assigent run' ]"

echo "--- remembering answers one at a time"
assigent preferences --add-apps "keynote,figma" --yes > "$OUT" 2>&1
check "--add-apps adds without dropping the saved ones" sh -c "python3 -c \"import json,os; a=json.load(open(os.path.expanduser('~/.assigent/config.json')))['apps']; assert a['slides']==['powerpoint','keynote'] and a['design']==['figma'] and a['sheets']==['excel']\""
check "other answers are kept when one is changed" cfg_is name "\"Sam O'Lee\""
assigent preferences --browser chrome --yes > "$OUT" 2>&1
check "changing browser without a yes turns access off" cfg_is browser_access false
assigent preferences --ai-help ask --yes > "$OUT" 2>&1
check "--ai-help ask means ask per assignment" cfg_is ai_help '"ask"'
assigent preferences --ai-help everything --yes > "$OUT" 2>&1; rc=$?
check "an unknown --ai-help exits 2" code_is $rc 2
check "a refused change leaves the config as it was" cfg_is ai_help '"ask"'

echo "--- the old command name and old flags still work"
assigent setup --name "Old Command" --app-permission auto --ask-choices never --yes > "$OUT" 2>&1; rc=$?
check "assigent setup still works as an alias" sh -c "[ $rc = 0 ]"
check "the alias saved the name" cfg_is name '"Old Command"'
check "old --app-permission is accepted and ignored" has "$OUT" "--app-permission is no longer used and was ignored"
check "old --ask-choices is accepted and ignored" has "$OUT" "--ask-choices is no longer used and was ignored"
check "ignored flags write nothing to the config" sh -c "! grep -q 'app_permission\|ask_choices' '$HOME/.assigent/config.json'"
assigent --help > "$OUT" 2>&1
check "--help lists preferences, not setup" sh -c "grep -q '^    preferences' '$OUT' && ! grep -q '^    setup' '$OUT'"
check "--help says there is no setup to do" has "$OUT" "There is no setup to do"
python3 - "$HOME/.assigent/config.json" <<'PY'
import json, sys
c = json.load(open(sys.argv[1])); c["app_permission"] = "ask"; c["ask_choices"] = "always"; c["version"] = 1
json.dump(c, open(sys.argv[1], "w"))
PY
assigent doctor > "$OUT" 2>&1; rc=$?
check "a config from the older version still passes doctor" sh -c "[ $rc = 0 ] && grep -q 'ok   Preferences' '$OUT'"
assigent run > "$OUT" 2>&1; rc=$?
check "run works with a config from the older version" sh -c "[ $rc = 0 ] && grep -qx 'FAKE-CLAUDE:/assigent' '$OUT'"

echo "--- preferences with typed answers (prompts), all optional"
rm -f "$HOME/.assigent/config.json"
printf '\n\n\n\n\n\n\n\n\n\n' | assigent preferences > "$OUT" 2>&1; rc=$?
check "pressing Enter through every prompt exits 0" code_is $rc 0
check "skipping everything saves no name" cfg_is name '""'
check "skipping everything keeps AI help as ask" cfg_is ai_help '"ask"'
check "skipping everything gives no browser access" cfg_is browser_access false
check "the prompts say it is optional" has "$OUT" "All of this is optional"
printf '%s\n' "Ada Typed" "$SAVE" "3" "keynote" "numbers" "pages" "canva" "zed" "3" "yes" "teams.example/class" \
  | assigent preferences > "$OUT" 2>&1; rc=$?
check "prompted preferences exits 0" code_is $rc 0
check "prompted preferences shows the permission sentence" has "$OUT" "Assigent will only read assignment pages in the browser you are signed in to. It never signs in, never submits."
check "prompted: name" cfg_is name '"Ada Typed"'
check "prompted: save folder" cfg_is save_folder "\"$SAVE\""
check "prompted: ai_help" cfg_is ai_help '"coach"'
check "prompted: slides app" cfg_is apps.slides '["keynote"]'
check "prompted: design app" cfg_is apps.design '["canva"]'
check "prompted: code editor" cfg_is code_editor '"zed"'
check "prompted: browser" cfg_is browser '"edge"'
check "prompted: browser_access" cfg_is browser_access true
check "prompted: portal address" cfg_is portal_url '"https://teams.example/class"'
check "the prompts do not ask about app permission mode or assignment questions" sh -c "! grep -qi 'app permission\|assignment.s own questions\|Before each assignment' '$OUT'"

echo "--- assigent config"
assigent config > "$OUT" 2>&1; rc=$?
check "config exits 0" code_is $rc 0
check "config shows the name" has "$OUT" "Ada Typed"
assigent config --json > "$OUT" 2>&1
check "config --json prints valid JSON" python3 -c "import json; json.load(open('$OUT'))"
echo "{ not json" > "$HOME/.assigent/config.json.broken"; cp "$HOME/.assigent/config.json" "$TMP/good.json"; cp "$HOME/.assigent/config.json.broken" "$HOME/.assigent/config.json"
assigent run > "$OUT" 2>&1; rc=$?
check "run still starts when the config file is broken" sh -c "[ $rc = 0 ] && grep -qx 'FAKE-CLAUDE:/assigent' '$OUT' && grep -q 'Using the defaults' '$OUT'"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor flags a broken config file with a fix" sh -c "[ $rc = 1 ] && grep -A1 '^FIX  Preferences' '$OUT' | grep -q 'preferences --reset'"
assigent preferences --reset > "$OUT" 2>&1; rc=$?
check "preferences --reset forgets the saved answers" sh -c "[ $rc = 0 ] && [ ! -e '$HOME/.assigent/config.json' ]"
cp "$TMP/good.json" "$HOME/.assigent/config.json"; rm -f "$HOME/.assigent/config.json.broken"

echo "--- assigent doctor"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor exits 0 when all is well" code_is $rc 0
check "doctor prints six ok lines" sh -c "[ \$(grep -c '^ok   ' '$OUT') = 6 ]"
PATH="$HOME/.local/bin:$BASE_PATH" assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor exits 1 when Claude Code is missing" code_is $rc 1
check "doctor gives a fix for Claude Code" sh -c "grep -A1 '^FIX  Claude Code' '$OUT' | grep -q 'Fix:'"
mv "$HOME/.claude/agents/assigent-finder.md" "$TMP/finder.bak"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor spots a missing agent" sh -c "[ $rc = 1 ] && grep -q 'missing assigent-finder.md' '$OUT'"
mv "$TMP/finder.bak" "$HOME/.claude/agents/assigent-finder.md"

echo "--- assigent status"
assigent status > "$OUT" 2>&1; rc=$?
check "status with no runs exits 0 and says so" sh -c "[ $rc = 0 ] && grep -q 'No runs yet' '$OUT'"
RUN="$SAVE/Maths/Fake Essay Run"
mkdir -p "$RUN/process" "$RUN/deliverables"
STATUS="$HOME/.claude/skills/assigent/ui/status.py"
python3 "$STATUS" init "$RUN" "Fake Essay Run" preferred
python3 "$STATUS" start "$RUN" analyst "Reading"
python3 "$STATUS" done "$RUN" analyst "2 deliverables"
python3 "$STATUS" done "$RUN" finder "5 sources"
python3 "$STATUS" done "$RUN" builder "2/2 done"
python3 "$STATUS" start "$RUN" evaluator "Marking"
printf '# Evaluation: Fake Essay Run\n\nScore: 86/100\nVerdict: PASS\nRound: 1\n' > "$RUN/evaluation.md"
check "status.py writes the assigent agent names" has "$RUN/status.json" '"name": "assigent-finder"'
assigent status > "$OUT" 2>&1; rc=$?
check "status exits 0" code_is $rc 0
check "status lists the fake run" has "$OUT" "Fake Essay Run"
check "status shows each agent's state" has "$OUT" "analyst: done   finder: done   builder: done   evaluator: running"
check "status shows the evaluator's score" has "$OUT" "score: 86/100, PASS"
check "status has a playground column, none so far" has "$OUT" "playground: none"
assigent play --no-open > "$OUT" 2>&1; rc=$?
check "play without a playground exits 1 and says why" sh -c "[ $rc = 1 ] && grep -q 'has not been made yet' '$OUT'"
python3 "$STATUS" playground start "$RUN" "Building the playground"
assigent status > "$OUT" 2>&1
check "status shows a playground that is being made" has "$OUT" "playground: being made"
assigent play --no-open > "$OUT" 2>&1; rc=$?
check "play while it is being made exits 1" sh -c "[ $rc = 1 ] && grep -q 'still being made' '$OUT'"
mkdir -p "$RUN/playground"
printf '<!doctype html><title>Fake playground</title><button id="b">go</button>' > "$RUN/playground/index.html"
printf '{"title": "Fake concept lab", "concepts": ["One", "Two"], "activities": [{"title": "Try it", "kind": "toggle"}], "minutes": 5}' > "$RUN/playground/playground.json"
python3 "$STATUS" playground done "$RUN" "1 activity, about 5 minutes"
check "status.py records the playground beside the four agents" python3 -c "import json; s=json.load(open('$RUN/status.json')); assert s['playground']['state']=='done' and s['playground']['title']=='Fake concept lab' and len(s['agents'])==4"
assigent status > "$OUT" 2>&1
check "status shows the playground as ready" has "$OUT" "playground: ready"
assigent play --no-open > "$OUT" 2>&1; rc=$?
check "play with no viewer running gives the playground file" sh -c "[ $rc = 0 ] && grep -qF '$RUN/playground/index.html' '$OUT'"
assigent play 1 --no-open > "$OUT" 2>&1; rc=$?
check "play takes a run number" code_is $rc 0
assigent play essay --no-open > "$OUT" 2>&1; rc=$?
check "play takes part of a run name" sh -c "[ $rc = 0 ] && grep -q 'Fake Essay Run' '$OUT'"
assigent play 9 --no-open > "$OUT" 2>&1; rc=$?
check "play with a run number that does not exist exits 2" code_is $rc 2
assigent play nosuchrun --no-open > "$OUT" 2>&1; rc=$?
check "play with an unknown name exits 2" code_is $rc 2
OLD="$SAVE/Old Run"; mkdir -p "$OLD"
python3 -c "import json; s=json.load(open('$RUN/status.json')); s.pop('playground'); s['title']='Old Run'; s['updated']='2020-01-01T00:00:00'; json.dump(s, open('$OLD/status.json','w'))"
assigent status > "$OUT" 2>&1; rc=$?
check "a status.json from before the Tutor still lists (playground: none)" sh -c "[ $rc = 0 ] && grep -A3 '^Old Run' '$OUT' | grep -q 'playground: none'"
assigent status --json > "$OUT" 2>&1
check "status --json has the score" python3 -c "import json; r=json.load(open('$OUT')); assert r[0]['score']==86 and r[0]['verdict']=='PASS'"

echo "--- assigent run"
assigent run > "$OUT" 2>&1; rc=$?
check "run starts claude with /assigent" sh -c "[ $rc = 0 ] && grep -qx 'FAKE-CLAUDE:/assigent' '$OUT'"
echo "Write 300 words on rivers." > "$TMP/my brief.txt"
assigent run --paste "$TMP/my brief.txt" > "$OUT" 2>&1; rc=$?
check "run --paste passes the brief file path" sh -c "[ $rc = 0 ] && grep -qxF 'FAKE-CLAUDE:/assigent $TMP/my brief.txt' '$OUT'"
assigent run --paste "$TMP/nope.txt" > "$OUT" 2>&1; rc=$?
check "run --paste with a missing file exits 2" code_is $rc 2
PATH="$HOME/.local/bin:$BASE_PATH" assigent run > "$OUT" 2>&1; rc=$?
check "run without Claude Code exits 3" code_is $rc 3
check "run without Claude Code says how to get it" has "$OUT" "https://claude.com/claude-code"

echo "--- assigent view"
assigent view --no-open > "$OUT" 2>&1; rc=$?
check "view exits 0" code_is $rc 0
URL="$(grep -oE 'http://127\.0\.0\.1:[0-9]+/' "$OUT" | head -1)"
PORT_USED="$(echo "$URL" | grep -oE '[0-9]+/$' | tr -d /)"
check "view picks a port from 8850 up" sh -c "[ -n '$PORT_USED' ] && [ '$PORT_USED' -ge 8850 ]"
check "viewer answers 200 on /" http_ok "$URL"
check "viewer serves its script and styles" sh -c "python3 -c \"import urllib.request as u; [u.urlopen('$URL'+p,timeout=3) for p in ('app.js','style.css','office3d.js','icons/analyst.svg')]\""
python3 -c "import json,urllib.request as u; r=json.load(u.urlopen('${URL}api/runs',timeout=3)); assert any(x['title']=='Fake Essay Run' for x in r), r" > /dev/null 2>&1
check "/api/runs lists the fake run" code_is $? 0
python3 -c "import json,urllib.request as u; r=json.load(u.urlopen('${URL}api/run?id=0',timeout=3)); assert r['agents'][0]['name']=='assigent-analyst'" > /dev/null 2>&1
check "/api/run returns the run's agents" code_is $? 0
http_code() { python3 - "$1" "$2" <<'PY'
import http.client, sys
host, port = sys.argv[1].replace("http://", "").rstrip("/").split(":")
c = http.client.HTTPConnection(host, int(port), timeout=3); c.request("GET", sys.argv[2]); r = c.getresponse()
print(r.status, r.getheader("Content-Security-Policy") or "-", r.getheader("Content-Type") or "-")
PY
}
check "viewer serves the separate playground page" sh -c "python3 -c \"import urllib.request as u; [u.urlopen('$URL'+p,timeout=3) for p in ('playground.html','playground.js')]\""
python3 -c "import json,urllib.request as u; r=json.load(u.urlopen('${URL}api/run?id=0',timeout=3)); p=r['playground']; assert p['state']=='done' and p['hasFile'] and p['title']=='Fake concept lab' and p['concepts']==['One','Two'] and p['minutes']==5 and len(p['activities'])==1, p" > /dev/null 2>&1
check "/api/run describes the playground" code_is $? 0
python3 -c "import json,urllib.request as u; r=json.load(u.urlopen('${URL}api/runs',timeout=3)); assert r[0]['playground']['hasFile'] and r[1]['playground']['state']=='none', r" > /dev/null 2>&1
check "/api/runs says which runs have a playground (older run: none)" code_is $? 0
http_code "$URL" "/play/0/index.html" > "$OUT" 2>&1
check "the playground file is served" sh -c "grep -q '^200 ' '$OUT' && grep -q 'text/html' '$OUT'"
check "it is served sandboxed, with no network allowed" sh -c "grep -q 'sandbox allow-scripts' '$OUT' && grep -q \"default-src 'unsafe-inline'\" '$OUT' && ! grep -q 'allow-same-origin' '$OUT'"
for bad in "/play/0/../status.json" "/play/0/%2e%2e/status.json" "/play/0/..%2fstatus.json" "/play/0/../../../etc/passwd" "/play/0//etc/passwd" "/play/0/" "/play/9/index.html" "/play/x/index.html" "/play/1/index.html"; do
  http_code "$URL" "$bad" > "$OUT" 2>&1
  check "refused: $bad" sh -c "grep -q '^404 ' '$OUT'"
done
ln -s "$RUN/status.json" "$RUN/playground/leak.json"
http_code "$URL" "/play/0/leak.json" > "$OUT" 2>&1
check "refused: a link inside the playground that points outside it" sh -c "grep -q '^404 ' '$OUT'"
rm -f "$RUN/playground/leak.json"
echo "secret" > "$RUN/playground/notes.exe"
http_code "$URL" "/play/0/notes.exe" > "$OUT" 2>&1
check "refused: a file type the playground has no use for" sh -c "grep -q '^404 ' '$OUT'"
rm -f "$RUN/playground/notes.exe"
assigent play --no-open > "$OUT" 2>&1; rc=$?
check "play opens the separate page when the viewer is running" sh -c "[ $rc = 0 ] && grep -q '^${URL}playground.html?run=0$' '$OUT'"
assigent view --no-open > "$OUT" 2>&1
check "a second view reuses the running viewer" has "$OUT" "already running"
assigent view --stop > "$OUT" 2>&1; rc=$?
check "view --stop exits 0 and says stopped" sh -c "[ $rc = 0 ] && grep -q 'Viewer stopped' '$OUT'"
sleep 0.5
check "the viewer is down after --stop" sh -c "! python3 -c \"import urllib.request as u; u.urlopen('$URL',timeout=2)\""

echo "--- assigent uninstall"
assigent uninstall < /dev/null > "$OUT" 2>&1; rc=$?
check "uninstall without a yes (no terminal) exits 2 and removes nothing" sh -c "[ $rc = 2 ] && [ -x '$HOME/.local/bin/assigent' ]"
assigent uninstall --yes < /dev/null > "$OUT" 2>&1; rc=$?
check "uninstall --yes exits 0" code_is $rc 0
check "agents removed" sh -c "! ls '$HOME/.claude/agents/' | grep -q assigent"
check "skill removed" test ! -e "$HOME/.claude/skills/assigent"
check "command removed" test ! -e "$HOME/.local/bin/assigent"
check "saved answers kept unless asked" test -f "$HOME/.assigent/config.json"
check "assignment folders left alone" test -f "$RUN/evaluation.md"
check "uninstall says the saved answers were kept" has "$OUT" "Kept your saved answers"
python3 "$REPO/bin/assigent" uninstall --yes --delete-config < /dev/null > "$OUT" 2>&1; rc=$?
check "uninstall --delete-config removes ~/.assigent" sh -c "[ $rc = 0 ] && [ ! -e '$HOME/.assigent' ]"
check "assignment folders still there" test -d "$RUN/deliverables"

echo
echo "$pass passed, $failed failed"
[ "$failed" = 0 ]
