---
name: senpai
description: Use when the user gives a website URL and wants it cloned, mirrored, replicated, rebuilt pixel-perfect, or studied page-by-page (layout, elements, animations, scroll motion, screenshots), or wants a clone visually verified against the original.
argument-hint: <url> [mode=scan|mirror|rebuild|verify] [stack=static|next|react|astro] [pages=N]
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*) Bash(npm --prefix ${CLAUDE_SKILL_DIR} *) Bash(npx --prefix ${CLAUDE_SKILL_DIR} *)
---

# Senpai: website clone + verify

Input: `$ARGUMENTS`. Scripts capture everything; Claude only reads summaries, diffs, crops.

## Output style (always)
- Terse. Fragments OK. No narration of tool calls, no recap tables, no pleasantries.
- Report = numbers + file paths + what's left. Code/commits written normally.
- Laziest complete fix: mirror before handwrite, reuse captured CSS/assets/tokens, touch only diff regions. No new deps beyond `package.json`.

## Step 0: gate (ask once, one AskUserQuestion call, skip anything already in args)
1. **Rights**: "Own site / client site with permission" vs "Someone else's site (study only)".
2. **Mode** (default `mirror` if rights, `rebuild` if study):
   | mode | does |
   |---|---|
   | `scan` | capture only, report |
   | `mirror` | capture + runnable static clone + verify loop |
   | `rebuild` | capture + clean source in chosen stack + verify loop |
   | `verify` | diff existing clone (dir or `--clone-url`) vs capture |
3. **Stack** (rebuild only): static (default) / next / react / astro.
4. **Scope**: page cap (default: whole site, no cap; only set one if user asks), viewports (default `1440x900,390x844`).

Rights rules (not negotiable):
- Study mode: never `mirror`; run capture with `--mirror=0`. Rebuild layout, spacing, motion, structure only. Replace all copy, images, logos, brand names, icons with original placeholders. Output is a design-study scaffold, not a copy.
- Any mode: never clone login, checkout, payment, or account pages of a brand the user isn't, never keep forms posting to the original backend, never deploy a copy under a lookalike domain. Refuse if purpose is impersonation/phishing.
- robots.txt honored by default; `--ignore-robots=1` only for the user's own site.

## Step 1: setup (once)
```bash
test -d ${CLAUDE_SKILL_DIR}/node_modules || npm --prefix ${CLAUDE_SKILL_DIR} i --silent
npx --prefix ${CLAUDE_SKILL_DIR} playwright install chromium
```

## Step 2: capture
```bash
node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs --url=<url> --out=./senpai-<host> [--pages=N] [--mirror=0] [--viewports=..] [--frames=6] [--video=1] [--delay=500]
```
Writes `<out>/`:
- `manifest.json`: pages, skipped (+why), queued-not-visited, design tokens (top colors/fonts/sizes/radii/shadows). **Read this first, only this.**
- `pages/<slug>/`: `<width>.png` full-page, `frame-NN.png` scroll frames, `scroll.webm` scroll video, `motion.json` (libs, @keyframes, running animations, transitions, sticky count), `elements.json` (≤1500 visible elements: selector, rect, text, font, colors, radius, image), `source.html` rendered DOM.
- `assets/`: every CSS/JS/font/image/media/same-origin JSON fetched.
- `clone/` (mirror on): static site, assets rewritten local.

Token rules: never `cat` `source.html` or `elements.json` whole. Query: `node -e` / `grep` for one section. View screenshots as crops (Python PIL is available) not full-length images.

`queuedNotVisited > 0`: tell user, offer raise `--pages`.

## Step 3: motion + interaction (things a scroll capture misses)
From `motion.json` `libs` + frames, list per page: entrance reveals, scroll-linked (GSAP ScrollTrigger/Lenis), carousels, hover/focus states, menus, modals, cursor effects, video/canvas/WebGL.
Hover/click/menu/modal states: use Claude in Chrome (load `claude-in-chrome` skill) or Playwright MCP: hover each nav item/button/card, open menus, screenshot, record `gif_creator` for motion worth matching. Capture only what `motion.json` + frames don't already show.

## Step 4: build
- **mirror**: `clone/` is the result. View: `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs --dir=<out>/clone` (not `npx serve`: cache-busted assets 404). Go to verify.
- **rebuild**: one component/section per visual block in `elements.json`. Tokens from `manifest.tokens` into CSS vars/theme. Copy captured assets from `assets/` (rights only). Recreate motion with the same lib `motion.json` detected; match durations/easing from `anims`/`transitions`. Serve with stack dev server.

## Step 5: verify loop
```bash
node ${CLAUDE_SKILL_DIR}/scripts/verify.mjs --out=<out> [--clone-url=http://localhost:3000] [--threshold=2] [--only=slug,slug]
```
Prints per page@viewport diff %, height change. Writes `verify/<slug>@<w>.clone.png`, `.diff.png` (red = mismatch), `report.json` (worst first).

Loop: worst page, find first red band in diff, crop same region from original + clone, fix cause, re-run `--only=<slug>`. Stop when all ≤ threshold, or 3 tries on a page, then report remaining cause.

| Diff symptom | Usual cause | Fix |
|---|---|---|
| whole page unstyled | CSS 404 (origin/redirect, missing `_ext` host) | check network 404s on clone, add asset |
| fonts differ | font from CDN not captured / CORS | copy font file, fix `@font-face` url |
| height shift + carousel | slider init state, autoplay, arrows | same start slide, autoplay off both sides |
| blank sections | hydration/JS error, API JSON missing | check console; save JSON or freeze DOM (remove failing script) |
| text diff | dates, counters, random/rotating content | expected; note it, mask not fix |
| top/bottom bars | cookie banner, chat widget | expected; note it |

## Step 6: report (terse)
`pages N | within X%: a/b | worst: slug@w Y% (cause) | skipped: n (why) | out: <path>` + next action if any.

## Common mistakes
- Reading raw HTML into context instead of manifest + crops: burns tokens.
- Hand-rewriting a page before trying the mirror.
- Comparing while animations mid-flight: scripts disable animations and scroll-settle both sides; keep it that way.
- Running against apex domain that redirects: script follows the redirect; check `manifest.url`.
