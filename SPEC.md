# Product spec

`before-and-after` is an agent skill for adding visual evidence to GitHub pull request descriptions. It composes existing tools rather than recreating them.

## Boundary

- `agent-browser` owns navigation, authentication, page state, screenshots, and recordings; its bundled `protected-vercel-deployments` skill owns protected Preview access.
- GitHub CLI owns attachment upload and local-reference rewriting.
- This skill owns the workflow between them, deterministic PR markup, marker replacement, and verification of the published result.

The skill must work from a raw checkout with no dependencies. Capture decisions live in `SKILL.md` unless repeated deterministic logic clearly earns a zero-dependency helper.

## Release 1: skill-first foundation

- [x] Delegate browser and protected-Preview work to agent-browser's skills.
- [x] Format existing image and video files for `gh --attach`; before/after and after-only.
- [x] Preserve unrelated PR prose through a marked replacement block.
- [x] Equalize full-page pair heights with bottom-only padding so GitHub tables align at the top.
- [x] Verify the rendered PR in a browser: cell mapping, alignment, playable video, no local paths.
- [x] Verify a real agent following `SKILL.md` produces a correct PR.

### Full-page alignment

GitHub table cells are `vertical-align: middle`, so unequal heights never share a top edge. Extend the shorter page at capture time until both screenshots match: pad below only, no image-processing dependency, prefer same-region captures for component comparisons, and treat a large height gap as a sign that a full-page table is the wrong evidence.

## Release 2: video tables

- [x] Upload videos first to obtain final `user-attachments` URLs, then render them in HTML `<video>` table cells.
- [x] Keep the two-step publish retryable without leaving broken markup; own-line videos remain the fallback.
- [x] Verify playback, controls, layout, and cleanup against the fixture PR.

## Release 3: capture intelligence

The skill decides what evidence best proves the change, then iterates until it is valid and persuasive.

### Target discovery

- [ ] Infer affected routes and UI surfaces from the diff.
- [ ] Preserve exact paths, base paths, rewrites, locales, and query state between production and Preview.
- [ ] Resolve the current deployment from metadata rather than deriving or reusing a stale hostname.
- [ ] Distinguish changed pages from shared components that require several representative routes.
- [ ] Recognize net-new routes and produce after-only Preview evidence.

### Evidence selection

- [ ] Choose desktop, mobile, or both from the changed surface and responsive behavior.
- [ ] Consider 2× device scale factor for HiDPI evidence, for example a `1440px` CSS viewport producing a `2880px`-wide image.
- [ ] Balance HiDPI sharpness against attachment size, upload time, GitHub downscaling, and the extra cost of full-page captures.
- [ ] Choose viewport screenshot, full-page screenshot, scoped element capture, or video.
- [ ] Prefer the smallest capture that convincingly demonstrates the change.
- [ ] Detect when page-height divergence makes a full-page table misleading.
- [ ] Choose representative states for hover, focus, expanded content, dialogs, tabs, and multistep flows.

### PR placement

- [x] Place visual evidence toward the top of a new or existing PR, after enough introductory context for the reader to understand what is being shown.
- [x] Prefer inserting after an existing Preview section, deployment link, or short opening summary and before implementation-heavy sections such as Details, Changes, Testing, or Notes.
- [x] Treat headings and section order as semantic hints rather than requiring exact heading names.
- [x] Never invent, rewrite, or expand the PR description merely to create a placement anchor.
- [x] Preserve all existing prose and move or replace only the marked before-and-after block.
- [x] Fall back conservatively when no clear anchor exists instead of splitting a paragraph, list, table, code block, or other Markdown structure.
- [x] Put evidence that proves the PR before supplemental demos, alternate formats, or skill demonstrations; label those clearly and disclose material capture limitations beside them.
- [x] Verify that the rendered evidence appears in the intended reading order, not only that the source markers were inserted successfully.

### State parity

- [ ] Reach equivalent UI state on both sides before capturing.
- [ ] Match viewport, scroll position, selected state, input data, and animation start conditions.
- [ ] Handle cookie banners, feature flags, seeded data, and application authentication consistently.
- [ ] Detect renamed or moved elements without silently comparing different content.

### Quality gates

- [ ] Reject login pages, Vercel platform errors, application errors, blank frames, and loading skeletons.
- [ ] Detect screenshots that are accidentally identical when a visible change is expected.
- [ ] Detect obviously different framing or scale between a pair.
- [ ] Confirm image dimensions, media load, video playability, and final GitHub rendering.
- [ ] Improve agent-browser's native recorder upstream from its hardcoded 10 fps, ideally with a configurable 30 fps default and an optional 60 fps mode for motion-heavy evidence.
- [ ] Probe a recording's native cadence and reject frame-rate upsampling that merely duplicates frames.
- [ ] Prevent secrets, protected query parameters, tokens, or browser state from entering media or PR text.
- [ ] Re-capture after late code or copy changes invalidate earlier evidence.

### Verification loop

1. Form a hypothesis about the route, state, and capture type that best proves the change.
2. Capture both sides with equivalent conditions.
3. Inspect the media and objective metadata.
4. Reject bad or unpersuasive evidence with a concrete reason.
5. Adjust the target, state, scope, or capture type and repeat.
6. Publish only after the local media passes.
7. Inspect the rendered PR and repeat if GitHub changes the presentation.

Evaluate this with scenario fixtures and independent agent runs, not tests that assert prose.
