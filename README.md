# Senpai

Claude Code skill: give it a URL, it captures every page (full-page screenshots per viewport, scroll frames + video, animation/motion inventory, element inventory, design tokens, all assets), builds a clone, and pixel-diffs the clone against the original until it matches.

## Install

**As a plugin (recommended)**
```
/plugin marketplace add <your-git-url-or-owner/repo>
/plugin install senpai@senpai
```
Run with `/senpai:senpai <url>`.

**As a plain skill**
```bash
git clone <your-git-url> /tmp/senpai
cp -r /tmp/senpai/skills/senpai ~/.claude/skills/senpai
```
Run with `/senpai <url>`.

Requires Node 20+. First run installs Playwright + Chromium into the skill folder.

## Modes
| mode | does |
|---|---|
| `scan` | capture only |
| `mirror` | capture + runnable static clone + verify loop |
| `rebuild` | capture + clean source (static / next / react / astro) + verify loop |
| `verify` | diff an existing clone (folder or `--clone-url`) against the capture |

Options: `pages=N` (default 30), viewports (default `1440x900,390x844`), diff threshold (default 2%).

## Scripts (usable without Claude)
```bash
cd skills/senpai && npm i && npx playwright install chromium
node scripts/capture.mjs --url=https://example.com --out=./senpai-example --pages=10
node scripts/verify.mjs  --out=./senpai-example            # serves ./senpai-example/clone
node scripts/verify.mjs  --out=./senpai-example --clone-url=http://localhost:3000
```

## Use responsibly
Exact mirroring is for sites you own or have permission to copy. For other sites, Senpai runs in study mode: layout, spacing and motion only, with placeholder text, images and branding. It honors robots.txt by default and refuses to clone login/payment pages for impersonation.
