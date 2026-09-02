# before-and-after

An agent skill for attaching existing screenshots and screen recordings to GitHub pull request descriptions.

The skill delegates browser navigation, authentication, screenshots, and recordings to the version-matched skills bundled with [agent-browser](https://agentbrowser.dev). Its only script formats local media for `gh --attach` and safely replaces a marked block in the PR body.

![before-and-after](https://jm.sv/before-and-after/opengraph-image.png)

## Install

```bash
npx skills add vercel-labs/before-and-after
```

Requirements:

- `agent-browser` for producing media;
- GitHub CLI 2.99 or newer for `gh --attach`.

## What it adds

- Side-by-side image tables for before/after pairs.
- `Preview` output for after-only media.
- Own-line video attachments that GitHub renders as inline players.
- Repeatable labels for multiple captures.
- Idempotent marker replacement that preserves the rest of the PR description.
- Exact local attachment paths for `gh pr edit --attach`.

## Example

After capturing files with `agent-browser`:

```bash
node skill/scripts/format.mjs \
  --before captures/before.png \
  --after captures/after.png \
  > /tmp/block.md

node skill/scripts/format.mjs \
  --attach-list \
  --before captures/before.png \
  --after captures/after.png
```

See `skill/SKILL.md` for the complete PR publishing workflow.

## Verification

```bash
pnpm verify
```

This runs the formatter unit tests, the skill/package contract, and a local `agent-browser` smoke. `pnpm verify:github` publishes to a permanent fixture PR and checks the rendered result in a browser; `pnpm verify:agent` runs Claude Code against SKILL.md headlessly and grades the resulting PR. See `VERIFICATION.md` for what each layer proves.

## Scope

This package deliberately does not wrap `agent-browser`, capture URLs, manage Vercel authentication, convert videos, or host media. Those capabilities belong to their source tools.
