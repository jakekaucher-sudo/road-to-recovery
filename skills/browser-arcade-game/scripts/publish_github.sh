#!/bin/bash
# Publish (or update) The Road to Recovery on GitHub Pages.
#   bash game/tools/publish_github.sh            first time: sign in, create the repo, turn on Pages
#   bash game/tools/publish_github.sh "message"  later: rebuild, commit and push your changes
# Uses the official GitHub CLI, downloaded into .tools/ (checksum verified) if it is not installed.
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO_NAME="${REPO_NAME:-road-to-recovery}"
GH_VERSION="2.102.0"

# ---- GitHub CLI
if command -v gh >/dev/null 2>&1; then GH=gh; else
  GH=".tools/gh/bin/gh"
  if [ ! -x "$GH" ]; then
    arch=$(uname -m); [ "$arch" = "x86_64" ] && arch=amd64
    zip="gh_${GH_VERSION}_macOS_${arch}.zip"; base="https://github.com/cli/cli/releases/download/v${GH_VERSION}"
    echo "Downloading the GitHub CLI ${GH_VERSION} from github.com/cli/cli ..."
    mkdir -p .tools && cd .tools
    curl -fsSLO "$base/$zip" && curl -fsSLO "$base/gh_${GH_VERSION}_checksums.txt"
    grep " $zip\$" "gh_${GH_VERSION}_checksums.txt" | shasum -a 256 -c - || { echo "Checksum did not match. Stopping."; exit 1; }
    unzip -q -o "$zip" && rm -rf gh && mv "${zip%.zip}" gh && rm -f "$zip" "gh_${GH_VERSION}_checksums.txt"
    cd ..
  fi
fi
"$GH" --version | head -1

# ---- sign in (opens github.com in the browser; you approve it there)
if ! "$GH" auth status >/dev/null 2>&1; then
  echo; echo "Sign in to GitHub: press Enter, then approve in the browser with the code shown."
  "$GH" auth login --hostname github.com --git-protocol https --web
fi
"$GH" auth setup-git >/dev/null
LOGIN=$("$GH" api user -q .login)

# ---- rebuild the playable copy and commit
python3 game/tools/build_artifact.py --web
git add -A
git -c user.name="$LOGIN" -c user.email="$("$GH" api user -q .id)+$LOGIN@users.noreply.github.com" commit -q -m "${1:-Update the game}" || echo "(nothing new to commit)"

# ---- create the repo the first time, then push
if ! git remote get-url origin >/dev/null 2>&1; then
  if "$GH" repo view "$LOGIN/$REPO_NAME" >/dev/null 2>&1; then
    git remote add origin "https://github.com/$LOGIN/$REPO_NAME.git"      # repo already exists (e.g. a copied folder)
    git pull --rebase -q origin main || true
    git push -u origin main
  else
    "$GH" repo create "$REPO_NAME" --public --source . --remote origin --description "The Road to Recovery: an SBA Disaster Recovery driving game for browsers and phones" --push
  fi
else
  git push -u origin main
fi

# ---- GitHub Pages from main /docs (first time only)
if ! "$GH" api "repos/$LOGIN/$REPO_NAME/pages" >/dev/null 2>&1; then
  "$GH" api -X POST "repos/$LOGIN/$REPO_NAME/pages" -f "source[branch]=main" -f "source[path]=/docs" >/dev/null && echo "GitHub Pages turned on."
fi
URL=$("$GH" api "repos/$LOGIN/$REPO_NAME/pages" -q .html_url 2>/dev/null || echo "https://$LOGIN.github.io/$REPO_NAME/")
echo
echo "Play the game:      $URL"
echo "Source on GitHub:   https://github.com/$LOGIN/$REPO_NAME"
echo "(A new Pages site can take a minute or two to appear the first time.)"
