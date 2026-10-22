---
name: senpai
description: Use when the user gives a website URL and wants it cloned, mirrored, replicated, copied pixel-perfect and served locally, or wants a clone visually verified against the original.
argument-hint: <url>
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)
---

# Senpai: one command, URL to running clone

Input: `$ARGUMENTS` (a URL; optional `pages=N`).

Output style: terse. No narration, no tables, no recap. Final message = link + one status line.

## Flow
1. **Rights (one click, skip if user already said it's theirs this session).** AskUserQuestion: "Own site / have permission" vs "Someone else's". Someone else's: go to *Study mode* below, stop here.
2. **Run** with Bash `run_in_background: true`, from the user's current directory:
   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/clone.mjs <url> [--pages=N]
   ```
   Installs deps on first run, captures every page, builds the clone, pixel-checks it, then serves it. It keeps running (that's the server).
3. **Wait for the `SERVING http://localhost:PORT` line** (Monitor/until-loop on the output file, not sleep). If the process exits first, read the last lines and report the error.
4. **Reply:**
   ```
   Clone running: http://localhost:4173
   <N> pages | <a>/<b> within 2% | folder: ./senpai-<host>
   ```
   Add one line only if something needs the user (pages over 2%, skipped pages).

## If it fails
| Output | Do |
|---|---|
| `skipped ... robots.txt` | Site blocks crawlers. If user said it's their own site, re-run with `--ignore-robots=1`. Otherwise stop, tell them. |
| `EADDRINUSE` | Re-run with `--port=4174`. |
| `HTTP 403` / challenge page | Site blocks bots. Stop, tell user. Never bypass. |
| pages over 2% | Server still runs. Offer: "fix the remaining diffs?" If yes: crop `<out>/verify/<slug>@<w>.diff.png` red areas vs `<out>/pages/<slug>/<w>.png` (PIL, crops only), fix in `<out>/clone`, re-check with `node ${CLAUDE_SKILL_DIR}/scripts/verify.mjs --out=<out> --only=<slug>`. Max 3 tries per page. |

## Study mode (someone else's site)
Never mirror their content. Capture for reference only, then rebuild layout, spacing and motion with placeholder text, images and logos:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --url=<url> --out=./senpai-<host> --mirror=0
```
Read `manifest.json` (tokens, libs) and screenshot crops only; never cat `source.html` / `elements.json` whole. Build static HTML in `./senpai-<host>/study/`, serve with `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs --dir=./senpai-<host>/study` in background, give the link.

## Never
Clone login, checkout or payment pages of a brand the user isn't; keep forms posting to the original site; deploy a copy on a lookalike domain.
