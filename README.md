# Senpai

One command: give Claude Code a URL, get a running local clone.

```
/senpai https://www.mysite.com
```

Senpai captures every page (screenshots, scroll motion, animations, all assets), builds a static clone, pixel-checks it against the live site, and starts a local server:

```
Clone running: http://localhost:4173
2 pages | 4/4 within 2% | folder: ./senpai-www.mysite.com
```

Open the link. Done.

## Install

Plain skill, command is `/senpai`:
```bash
git clone https://github.com/MihirKT/senpai /tmp/senpai
cp -r /tmp/senpai/skills/senpai ~/.claude/skills/senpai
```

Or as a plugin, command is `/senpai:senpai`:
```
/plugin marketplace add MihirKT/senpai
/plugin install senpai@senpai
```

Needs Node 20+. First run installs Playwright + Chromium automatically.

## Options (optional)
```
/senpai https://www.mysite.com pages=5
```
No `pages` = whole site.

## Without Claude
```bash
node ~/.claude/skills/senpai/scripts/clone.mjs https://www.mysite.com
```
Same result: captures, clones, checks, serves at http://localhost:4173. `--port=4174`, `--pages=5`, `--out=DIR` available.

More: [docs/GUIDE.md](docs/GUIDE.md).

## Use responsibly
Exact clones are for sites you own or have permission to copy. For other sites Senpai only builds a layout/motion study with placeholder text, images and branding. It honors robots.txt by default, does not bypass bot protection, and never clones login or payment pages.

## License
MIT © Mihir Tiwari
