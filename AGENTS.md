# AGENTS.md

Guidelines for AI agents working on this project.

## Project Overview

before-and-after is an agent skill for attaching screenshots and screen recordings to GitHub pull request descriptions. Browser operation belongs to `agent-browser`; this project owns only the skill instructions and deterministic GitHub attachment formatting.

## Directory Structure

```text
before-and-after/
├── skill/
│   ├── SKILL.md
│   └── scripts/
│       └── format.mjs
├── tests/unit/
├── site/
├── package.json
└── pnpm-workspace.yaml
```

## Rules

1. Do not add browser automation, Vercel authentication, screenshot capture, recording, video conversion, or media hosting. Delegate those to their source tools and bundled skills.
2. Keep `skill/scripts/` dependency-free. Node builtins only.
3. Keep the skill narrow. The first release formats media the agent already produced and publishes it through `gh --attach`.
4. Script arguments version with `SKILL.md`; update both together and do not add compatibility shims.
5. Preserve GitHub rendering invariants: images may use tables; attachment videos must remain on their own lines.
6. Preserve PR prose outside `<!-- before-and-after:start/end -->`.

## Testing

```bash
pnpm test
pnpm pack --dry-run
```

## Development

```bash
pnpm install
cd site && pnpm dev
```

## Agentation Watch Mode

When the user says "watch mode", start a loop with `agentation_watch_annotations`:
- Call `agentation_watch_annotations` and wait for annotations.
- For each annotation: `agentation_acknowledge`, make the fix, then `agentation_resolve` with a short summary.
- Continue watching until the user says stop or a timeout is reached.
