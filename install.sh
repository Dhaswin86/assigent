#!/usr/bin/env bash
# Assigent installer.
#
#   From a clone:   ./install.sh
#   In one line:    curl -fsSL https://raw.githubusercontent.com/Dhaswin86/assigent/main/install.sh | bash
#
# It copies the five agents to ~/.claude/agents/, the skill to ~/.claude/skills/assigent/
# and the command to ~/.local/bin/assigent. Files of the same name are backed up first.
# It never uses sudo. The only network call is the download of the repo in one-line mode.
set -euo pipefail

ASSIGENT_REPO="${ASSIGENT_REPO:-Dhaswin86/assigent}"
ASSIGENT_BRANCH="${ASSIGENT_BRANCH:-main}"

if [ -z "${HOME:-}" ]; then
  echo "HOME is not set, so there is nowhere to install to." >&2
  exit 1
fi

AGENTS_DIR="$HOME/.claude/agents"
SKILL_DIR="$HOME/.claude/skills/assigent"
BIN_DIR="$HOME/.local/bin"
BACKUP_DIR="$HOME/.assigent/backups/$(date +%Y%m%d-%H%M%S)"
TMP=""

cleanup() { if [ -n "$TMP" ] && [ -d "$TMP" ]; then rm -rf "$TMP"; fi; }
trap cleanup EXIT

say() { printf '%s\n' "$*"; }

# Where are the files? Next to this script when run from a clone; otherwise download them.
SRC=""
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  HERE="$(cd "$(dirname "$SELF")" && pwd)"
  if [ -f "$HERE/bin/assigent" ] && [ -d "$HERE/agents" ] && [ -f "$HERE/skill/assigent/SKILL.md" ]; then
    SRC="$HERE"
  fi
fi

if [ -z "$SRC" ]; then
  command -v curl >/dev/null 2>&1 || { echo "curl is needed to download Assigent." >&2; exit 1; }
  command -v tar >/dev/null 2>&1 || { echo "tar is needed to unpack Assigent." >&2; exit 1; }
  TMP="$(mktemp -d "${TMPDIR:-/tmp}/assigent.XXXXXX")"
  URL="https://codeload.github.com/$ASSIGENT_REPO/tar.gz/refs/heads/$ASSIGENT_BRANCH"
  say "Downloading Assigent from github.com/$ASSIGENT_REPO"
  curl -fsSL "$URL" -o "$TMP/assigent.tar.gz" || { echo "The download failed. Check your connection and try again." >&2; exit 1; }
  mkdir "$TMP/src"
  tar -xzf "$TMP/assigent.tar.gz" -C "$TMP/src" --strip-components=1
  SRC="$TMP/src"
  if [ ! -f "$SRC/bin/assigent" ] || [ ! -f "$SRC/skill/assigent/SKILL.md" ]; then
    echo "The download does not look like Assigent. Nothing was installed." >&2
    exit 1
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  say "Note: python3 was not found. Assigent needs Python 3; install it from python.org."
fi

backup() {
  # Move an existing file or folder out of the way, keeping it under ~/.assigent/backups/.
  local target="$1"
  if [ -e "$target" ] || [ -L "$target" ]; then
    mkdir -p "$BACKUP_DIR"
    local name
    name="$(basename "$target")"
    mv "$target" "$BACKUP_DIR/$name"
    say "Backed up your existing $name to $BACKUP_DIR/"
  fi
}

mkdir -p "$AGENTS_DIR" "$HOME/.claude/skills" "$BIN_DIR"

COUNT=0
for f in "$SRC"/agents/assigent-*.md; do
  COUNT=$((COUNT + 1))
  name="$(basename "$f")"
  backup "$AGENTS_DIR/$name"
  cp "$f" "$AGENTS_DIR/$name"
done
say "Installed $COUNT agents in $AGENTS_DIR"

backup "$SKILL_DIR"
mkdir -p "$SKILL_DIR"
cp -R "$SRC/skill/assigent/." "$SKILL_DIR/"
find "$SKILL_DIR" -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true
say "Installed the skill in $SKILL_DIR"

backup "$BIN_DIR/assigent"
cp "$SRC/bin/assigent" "$BIN_DIR/assigent"
chmod +x "$BIN_DIR/assigent"
say "Installed the command at $BIN_DIR/assigent"

say ""
case ":${PATH:-}:" in
  *":$BIN_DIR:"*) NEXT="assigent run" ;;
  *)
    say "Note: $BIN_DIR is not on your PATH, so the shell cannot find \"assigent\" yet."
    say "Add this line to your shell profile (~/.zshrc or ~/.bashrc), then open a new terminal:"
    say "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    say ""
    NEXT="$BIN_DIR/assigent run"
    ;;
esac

if ! command -v claude >/dev/null 2>&1; then
  say "Note: Claude Code was not found. Get it from https://claude.com/claude-code before you run Assigent."
  say ""
fi

say "Assigent is installed. There is nothing to set up."
say "It asks only what each assignment needs, when it needs it."
say "Next: $NEXT"
