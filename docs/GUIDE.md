# Senpai Guide

Everything you need to install, run, test, and troubleshoot Senpai.

- [1. Install](#1-install)
- [2. Commands](#2-commands)
- [3. Quick start](#3-quick-start)
- [4. Examples](#4-examples)
- [5. What it asks you](#5-what-it-asks-you)
- [6. Output folder](#6-output-folder)
- [7. Verify loop](#7-verify-loop)
- [8. Options](#8-options)
- [9. Using the scripts without Claude](#9-using-the-scripts-without-claude)
- [10. Test that it works](#10-test-that-it-works)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Rules](#12-rules)

## 1. Install

Needs: Claude Code, Node 20+, ~200 MB disk for Chromium.

**Plugin (recommended)**, inside Claude Code:
```
/plugin marketplace add MihirKT/senpai
/plugin install senpai@senpai
```
Restart Claude Code (or run `/reload-plugins`) if the commands don't show up.

**Plain skill** (no plugin, no `/senpai:` prefix):
```bash
git clone https://github.com/MihirKT/senpai /tmp/senpai
cp -r /tmp/senpai/skills/senpai ~/.claude/skills/senpai
```

First run installs Playwright + Chromium into the skill folder automatically.

**Update:** `/plugin marketplace update senpai`, then `/plugin install senpai@senpai`.
**Remove:** `/plugin uninstall senpai@senpai`.

## 2. Commands

| Command | What it does |
|---|---|
| `/senpai:senpai <url>` | Full skill. Asks what you want, then runs. |
| `/senpai:scan <url>` | Capture only: screenshots, scroll frames + video, motion, elements, tokens, assets. No clone. |
| `/senpai:mirror <url>` | Exact static copy + pixel-verify loop. Own/permitted sites only. |
| `/senpai:rebuild <url> stack=next` | Clean rewrite in static / next / react / astro + pixel-verify loop. |
| `/senpai:verify <out-folder>` | Diff an existing clone against the capture. |

Plain-skill install: use `/senpai <url>` (mode commands are plugin-only; just say the mode, e.g. `/senpai https://x.com mode=scan`).

You can also skip commands and just say: *"clone https://mysite.com with senpai"*.

## 3. Quick start

```
/senpai:mirror https://www.mysite.com pages=5
```
1. Senpai asks if you own the site (pick "Own site").
2. Captures 5 pages to `./senpai-www.mysite.com/`.
3. Builds `clone/`, screenshots it, diffs against the original.
4. Fixes the worst page, re-checks, repeats.
5. Prints one line: pages, how many match, worst page, where output is.

Open the clone yourself:
```bash
npx serve ./senpai-www.mysite.com/clone
```

## 4. Examples

**Your own site, exact copy, all pages**
```
/senpai:mirror https://www.mysite.com pages=100
```

**Client site rebuilt in Next.js**
```
/senpai:rebuild https://client.com stack=next pages=10
```
Senpai scaffolds a Next app, copies captured assets, turns colors/fonts into theme tokens, recreates animations with the same library the site uses (GSAP, Lenis, Swiper, ...), runs the dev server, and diffs `http://localhost:3000` against the original.

**Study a site you don't own (layout + motion only)**
```
/senpai:rebuild https://some-agency.com stack=static
```
Pick "Someone else's site". Senpai rebuilds structure, spacing, and animation timing with placeholder text, images, and logos.

**Only capture, for design reference**
```
/senpai:scan https://www.mysite.com pages=20 viewports=1920x1080,768x1024,390x844
```

**Check your own rebuild (running on localhost) against the capture**
```
/senpai:verify ./senpai-www.mysite.com clone-url=http://localhost:3000
```

**Re-check only two pages**
```
/senpai:verify ./senpai-www.mysite.com only=index,about
```

**Plain language works too**
- "use senpai on https://mysite.com, mobile only, 3 pages"
- "senpai scan https://mysite.com and tell me which animation libraries it uses"
- "rebuild the pricing page of https://mysite.com in React with senpai"

## 5. What it asks you

One question block at the start, skipping anything you already passed:

1. **Rights**: own/permitted site, or someone else's (study only).
2. **Mode**: scan / mirror / rebuild / verify.
3. **Stack** (rebuild only): static / next / react / astro.
4. **Scope**: max pages, viewports.

Pass everything up front to skip the questions:
```
/senpai:rebuild https://mysite.com stack=astro pages=8 (my own site)
```

## 6. Output folder

`./senpai-<host>/`

| Path | Contents |
|---|---|
| `manifest.json` | Page list, skipped pages + reason, pages found but not visited, design tokens (top colors, fonts, sizes, radii, shadows) |
| `pages/<slug>/1440.png`, `390.png` | Full-page screenshot per viewport |
| `pages/<slug>/frame-01..06.png` | Viewport frames while scrolling |
| `pages/<slug>/scroll.webm` | Scroll video |
| `pages/<slug>/motion.json` | Animation libraries detected, `@keyframes`, running animations (duration/easing/delay), transitions, sticky/fixed count |
| `pages/<slug>/elements.json` | Up to 1500 visible elements: selector, position, text, font, colors, radius, image |
| `pages/<slug>/source.html` | Rendered DOM |
| `assets/` | Every CSS, JS, font, image, video, same-origin JSON loaded |
| `clone/` | Runnable static clone (mirror mode) |
| `verify/report.json` | Diff % per page per viewport, worst first |
| `verify/<slug>@<w>.diff.png` | Red = mismatch |
| `verify/<slug>@<w>.clone.png` | Clone screenshot |

Slug: `/` → `index`, `/about/team` → `about_team`.

## 7. Verify loop

Both original and clone are shot the same way: page load, fonts ready, scroll to bottom (triggers lazy images and scroll reveals), back to top, animations frozen, full-page screenshot.

Senpai then:
1. Takes the worst page.
2. Finds the first red band in the diff.
3. Crops that area from both screenshots and compares.
4. Fixes the cause.
5. Re-runs only that page.
6. Stops at threshold (default 2%) or after 3 tries per page, and reports what's left and why.

Expected differences (reported, not "fixed"): dates, counters, random/rotating content, cookie banners, chat widgets.

## 8. Options

Pass in the command (`pages=10`) or ask in plain words.

| Option | Default | Meaning |
|---|---|---|
| `pages` | 30 | Max pages crawled (same domain, follows links) |
| `viewports` | `1440x900,390x844` | Comma list `WxH` |
| `threshold` | 2 | Max diff % that counts as a match |
| `stack` | static | rebuild target: static / next / react / astro |
| `frames` | 6 | Scroll frames per page (0 = none) |
| `video` | 1 | Scroll video per page (0 = off) |
| `delay` | 500 | ms between pages (politeness) |
| `ignore-robots` | 0 | 1 = ignore robots.txt (own site only) |
| `clone-url` | – | verify against a running server instead of `clone/` |
| `only` | – | verify only these slugs |

## 9. Using the scripts without Claude

```bash
cd skills/senpai            # or ~/.claude/skills/senpai
npm i
npx playwright install chromium

# capture 10 pages + build static clone
node scripts/capture.mjs --url=https://www.mysite.com --out=./senpai-mysite --pages=10

# capture only, no clone, desktop + tablet
node scripts/capture.mjs --url=https://www.mysite.com --out=./senpai-mysite --mirror=0 --viewports=1440x900,768x1024

# diff clone/ against capture (built-in static server)
node scripts/verify.mjs --out=./senpai-mysite

# diff a dev server
node scripts/verify.mjs --out=./senpai-mysite --clone-url=http://localhost:3000 --threshold=1

# one page
node scripts/verify.mjs --out=./senpai-mysite --only=index
```
`verify.mjs` exits 1 if any page is over threshold, so it works in CI.

## 10. Test that it works

Run these in order. Each has an expected result.

1. **Install check**: `/plugin` → `senpai` listed as installed. Typing `/senpai:` shows `senpai`, `scan`, `mirror`, `rebuild`, `verify`.
2. **Small scan**: `/senpai:scan https://example.com pages=1`
   Expect `senpai-example.com/manifest.json` with 1 page, and `pages/index/1440.png` + `390.png`.
3. **Mirror your own site**: `/senpai:mirror https://<your-site> pages=3`
   Expect `clone/` and a final line like `pages 3 | within 2%: 4/6 | worst: ...`.
   Open it: `npx serve ./senpai-<host>/clone`.
4. **Look at a diff**: open `verify/index@1440.diff.png`. Red areas are mismatches.
5. **Study-mode guard**: `/senpai:mirror https://<site you don't own>` and answer "someone else's". Expect it to refuse `mirror` and offer a placeholder rebuild.
6. **Scripts alone**: section 9 commands give `ok index` lines and a `pages N | ...` summary.

Tested by the author: `https://birajtech.com`, 3 pages, mirror mode. One page 0% diff on both viewports; two pages 5–8% (testimonial slider renders arrows differently). The fix loop then works on that.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `Executable doesn't exist` / browser missing | `npx --prefix <skill-dir> playwright install chromium` |
| Linux: missing shared libraries | `npx --prefix <skill-dir> playwright install-deps chromium` (needs sudo) |
| Only 1 page captured | Site is single-page, links are JS-only (no `<a href>`), or robots.txt blocks. Check `manifest.skipped` |
| `queuedNotVisited > 0` | More pages exist. Raise `pages=` |
| Clone unstyled | CSS 404. Check `assets/`; re-run capture. Apex → www redirects are handled automatically |
| Blank sections in clone | Site loads content from an API or JS errors. Senpai checks the console; may save the JSON or freeze the DOM |
| Fonts look different | Font file blocked by CORS or not loaded. Senpai copies it and fixes `@font-face` |
| `HTTP 403` / challenge page | Site blocks bots. Senpai stops; it does not bypass protection |
| Heavy sites slow | Lower `pages`, set `video=0 frames=0` |
| Command not found after install | `/reload-plugins` or restart Claude Code |

## 12. Rules

- Exact copy (`mirror`, real text/images) only for sites you own or have permission to copy.
- Other sites: study mode, placeholders for all text, images, logos, brand names.
- Never clones login, checkout, or payment pages of another brand, never keeps forms posting to the original site, never builds lookalike-domain copies.
- robots.txt honored by default.
