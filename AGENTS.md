# AGENTS.md

before-and-after is an agent skill that attaches screenshots and recordings to GitHub PR descriptions. Browser work belongs to `agent-browser`; iOS and Android simulator work belongs to Argent; uploads belong to `gh --attach`. This repo owns `skill/SKILL.md`, capture-backend references, one formatter script, and the verification that proves they work.

```text
skill/SKILL.md             the product
skill/references/          capture-backend workflows
skill/scripts/format.mjs   the only shipped script (node builtins only)
tests/unit/                formatter invariants
tests/verification/        contract, browser, GitHub, and agent smokes (see VERIFICATION.md)
site/                      jm.sv/before-and-after
```

## Rules

1. Do not add browser or simulator automation, Vercel authentication, capture, recording, video conversion, or media hosting. Delegate browser work to `agent-browser` and iOS or Android simulator work to Argent.
2. `skill/scripts/` stays dependency-free and single-file.
3. Formatter flags version with `SKILL.md`. Update both; `pnpm verify:skill` enforces it. No compatibility shims.
4. Images may use tables. Local videos stay on their own lines; video tables only take final `user-attachments` URLs.
5. Never touch PR prose outside `<!-- before-and-after:start/end -->`.
6. Verify behaviour, not wording. A claim about GitHub, agent-browser, or Argent belongs in a smoke that would fail if it stopped being true.
7. Keep the fixture PR (`verification-fixture` branch) open. Never merge it.

## Commands

```bash
pnpm verify                                     # unit + contract + local browser smoke
VERIFY_GITHUB_MUTATION=1 pnpm verify:github     # live, against the fixture PR
VERIFY_GITHUB_MUTATION=1 VERIFY_AGENT=1 pnpm verify:agent
cd site && pnpm dev
```

## Agentation Watch Mode

When the user says "watch mode", start a loop with `agentation_watch_annotations`:
- Call `agentation_watch_annotations` and wait for annotations.
- For each annotation: `agentation_acknowledge`, make the fix, then `agentation_resolve` with a short summary.
- Continue watching until the user says stop or a timeout is reached.
