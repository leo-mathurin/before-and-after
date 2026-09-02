# Verification

The matrix lives in `README.md`. This file says what each layer actually checks and how to run the live ones.

## Local browser smoke

Follows SKILL.md's "Equal-height image pairs" steps against a fixture server and asserts both `--full` screenshots have identical dimensions and extend past the viewport. Records a clip and, with `ffprobe` present, asserts it decodes to real frames and that the observed fps matches the number SKILL.md states. The fixture server also records whether a custom header survives `record start`; the run fails if headers are dropped while SKILL.md's fresh-context warning is missing, and notes when the warning may be stale.

## Skill contract

Package boundary (`skill/scripts` is only `format.mjs`, no `bin`, no dependencies, `npm pack` publishes nothing outside `skill/`), delegation boundary (capture and Vercel auth go to agent-browser's skills), and a docs-to-CLI contract in both directions. No sentence asserts.

## GitHub smoke

```bash
VERIFY_GITHUB_MUTATION=1 pnpm verify:github
```

Uses the permanent fixture PR. Phase A posts two disposable comments with generated fixtures whose dimensions differ, opens the rendered comment in a browser, and asserts every local reference was rewritten, each cell shows the asset uploaded for it, equal-height images share a top edge, unequal-height images do not (the evidence for the padding guidance; if GitHub stops centring cells this fails and says so), and an own-line video renders a player.

Phase B runs the publish commands exactly as SKILL.md writes them against the fixture description: `gh pr edit --body-file --attach`, a second identical publish (block replaced in place, not duplicated or moved), then the two-step video table. Prose outside the markers must be byte-identical after every step, and the rendered `<video>` must sit inside the table with controls and a playable ready state. Description restored and comments deleted in `finally`. `KEEP_FIXTURE_COMMENT=1` keeps the comments for inspection.

In CI this needs a `FIXTURE_GITHUB_TOKEN` secret holding a user PAT with `repo` scope: `gh --attach` uploads through an endpoint that rejects the Actions token (`unsupported authentication type`). Without it the job logs a notice and skips.

## Agent smoke

```bash
VERIFY_GITHUB_MUTATION=1 VERIFY_AGENT=1 pnpm verify:agent
```

Everything else re-implements the skill's steps in JavaScript. This runs Claude Code headlessly (`claude -p`, `--permission-mode dontAsk`) with two existing captures and the fixture PR number, then grades only the artifact: one marked block, labelled table, two uploaded assets, no local paths, prose untouched. About 6 turns and under a minute.

## Fixture PR

```bash
pnpm fixture:pr
```

Finds or creates a draft PR from the `verification-fixture` branch and prints its number; idempotent, and restores the description if a run was interrupted. Keep it open, never merge it. The repo requires signed commits, so the branch is created through local git; CI only needs the PR to exist. `FIXTURE_REPO=owner/name` points at another repository.

## Boundary

Tests the seams this skill owns. Does not duplicate agent-browser, Vercel Deployment Protection, or GitHub CLI coverage. Choosing persuasive evidence and PR placement (SPEC release 3) will need scenario-based agent evals, not more scripts.
