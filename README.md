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

This runs the deterministic formatter tests, validates the skill boundary, and uses the installed `agent-browser` to capture and format this repository's local fixtures. Protected Vercel and real GitHub attachment checks are opt-in release probes; see `VERIFICATION.md`.

## Scope

This package deliberately does not wrap `agent-browser`, capture URLs, manage Vercel authentication, convert videos, or host media. Those capabilities belong to their source tools.
