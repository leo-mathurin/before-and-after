# Product spec

`before-and-after` is an agent skill for adding visual evidence to GitHub pull request descriptions. It should compose existing tools rather than recreate them.

## Product boundary

- `agent-browser` owns navigation, authentication, page state, screenshots, and recordings.
- Vercel's version-matched `protected-vercel-deployments` skill owns protected Preview access.
- GitHub CLI owns attachment upload and local-reference rewriting.
- This skill owns the workflow between those tools, deterministic PR markup, safe marker replacement, and verification of the published result.

The package must remain usable from a raw skill checkout without installing dependencies. Browser or capture decisions belong in skill instructions unless repeated deterministic logic clearly earns a zero-dependency helper.

## Release 1: skill-first foundation

Status: in progress on PR #5.

- [x] Delegate browser work to the skills bundled with `agent-browser`.
- [x] Delegate protected Vercel access instead of copying authentication instructions.
- [x] Format existing image and video files for `gh --attach`.
- [x] Preserve unrelated PR prose through a marked replacement block.
- [x] Support before/after and after-only Preview evidence.
- [x] Verify local browser capture, protected Preview access, package contents, and real GitHub attachment rewriting.
- [x] Reject protected Preview routes that reach Vercel `404: NOT_FOUND`.
- [x] Equalize full-page image-pair heights with bottom-only capture padding so GitHub tables align at the top.
- [ ] Verify the final rendered PR, including loaded media dimensions and the absence of local paths.

### Full-page alignment decision

GitHub Markdown table cells use `vertical-align: middle`, so screenshots with different heights do not share a top edge. The first-release solution is to extend the shorter page at capture time until both screenshots have equal pixel dimensions.

Constraints:

- Add space only below the page.
- Transparent padding or the capture tool's default canvas is acceptable.
- Do not add an image-processing dependency.
- Prefer same-region captures over padding when the comparison is component-scoped.
- Treat large height differences as a signal that full-page comparison may be the wrong evidence, not merely a formatting problem.

## Release 2: video tables

- [ ] Upload videos first to obtain final GitHub `user-attachments` URLs.
- [ ] Render final URLs in HTML `<video>` elements inside table cells.
- [ ] Make the two-step publish flow retryable without leaving broken PR markup.
- [ ] Verify playback, controls, layout, and cleanup in a disposable PR fixture.
- [ ] Preserve own-line video attachments as the simple fallback.

## Release 3: capture intelligence

The skill should eventually decide what evidence best proves the change, then iterate until the evidence is valid and persuasive.

### Target discovery

- [ ] Infer affected routes and UI surfaces from the diff.
- [ ] Preserve exact paths, base paths, rewrites, locales, and query state between production and Preview.
- [ ] Resolve the current deployment from metadata rather than deriving or reusing a stale hostname.
- [ ] Distinguish changed pages from shared components that require several representative routes.
- [ ] Recognize net-new routes and produce after-only Preview evidence.

### Evidence selection

- [ ] Choose desktop, mobile, or both from the changed surface and responsive behavior.
- [ ] Choose viewport screenshot, full-page screenshot, scoped element capture, or video.
- [ ] Prefer the smallest capture that convincingly demonstrates the change.
- [ ] Detect when page-height divergence makes a full-page table misleading.
- [ ] Choose representative states for hover, focus, expanded content, dialogs, tabs, and multistep flows.

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

Future intelligence should be evaluated with scenario fixtures and independent agent runs, not tests that merely assert specific prose.
