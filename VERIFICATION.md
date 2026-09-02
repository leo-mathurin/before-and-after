# Verification

Each layer answers one question. The default suite is local and repeatable; the live layers mutate a dedicated fixture PR and restore it.

| Command | Question it answers | Needs |
|---|---|---|
| `pnpm test` | Does `format.mjs` emit the right markup and replace only the marked block? | nothing |
| `pnpm verify:skill` | Does the package ship only the skill, and do SKILL.md and `format.mjs` agree on every flag? | `npm` |
| `pnpm verify:local` | Does the installed `agent-browser` produce equal-height full-page pairs and a decodable recording, and are SKILL.md's claims about it still true? | `agent-browser`, optional `ffprobe` |
| `pnpm verify:github` | Does GitHub render what SKILL.md says it renders, and do the exact publish commands work on a real PR? | `gh` with write access, `agent-browser` |
| `pnpm verify:vercel` | Can a protected Preview be opened with the bundled Vercel skill's method? | `vercel` ≥ 53.3, `agent-browser` |
| `pnpm verify:agent` | Does a real agent following SKILL.md end up with a correct PR? | `claude`, `gh`, model spend |

`pnpm verify` runs the first three. `pnpm verify:live` runs the GitHub and Vercel probes. CI runs `pnpm verify` on every push and PR, and the GitHub probe on non-fork PRs and a weekly schedule so GitHub rendering drift is caught even when nothing changes here.

The GitHub probe in CI needs a `FIXTURE_GITHUB_TOKEN` repository secret holding a user PAT with `repo` scope. `gh --attach` uploads through an endpoint that rejects the Actions installation token (`unsupported authentication type`), so `GITHUB_TOKEN` cannot be used. Without the secret the job logs a notice and skips. Attachments and edits are attributed to the PAT's user.

## What each layer actually checks

### Local browser smoke

Follows the "Equal-height image pairs" steps from SKILL.md against a fixture server and asserts the two `--full` screenshots have identical pixel dimensions and extend past the viewport. Records a short clip and, when `ffprobe` is available, asserts it decodes to real frames and that SKILL.md's stated recorder cadence matches the observed frame rate. Also verifies SKILL.md's recording-context warning empirically: the fixture server records whether a custom header survives `record start`, and the run fails if headers are dropped while the warning is missing (or notes that the caveat may be stale if they are kept).

### Skill contract

Package boundary (`skill/scripts` contains only `format.mjs`, no `bin`, no runtime dependencies, `npm pack` publishes nothing outside `skill/`), delegation boundary (capture and Vercel auth go to `agent-browser`'s own skills), and a docs-to-CLI contract: every `--flag` shown in SKILL.md must exist in `format.mjs`, and every flag `format.mjs` accepts must be documented. It deliberately does not assert on sentences.

### GitHub smoke

Uses the permanent fixture PR (see below). Phase A posts two disposable comments with generated fixtures whose dimensions differ, then opens the rendered comment in a browser and asserts:

- every local reference was rewritten and each table cell shows the asset that was uploaded for it (catches swapped pairs);
- equal-height images share a top edge, and unequal-height images do not (this is the evidence for the padding guidance; if GitHub stops vertically centring cells, the run fails and tells you the guidance is obsolete);
- an own-line video renders as a player with controls.

Phase B runs the publish commands exactly as SKILL.md writes them against the fixture description: `gh pr edit --body-file --attach`, a second identical publish (block replaced in place, not duplicated or moved), then the two-step video table. Prose outside the marked block must be byte-identical after every step, and the rendered description's `<video>` must sit inside the table, show controls, and reach a playable ready state. The description is restored and the comments deleted in `finally`.

### Agent smoke

Everything above re-implements the skill's steps in JavaScript, which proves the tools compose but not that SKILL.md leads an agent to compose them. `verify:agent` runs Claude Code headlessly (`claude -p`, `--permission-mode dontAsk`) with two existing captures and the fixture PR number, and grades only the artifact: one marked block, labelled table, two uploaded assets, no local paths, prose untouched. Roughly 6 turns and under a minute. It is opt-in because it spends tokens.

## Fixture PR

`pnpm fixture:pr` finds or creates a draft PR from the `verification-fixture` branch on this repository and prints its number. It is idempotent and also restores the fixture description if a previous run was interrupted. Keep that PR open and never merge it; it exists so the live probes have a real description to edit without opening new PRs.

The repository requires signed commits, so the branch is created through local git (which applies your signing config), not the contents API. Run `pnpm fixture:pr` from a machine with a signing key if the branch ever needs recreating; CI only needs the PR to already exist.

```bash
VERIFY_GITHUB_MUTATION=1 pnpm verify:github
VERIFY_GITHUB_MUTATION=1 VERIFY_AGENT=1 pnpm verify:agent
```

Set `FIXTURE_REPO=owner/name` to point at a different repository. Set `KEEP_FIXTURE_COMMENT=1` to leave the disposable comments for inspection.

## Protected Vercel preview

```bash
VERCEL_PREVIEW_URL=https://example.vercel.app/exact-page-path \
VERCEL_PROJECT=before-and-after \
VERCEL_SCOPE=your-team \
VERCEL_EXPECT_TEXT="some text the page must contain" \
pnpm verify:vercel
```

Mints a development OIDC token with Vercel CLI, opens the exact route with the header prescribed by the installed `protected-vercel-deployments` skill, and fails if the final URL's origin differs from the deployment (any SSO or login redirect), if the route is a platform `404: NOT_FOUND`, or if the optional expected text is missing. The token is never printed or persisted.

## Coverage boundary

| Concern | Owner | Verification |
|---|---|---|
| Browser navigation, state, screenshots, recording | `agent-browser` | Local smoke |
| Protected Preview access | `agent-browser` Vercel skill | Vercel smoke |
| Formatting and marker replacement | This skill | Unit tests, contract |
| `gh --attach` rewriting and GitHub rendering | GitHub CLI + this skill's markup | GitHub smoke |
| Two-step video tables | This skill | GitHub smoke (Phase B) |
| An agent actually following SKILL.md | This skill | Agent smoke |
| Choosing persuasive evidence, PR placement | Future release | Scenario-based agent evals |

The suite tests the seams this skill owns. It does not duplicate the compatibility matrix of `agent-browser`, Vercel Deployment Protection, or GitHub CLI.
