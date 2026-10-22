# Senpai

Claude Code skill: give it a URL, it captures every page (full-page screenshots per viewport, scroll frames + video, animation/motion inventory, element inventory, design tokens, all assets), builds a clone, and pixel-diffs the clone against the original until it matches.

**Full guide with examples, options, testing, and troubleshooting: [docs/GUIDE.md](docs/GUIDE.md)**

## Install

Inside Claude Code:
```
/plugin marketplace add MihirKT/senpai
/plugin install senpai@senpai
```

Or as a plain skill:
```bash
git clone https://github.com/MihirKT/senpai /tmp/senpai
cp -r /tmp/senpai/skills/senpai ~/.claude/skills/senpai
```

Requires Node 20+. First run installs Playwright + Chromium into the skill folder.

## Commands

| Command | Does |
|---|---|
| `/senpai:senpai <url>` | Full skill; asks what you want |
| `/senpai:scan <url>` | Capture only |
| `/senpai:mirror <url>` | Exact static copy + verify loop (own/permitted sites) |
| `/senpai:rebuild <url> stack=next` | Clean rewrite (static / next / react / astro) + verify loop |
| `/senpai:verify <out-folder>` | Diff an existing clone against the capture |

```
/senpai:mirror https://www.mysite.com pages=5
/senpai:rebuild https://client.com stack=next pages=10
/senpai:scan https://www.mysite.com viewports=1920x1080,390x844
/senpai:verify ./senpai-www.mysite.com clone-url=http://localhost:3000
```

Plain language works too: *"clone https://mysite.com with senpai, 3 pages, mobile only"*.

## Output

`./senpai-<host>/`: `manifest.json` (pages + design tokens), `pages/<slug>/` (screenshots, scroll frames, video, `motion.json`, `elements.json`, DOM), `assets/`, `clone/`, `verify/` (diff images + `report.json`). Details in the [guide](docs/GUIDE.md#6-output-folder).

## Scripts without Claude
```bash
cd skills/senpai && npm i && npx playwright install chromium
node scripts/capture.mjs --url=https://example.com --out=./senpai-example --pages=10
node scripts/verify.mjs  --out=./senpai-example
```

## Use responsibly
Exact mirroring is for sites you own or have permission to copy. For other sites Senpai runs in study mode: layout, spacing and motion only, with placeholder text, images and branding. It honors robots.txt by default, does not bypass bot protection, and refuses to clone login/payment pages for impersonation.

## License
MIT © Mihir Tiwari
