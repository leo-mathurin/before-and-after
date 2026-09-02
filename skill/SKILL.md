---
name: before-and-after
description: Add existing screenshots or screen recordings to a GitHub pull request as a before/after or preview block. Use when a PR needs visual media attached to its description. Browser navigation and capture belong to agent-browser.
---

# Add visual media to a PR

Use `agent-browser` to create the screenshots or recordings. This skill only owns the GitHub PR attachment workflow.

## Capture

1. Load the version-matched core instructions with `agent-browser skills get core --full` and follow them for sessions, navigation, page state, screenshots, and recordings.
2. If a Vercel URL is protected, load `agent-browser skills get protected-vercel-deployments --full`. Do not reproduce its authentication workflow here.
3. Save media under the repository with paths that contain no whitespace, for example:

   ```text
   captures/desktop-before.png
   captures/desktop-after.png
   captures/mobile-before.png
   captures/mobile-after.png
   ```

The formatter supports PNG, JPEG, GIF, WebP, MP4, MOV, and WebM files. Use an `--after` file without a matching `--before` file for a net-new preview.

## Format

Pass one `--before` and `--after` pair for each comparison. Repeat `--label` to identify multiple pairs:

```bash
node skill/scripts/format.mjs \
  --before captures/desktop-before.png \
  --after captures/desktop-after.png \
  --before captures/mobile-before.png \
  --after captures/mobile-after.png \
  --label Desktop \
  --label Mobile \
  > /tmp/before-and-after.md
```

For an after-only preview:

```bash
node skill/scripts/format.mjs \
  --after captures/new-page.png \
  > /tmp/before-and-after.md
```

Images render in tables. This first release puts videos on their own lines so `gh --attach` can rewrite local references directly. HTML video tables are possible only after obtaining final GitHub attachment URLs and belong to a separate two-step publishing workflow.

## Publish

Preserve the existing PR description and replace only this skill's marked block:

```bash
PR=123
gh pr view "$PR" --json body --jq .body > /tmp/pr-body.md

node skill/scripts/format.mjs \
  --body-file /tmp/pr-body.md \
  --before captures/desktop-before.png \
  --after captures/desktop-after.png \
  > /tmp/pr-body-next.md

ATTACH_ARGS=()
while IFS= read -r file; do
  ATTACH_ARGS+=(--attach "$file")
done < <(
  node skill/scripts/format.mjs \
    --attach-list \
    --before captures/desktop-before.png \
    --after captures/desktop-after.png
)

gh pr edit "$PR" --body-file /tmp/pr-body-next.md "${ATTACH_ARGS[@]}"
```

Run the formatter and `gh` from the same directory. `gh --attach` uploads the local files to GitHub and rewrites their matching local references in the PR body.

After publishing, fetch or open the PR description and confirm that no `./captures/...` references remain inside the marked block.

Do not publish captures containing Vercel OIDC tokens, bypass secrets, authenticated query parameters, or browser state files.

## Script contract

`scripts/format.mjs` is intentionally the only bundled script. It:

- formats existing local media;
- labels after-only media as `Preview`;
- emits the exact attachment path list;
- inserts or replaces `<!-- before-and-after:start/end -->` without changing other PR prose.

Its arguments version with this skill and are not a public library API.
