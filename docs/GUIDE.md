# Senpai Guide

## Use

```
/senpai <url>
```
That's the only command. (Plugin install: `/senpai:senpai <url>`.)

1. Senpai asks once whether the site is yours / you have permission.
2. It captures every page, builds the clone, pixel-checks it, and starts a server.
3. You get a link: `http://localhost:4173`. Open it.

Optional: `pages=N` to limit pages (default: whole site).

The server keeps running in the background. Stop it by closing Claude Code or `pkill -f clone.mjs`.

## What you get

`./senpai-<host>/`

| Path | Contents |
|---|---|
| `clone/` | The clone (static site) |
| `pages/<slug>/1440.png`, `390.png` | Original full-page screenshots, desktop + mobile |
| `pages/<slug>/frame-*.png`, `scroll.webm` | Scroll frames + video |
| `pages/<slug>/motion.json` | Animation libraries, keyframes, transitions |
| `pages/<slug>/elements.json` | Visible elements: position, text, font, colors |
| `verify/report.json` | Diff % per page (desktop + mobile) |
| `verify/*.diff.png` | Red = where the clone differs |
| `manifest.json` | Page list, skipped pages, design tokens |

## Run without Claude

```bash
node ~/.claude/skills/senpai/scripts/clone.mjs https://www.mysite.com
```
Flags: `--pages=5`, `--port=4174`, `--out=DIR`, `--ignore-robots=1` (your own site only).

View an existing clone again:
```bash
node ~/.claude/skills/senpai/scripts/serve.mjs --dir=./senpai-www.mysite.com/clone
```
Use this, not `npx serve`: sites that add `?rnd=` / `?v=` to script URLs break on generic servers.

## Test it

1. `/senpai https://example.com pages=1` → link opens, shows Example Domain.
2. `/senpai https://<your-site>` → link opens your site's clone; status line shows `x/y within 2%`.
3. Someone else's site → answer "someone else's" → no exact copy; placeholder study instead.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing cloned, `robots.txt` | Site blocks crawlers. Your own site: tell Senpai it's yours, it re-runs with `--ignore-robots=1`. |
| Port 4173 busy | Handled: next free port (4174, 4175, ...) is used; the link shows which. |
| `HTTP 403` / challenge page | Site blocks bots. Senpai stops; no bypass. |
| Browser missing / Linux libs | `npx --prefix ~/.claude/skills/senpai playwright install --with-deps chromium` |
| Some pages over 2% | Server still runs. Ask Senpai "fix the remaining diffs". |
| Forms don't submit | Expected: a static clone has no backend. |
