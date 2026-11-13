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
for a in analyst finder builder evaluator; do
  check "agent assigent-$a.md installed" test -f "$HOME/.claude/agents/assigent-$a.md"
done
check "skill SKILL.md installed" test -f "$HOME/.claude/skills/assigent/SKILL.md"
check "skill setup-questions.md installed" test -f "$HOME/.claude/skills/assigent/setup-questions.md"
check "viewer installed with the skill" test -f "$HOME/.claude/skills/assigent/ui/server.py"
check "viewer icons installed" test -f "$HOME/.claude/skills/assigent/ui/icons/analyst.svg"
check "command installed and executable" test -x "$HOME/.local/bin/assigent"
check "install warns that ~/.local/bin is not on PATH" has "$OUT" "is not on your PATH"
check "install ends by pointing to assigent setup" has "$OUT" "assigent setup"
check "install made no config" test ! -e "$HOME/.assigent/config.json"

echo "--- install.sh again: existing files are backed up"
echo "# my own edit" >> "$HOME/.claude/agents/assigent-analyst.md"
bash "$REPO/install.sh" > "$OUT" 2>&1; rc=$?
check "second install exits 0" code_is $rc 0
check "second install says it backed files up" has "$OUT" "Backed up your existing"
check "the edited agent is kept in a backup" sh -c "grep -rqF '# my own edit' '$HOME/.assigent/backups'"
check "the installed agent is the fresh copy" sh -c "! grep -qF '# my own edit' '$HOME/.claude/agents/assigent-analyst.md'"
check "no PATH warning when ~/.local/bin is on PATH" sh -c "! grep -qF 'is not on your PATH' '$OUT'"

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

echo "--- before setup"
assigent config > "$OUT" 2>&1; rc=$?
check "config with no settings exits 2" code_is $rc 2
assigent run > "$OUT" 2>&1; rc=$?
check "run with no settings exits 2 and points to setup" sh -c "[ $rc = 2 ] && grep -q 'assigent setup' '$OUT'"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor with no settings exits 1" code_is $rc 1
check "doctor names the fix for missing settings" has "$OUT" "Fix: Run: assigent setup"
assigent setup --yes > "$OUT" 2>&1; rc=$?
check "setup --yes with no name exits 2" code_is $rc 2
check "a refused setup writes no config" test ! -e "$HOME/.assigent/config.json"

echo "--- assigent setup with flags"
SAVE="$HOME/School Work"
assigent setup --name "Sam O'Lee" --folder "$SAVE" --platform canvas \
  --portal-url "school.example/courses" --browser brave --browser-access yes \
  --ai-help full --apps "powerpoint, Excel,word,figma,blender" --code-editor vscode \
  --app-permission ask --ask-choices never --yes > "$OUT" 2>&1; rc=$?
check "setup with flags exits 0" code_is $rc 0
check "config.json is valid JSON" python3 -c "import json; json.load(open('$HOME/.assigent/config.json'))"
check "name saved (with its apostrophe)" cfg_is name "\"Sam O'Lee\""
check "save folder saved" cfg_is save_folder "\"$SAVE\""
check "save folder created" test -d "$SAVE"
check "platform saved" cfg_is platform '"canvas"'
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
check "app_permission saved" cfg_is app_permission '"ask"'
check "ask_choices saved from --ask-choices never" cfg_is ask_choices '"never"'
check "setup summary shows the assignment questions setting" has "$OUT" "Assignment questions:  never"

echo "--- setup rules"
assigent setup --browser chrome --yes > "$OUT" 2>&1
check "changing browser without a yes turns access off" cfg_is browser_access false
check "other answers are kept on a re-run" cfg_is name "\"Sam O'Lee\""
assigent setup --platform paste --yes > "$OUT" 2>&1
check "paste platform records no browser" cfg_is browser '"none"'
check "paste platform records no access" cfg_is browser_access false
check "paste platform clears the portal address" cfg_is portal_url '""'
check "ask_choices is kept on a re-run" cfg_is ask_choices '"never"'
assigent setup --ask-choices always --yes > "$OUT" 2>&1; rc=$?
check "--ask-choices always is saved" sh -c "[ $rc = 0 ] && [ \"\$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser(\"~/.assigent/config.json\")))[\"ask_choices\"])')\" = always ]"
assigent setup --ask-choices sometimes --yes > "$OUT" 2>&1; rc=$?
check "an unknown --ask-choices exits 2" sh -c "[ $rc = 2 ] && grep -q 'always or never' '$OUT'"
check "a refused --ask-choices leaves the config as it was" cfg_is ask_choices '"always"'
assigent setup --help > "$OUT" 2>&1
check "setup --help lists --ask-choices" has "$OUT" "--ask-choices"
assigent setup --platform nonsense --yes > "$OUT" 2>&1; rc=$?
check "an unknown platform exits 2" code_is $rc 2
assigent setup --ai-help everything --yes > "$OUT" 2>&1; rc=$?
check "an unknown --ai-help exits 2" code_is $rc 2
check "a refused setup leaves the config as it was" cfg_is platform '"paste"'

echo "--- ask_choices default and an older config"
rm -f "$HOME/.assigent/config.json"
assigent setup --name "Default Dee" --yes > "$OUT" 2>&1
check "ask_choices defaults to always" cfg_is ask_choices '"always"'
python3 -c "import json,sys; p=sys.argv[1]; c=json.load(open(p)); del c['ask_choices']; json.dump(c,open(p,'w'))" "$HOME/.assigent/config.json"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor flags a config that lacks ask_choices" sh -c "[ $rc = 1 ] && grep -q 'ask_choices' '$OUT'"

echo "--- setup with typed answers (prompts)"
rm -f "$HOME/.assigent/config.json"
printf '%s\n' "Ada Typed" "$SAVE" "5" "teams.example/class" "3" "yes" "2" "keynote" "numbers" "pages" "canva" "zed" "2" "2" \
  | assigent setup > "$OUT" 2>&1; rc=$?
check "prompted setup exits 0" code_is $rc 0
check "prompted setup shows the permission sentence" has "$OUT" "Assigent will only read assignment pages in the browser you are signed in to. It never signs in, never submits."
check "prompted: name" cfg_is name '"Ada Typed"'
check "prompted: platform" cfg_is platform '"microsoft-teams"'
check "prompted: browser" cfg_is browser '"edge"'
check "prompted: browser_access" cfg_is browser_access true
check "prompted: ai_help" cfg_is ai_help '"coach"'
check "prompted: slides app" cfg_is apps.slides '["keynote"]'
check "prompted: design app" cfg_is apps.design '["canva"]'
check "prompted: code editor" cfg_is code_editor '"zed"'
check "prompted: app_permission" cfg_is app_permission '"auto"'
check "prompted: ask_choices" cfg_is ask_choices '"never"'
# questions come in the stated order
python3 - "$OUT" > /dev/null 2>&1 <<'PY'
import sys
t = open(sys.argv[1]).read()
marks = ["1. Your name", "2. Where to save", "3. Your learning platform", "4. Browser to use",
         "Allow Assigent to read your portal", "5. How much AI help", "6. Apps you have", "7. Before each assignment", "8. Many assignments leave a choice"]
pos = [t.find(m) for m in marks]
sys.exit(0 if all(p >= 0 for p in pos) and pos == sorted(pos) else 1)
PY
check "prompted setup asks the eight questions in order" code_is $? 0

echo "--- assigent config"
assigent config > "$OUT" 2>&1; rc=$?
check "config exits 0" code_is $rc 0
check "config shows the name" has "$OUT" "Ada Typed"
assigent config --json > "$OUT" 2>&1
check "config --json prints valid JSON" python3 -c "import json; json.load(open('$OUT'))"

echo "--- assigent doctor"
assigent doctor > "$OUT" 2>&1; rc=$?
check "doctor exits 0 when all is well" code_is $rc 0
check "doctor prints six checks" sh -c "[ \$(grep -c '^ok   ' '$OUT') = 6 ]"
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
check "settings kept unless asked" test -f "$HOME/.assigent/config.json"
check "assignment folders left alone" test -f "$RUN/evaluation.md"
check "uninstall says the settings were kept" has "$OUT" "Kept your settings"
python3 "$REPO/bin/assigent" uninstall --yes --delete-config < /dev/null > "$OUT" 2>&1; rc=$?
check "uninstall --delete-config removes ~/.assigent" sh -c "[ $rc = 0 ] && [ ! -e '$HOME/.assigent' ]"
check "assignment folders still there" test -d "$RUN/deliverables"

echo
echo "$pass passed, $failed failed"
[ "$failed" = 0 ]
