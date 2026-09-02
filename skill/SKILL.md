---
name: before-and-after
description: Capture before/after screenshots and video of web pages for visual comparison. Use when the user says "before and after", "screenshot comparison", "PR screenshots", "visual diff", wants to document a UI change, or a PR needs visual proof. Handles net-new pages (after-only), animations (video), and stateful UI (drive the page first, then capture).
---

# Before/after captures

You are producing visual proof of a UI change: **before** (the old state — usually production) and **after** (the new state — a preview deployment or local dev server), captured with identical framing so the comparison is honest.

Your judgment does the interesting work: which pages, which section, what UI state, whether the result is good enough to publish. The scripts in `scripts/` handle only what must be deterministic — identical viewports and timing on both sides, video post-processing, and the output format. **They are an optimization, not a cage**: whenever a scenario doesn't fit them, drive the browser with raw `agent-browser` commands and use the scripts only for the pieces that still apply (or none at all).

Requires the `agent-browser` CLI (`npm i -g agent-browser && agent-browser install`), plus `ffmpeg` for video. Publishing to GitHub wants `gh` >= 2.99 (`--attach` support).

## Workflow

1. **Decide the targets.** Map the change to the page(s) that show it. Component-scoped change → the page(s) rendering it plus a CSS `--selector` for the section. Ambiguous → ask, listing what you'd shoot.
2. **Decide before vs after.** Never guess: after = the change (preview deployment, local dev); before = the same path on production. A net-new page has no before — capture after-only and the output titles it "Preview". Never switch git branches or start servers to manufacture a "before".
3. **Warm up (optional, cheap, idempotent):** `node scripts/prewarm.mjs` — pre-sizes one browser session per viewport.
4. **Reach protected pages** — see Authentication below. Verify both URLs answer before shooting: `curl -s -o /dev/null -w "%{http_code}" <url>` (a 30x toward an SSO/login page means blocked).
5. **Capture:**

   ```bash
   node scripts/capture.mjs \
     --before https://example.com/pricing \
     --after  https://preview-abc.vercel.app/pricing \
     --viewport desktop --viewport mobile \
     [--selector ".pricing-table"] [--full] [--record 5] \
     --out ./captures
   ```

   - `--record <seconds>`: video instead of stills (page loads, records N seconds — for animations, transitions, autoplaying sections). Produces an mp4 + poster frame per side.
   - `--selector-before` / `--selector-after` when the section was renamed or moved.
   - After-only: omit `--before`.
   - Writes `manifest.json` into `--out` for the formatter.
6. **Stateful UI (modals, form steps, hover states):** drive *both* URLs into the same state yourself, then shoot manually — same session names keep the prewarmed viewports:

   ```bash
   agent-browser --session desktop open <url> && agent-browser --session desktop snapshot -i
   agent-browser --session desktop click @e42        # …reach the state
   agent-browser --session desktop screenshot ./captures/modal-desktop-after.png
   ```

   For a recorded workflow: `record start file.webm` → interact → `record stop`, then convert like capture.mjs does (`ffmpeg -i in.webm -movflags +faststart -pix_fmt yuv420p out.mp4`). Present hand-taken shots directly, or write a `manifest.json` in the same shape if you want the formatter.
7. **Look at every capture before publishing** (read the image files). Blank frames, error pages, cookie banners, loading spinners, mismatched scroll positions → fix and re-shoot. Never publish a capture you haven't seen.
8. **Format and publish to GitHub** (`gh` >= 2.99) — no upload step; `--attach` puts the files on GitHub's CDN and rewrites the local references in place:

   ```bash
   node scripts/format.mjs --manifest captures/manifest.json [--attribution "@your-agent"] [--markers] > block.md
   # splice block.md into the PR body (inside the markers — never touch prose outside them), then:
   gh pr edit <n> --body-file body.md $(node scripts/format.mjs --manifest captures/manifest.json --attach-list | sed 's/^/--attach /')
   ```

   Run `format.mjs` and `gh` from the same directory — the body's `./relative` refs must match the `--attach` paths for the rewrite. Without `--url-map`, the block references local files: images in side-by-side tables; **videos on their own line under a bold label** — GitHub renders own-line attachment videos as inline players but demotes video refs inside table cells to plain links, and never rewrites `<video>` tags. After-only captures render as "Preview". `--markers` wraps the block in `<!-- website-agent:before-after:start/end -->` comments so re-runs replace the section idempotently. Size limits match web uploads: 10 MB images, 100 MB video on paid plans.
9. **Non-GitHub surfaces** (chat posts natively; anything else needs hosting): upload first, then format in hosted mode:

   ```bash
   BLOB_READ_WRITE_TOKEN=... node scripts/upload.mjs --prefix captures/pr-123 captures/*.png captures/*.mp4 > url-map.json
   node scripts/format.mjs --manifest captures/manifest.json --url-map url-map.json [--markers]
   ```

   Hosted videos become poster frames linked to the mp4, because GitHub strips external `<video>` sources. Avoid public paste-bins for non-public work.
10. **Advanced — video inside a table cell**: possible only with a two-step publish, since it needs the final CDN URL: attach the mp4 once (e.g. `gh pr comment --attach`), copy the rewritten `user-attachments` URL, then edit the body with `<video src="<that-url>"></video>` in the cell. Rarely worth it over the own-line layout.

## Authentication

- **Vercel deployment protection (SSO / Passport):** the project's *automation bypass secret* gets through. With an authenticated `vercel` CLI: read it from `protectionBypass` in `vercel api /v9/projects/<project>`, then either send header `x-vercel-protection-bypass: <secret>` or visit once with `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true` (sets an httpOnly cookie; navigation afterwards is clean). If no secret exists, ask a project admin to add one (Project Settings → Deployment Protection → Protection Bypass for Automation) — creating one yourself mutates the project's security config; don't do it unprompted. Newly created secrets take a few seconds to propagate.
- **Login walls with OAuth/SSO handoff through localhost:** flows that bounce through a `127.0.0.1` helper fail headless Chrome's Local Network Access checks. Install the launch-mutator plugin once — `agent-browser plugin add agent-browser-plugin-allow-loopback` — then log in interactively via agent-browser; the session persists in the daemon.
- Verify auth *before* capturing — a login page screenshot labeled "before" is worse than no screenshot.

## Parity rules (what makes comparisons honest)

- Same viewport, path, UI state, and scroll position on both sides — `capture.mjs` enforces the first two; you enforce the rest.
- Dismiss cookie/consent banners identically on both sides before shooting.
- Video: same duration, same start trigger (capture.mjs starts both right after network-idle + settle).
- Don't use `--full` unless asked — full-page captures of different-length pages destroy side-by-side alignment.

## Scripts

| Script | Does |
|---|---|
| `capture.mjs` | parity screenshots/video of 1–2 URLs across viewports → files + `manifest.json` |
| `format.mjs` | manifest → canonical markdown block: local refs for `gh --attach` by default, `--url-map` for hosted, `--attach-list` for the publish command, `--style text` for chat |
| `prewarm.mjs` | idempotent daemon + per-viewport session warm-up |
| `upload.mjs` | files → Vercel Blob (`BLOB_READ_WRITE_TOKEN`) → `{path: url}` map |

Script interfaces version with this skill and may change freely — nothing else should depend on them. (`npx before-and-after` remains as a frozen alias for `capture.mjs`, and will never grow flags.)
