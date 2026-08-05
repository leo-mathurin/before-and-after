# before-and-after

An agent skill that adds before and after screenshots — and video — to your PRs. The skill teaches your agent when and how to capture honest visual comparisons; a few bundled scripts handle the parts that must be deterministic (parity capture, video post-processing, output formatting).

![before-and-after](https://jm.sv/before-and-after/opengraph-image.png)

## Install

```bash
npx skills add vercel-labs/before-and-after
```

Or via npm (same contents, semver-pinnable — useful for baking into agent sandboxes):

```bash
npm i -g @vercel/before-and-after
```

Requires [agent-browser](https://agentbrowser.dev) (`npm i -g agent-browser && agent-browser install`) and `ffmpeg` for video.

## What the agent gets

- **A judgment guide** (`skill/SKILL.md`): choosing targets, resolving what "before" means, handling net-new pages (after-only "Preview" output), driving stateful UI with raw agent-browser before capturing, verifying captures before publishing, and getting through Vercel deployment protection.
- **`capture.mjs`** — parity engine: same viewport, wait conditions, and timing on both sides, across any number of viewports; `--record <seconds>` for video (mp4 + poster frame per side).
- **`format.mjs`** — the canonical PR block: side-by-side tables, poster-frame→mp4 video cells, attribution, idempotent marker comments.
- **`prewarm.mjs`** — idempotent browser warm-up so the first capture doesn't pay browser launch.
- **`upload.mjs`** — Vercel Blob uploads via `BLOB_READ_WRITE_TOKEN`, emitting the URL map `format.mjs` consumes.

## Quick taste

```bash
node skill/scripts/capture.mjs \
  --before vercel.com/pricing --after preview-abc.vercel.sh/pricing \
  --viewport desktop --viewport mobile --out ./captures
node skill/scripts/format.mjs --manifest ./captures/manifest.json --url-map urls.json
```

`before-and-after <before> <after>` still works as a frozen alias for `capture.mjs`. It will never grow another flag.

## Stability

The scripts are the skill's internal interface — they version with the SKILL.md and may change freely between releases. If you need something stable to build on, build on [agent-browser](https://agentbrowser.dev) directly; that's all these scripts do.
