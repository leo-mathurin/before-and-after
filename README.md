# before-and-after

An agent skill that attaches existing screenshots and screen recordings to a GitHub pull request as a before/after block.

Browser work belongs to [agent-browser](https://agentbrowser.dev) and its bundled skills. Expo work on iOS Simulators and Android Emulators belongs to [Argent](https://argent.swmansion.com). Uploads belong to `gh --attach`. This skill owns the workflow between those tools and one dependency-free script that formats media and replaces a marked block in the PR body.

![before-and-after](https://jm.sv/before-and-after/opengraph-image.png)

## Install

```bash
bunx skills add leo-mathurin/before-and-after#main --global --agent codex claude-code --yes
```

Requires GitHub CLI 2.99+ for `gh --attach`. Browser capture requires `agent-browser`. Expo capture on iOS or Android requires Argent in the Expo project.

## What it produces

- Side-by-side image tables for before/after pairs, with equal-height full-page captures so tops align.
- `Preview` blocks for after-only media.
- Own-line videos that GitHub renders as players, and a two-step HTML video table once attachment URLs exist.
- Idempotent replacement of one `<!-- before-and-after:start/end -->` block; the rest of the PR description is untouched.
- Placement guidance that keeps real visual proof near the top and ahead of clearly labeled supplemental demos.

See `skill/SKILL.md` for the workflow.

## Verification

Each layer answers one question. Details in `VERIFICATION.md`.

| Command | Runs | Proves | Needs |
|---|---|---|---|
| `pnpm test` | CI, every PR | `format.mjs` markup and marker replacement, including error paths | nothing |
| `pnpm verify:skill` | CI, every PR | package ships the capture references and only `skill/`; every `--flag` in SKILL.md exists in `format.mjs` and vice versa | `npm` |
| `pnpm verify:local` | CI, every PR | with the installed agent-browser: the padding recipe yields equal-height pairs, the recorder produces real frames at the stated fps, `record start` drops headers as SKILL.md warns | `agent-browser`, `ffprobe` |
| `pnpm verify:github` | CI weekly and on non-fork PRs once `FIXTURE_GITHUB_TOKEN` is set; local otherwise | GitHub renders what SKILL.md claims (cell mapping, top alignment, playable video) and the exact `gh pr edit --attach` publish sequence works, twice, preserving prose | `gh`, `agent-browser`, fixture PR |
| `pnpm verify:agent` | local, before releases | Claude Code following SKILL.md unassisted produces a correct PR | `claude`, ~$2 |

`pnpm verify` runs the first three.

## Scope

Does not wrap `agent-browser` or Argent, capture URLs, manage Vercel authentication, convert video, or host media.
