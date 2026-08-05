# AGENTS.md

Guidelines for AI agents working on this project.

## Project Overview

before-and-after is an **agent skill** (plus a marketing site) for capturing before/after screenshots and video of web pages. The skill's markdown is the product; a few zero-dependency Node scripts do the deterministic parts. There is deliberately **no library API and no CLI product** — the old `src/` library and flag-rich CLI were removed, and `before-and-after <before> <after>` survives only as a frozen alias for `capture.mjs` that must never grow flags.

## Directory Structure

```
before-and-after/
├── skill/                    # The product
│   ├── SKILL.md              # Judgment guide agents follow (npx skills add vercel-labs/before-and-after)
│   └── scripts/              # Deterministic core, plain .mjs, node builtins only
│       ├── capture.mjs       # Parity screenshots/video via agent-browser → manifest.json
│       ├── format.mjs        # Manifest + URL map → canonical markdown block
│       ├── prewarm.mjs       # Idempotent daemon/viewport warm-up
│       └── upload.mjs        # Vercel Blob upload (BLOB_READ_WRITE_TOKEN) → URL map
├── tests/unit/               # Vitest tests for the scripts' pure logic
├── site/                     # Marketing website (Next.js) — jm.sv/before-and-after
├── package.json              # Publishes skill/ to npm; bin = frozen capture alias
└── pnpm-workspace.yaml
```

## Rules

1. **No interface promises on scripts.** Their args version with SKILL.md; change them freely, update SKILL.md in the same commit. Never add back-compat shims.
2. **No dependencies in `skill/scripts/`.** Node builtins + shelling to `agent-browser`/`ffmpeg` only — the scripts must run from a raw `npx skills add` checkout with no install step.
3. **Judgment goes in SKILL.md, determinism in scripts.** If you're adding a flag that encodes a decision an agent could make (which pages, what state, when to record), it belongs in prose, not argv.
4. **The frozen bin alias never grows another flag.**
5. Keep parity sacred: anything that could make the before and after shots differ for reasons other than the page itself (viewport, timing, waits) must be identical on both sides in `capture.mjs`.

## Testing

```bash
pnpm test                 # vitest, pure-logic tests only
node skill/scripts/capture.mjs example.com example.org --out /tmp/smoke   # live smoke (needs agent-browser)
```

## Development

```bash
pnpm install
cd site && pnpm dev       # marketing site
```

## Agentation Watch Mode

When the user says "watch mode", start a loop with `agentation_watch_annotations`:
- Call `agentation_watch_annotations` and wait for annotations.
- For each annotation: `agentation_acknowledge`, make the fix, then `agentation_resolve` with a short summary.
- Continue watching until the user says stop or a timeout is reached.
