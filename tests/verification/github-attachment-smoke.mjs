#!/usr/bin/env node
/**
 * Live GitHub verification against the permanent fixture PR.
 *
 * Phase A (disposable comment) proves what SKILL.md claims about GitHub rendering:
 *   - `gh --attach` rewrites every local image and video reference;
 *   - before/after assets land in the right cells (fixtures differ in width);
 *   - equal-height images share a top edge, unequal ones do not (the reason the
 *     skill pads full-page captures);
 *   - an own-line video renders as a playable player.
 *
 * Phase B (fixture PR description) proves the publish commands SKILL.md actually
 * runs: `gh pr edit --body-file --attach`, a second idempotent publish, and the
 * two-step video table. Surrounding prose must survive every step. The original
 * description is restored and the comment deleted when the run ends.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ATTACHMENT_URL, agentBrowserSession, evalUntil, gh, makePng, requireGhAttach, root, run } from "./lib.mjs";
import { ensureFixturePr, repositoryFromEnv } from "./fixture-pr.mjs";

if (process.env.VERIFY_GITHUB_MUTATION !== "1") {
  console.error("Refusing to mutate GitHub. Set VERIFY_GITHUB_MUTATION=1 explicitly.");
  process.exit(1);
}

requireGhAttach();
const repository = repositoryFromEnv();
const fixture = ensureFixturePr(repository);
const pr = String(fixture.number);
const prUrl = `https://github.com/${repository}/pull/${pr}`;
const originalBody = gh(["pr", "view", pr, "--repo", repository, "--json", "body", "--jq", ".body"]).trimEnd();
const cwd = mkdtempSync(join(tmpdir(), "before-and-after-github-"));
const formatter = resolve(root, "skill/scripts/format.mjs");
const browser = agentBrowserSession(`before-and-after-github-${process.pid}`);
const format = (...args) => run("node", [formatter, ...args], { cwd });

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const prBody = () => gh(["pr", "view", pr, "--repo", repository, "--json", "body", "--jq", ".body"]).trimEnd();
const markerCount = (body) => (body.match(/<!-- before-and-after:start -->/g) ?? []).length;
const localRefs = (body) => body.match(/\]\(\.\/[^)]+\)/g) ?? [];
// GitHub serves attachments from private-user-images URLs that embed the asset UUID.
const assetId = (url) => url?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0] ?? null;

// Fixtures: equal heights with different widths (alignment + swap detection),
// unequal heights (demonstrates GitHub's vertical centering), and a real recording.
const fixtures = {
  "equal-before.png": makePng(40, 60, [220, 40, 40]),
  "equal-after.png": makePng(80, 60, [40, 80, 220]),
  "unequal-before.png": makePng(40, 60, [40, 180, 80]),
  "unequal-after.png": makePng(40, 120, [160, 60, 200]),
};
for (const [name, bytes] of Object.entries(fixtures)) writeFileSync(join(cwd, name), bytes);

const commentIds = [];

function postComment(name, formatArgs) {
  return (async () => {
    writeFileSync(join(cwd, `${name}.md`), await format(...formatArgs));
    const attachments = (await format("--attach-list", ...formatArgs)).trim().split("\n");
    const url = gh(
      ["pr", "comment", pr, "--repo", repository, "--body-file", `${name}.md`, ...attachments.flatMap((file) => ["--attach", file])],
      { cwd },
    ).trim();
    const id = url.match(/#issuecomment-(\d+)$/)?.[1];
    expect(id, `Could not parse comment URL: ${url}`);
    commentIds.push(id);
    const body = gh(["api", `repos/${repository}/issues/comments/${id}`, "--jq", ".body"]);
    expect(localRefs(body).length === 0, `GitHub left local references in the ${name} comment: ${localRefs(body).join(", ")}`);
    const assets = [...new Set(body.match(ATTACHMENT_URL) ?? [])];
    expect(assets.length === attachments.length, `expected ${attachments.length} distinct attachment URLs in the ${name} comment, found ${assets.length}`);
    return { id, url, assets };
  })();
}

try {
  await browser("open", "data:text/html,<body style='background:%23222;color:%23fff'><h1>Recording fixture</h1></body>");
  await browser("set", "viewport", "640", "360");
  await browser("record", "start", join(cwd, "preview.webm"));
  await browser("wait", "500");
  await browser("record", "stop");

  // ---- Phase A: disposable comments ------------------------------------------------
  // The formatter takes either paired media or after-only media per invocation, so the
  // image pairs and the own-line video go in separate comments.
  const images = await postComment("images", [
    "--before", "equal-before.png", "--after", "equal-after.png",
    "--before", "unequal-before.png", "--after", "unequal-after.png",
    "--label", "Equal", "--label", "Unequal",
  ]);
  const motion = await postComment("motion", ["--after", "preview.webm", "--label", "Motion"]);
  const videoAssetUrl = motion.assets[0];
  const commentId = images.id;
  const commentUrl = images.url;
  const commentAssets = images.assets;

  await browser("open", commentUrl);
  const rendered = await evalUntil(
    browser,
    `(() => {
      const scope = document.getElementById("issuecomment-${commentId}")?.querySelector(".comment-body, .markdown-body");
      if (!scope) return null;
      const images = [...scope.querySelectorAll("table img")];
      if (images.length < 4 || images.some((img) => !img.complete)) return null;
      const motion = document.getElementById("issuecomment-${motion.id}")?.querySelector(".comment-body, .markdown-body");
      const videos = motion ? [...motion.querySelectorAll("video")] : [];
      if (!videos.length || videos.some((video) => video.readyState < 1)) return null;
      return {
        tables: [...scope.querySelectorAll("table")].filter((table) => table.querySelector("img")).map((table) =>
          [...table.querySelectorAll("img")].map((img) => ({
            src: img.currentSrc || img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            top: Math.round(img.getBoundingClientRect().top * 10) / 10,
          })),
        ),
        videos: videos.map((video) => ({
          src: video.currentSrc || video.src,
          controls: video.controls,
          readyState: video.readyState,
          inTable: Boolean(video.closest(".comment-body table, .markdown-body table")),
        })),
      };
    })()`,
    { label: "comment images and video to finish loading" },
  );

  const [equal, unequal] = rendered.tables;
  expect(rendered.tables.length === 2, `expected 2 rendered tables, found ${rendered.tables.length}`);
  expect(equal[0].naturalWidth === 40 && equal[1].naturalWidth === 80, `before/after assets are swapped or resized: ${JSON.stringify(equal)}`);
  expect(
    assetId(equal[0].src) === assetId(commentAssets[0]) && assetId(equal[1].src) === assetId(commentAssets[1]),
    `table cells show unexpected assets: ${JSON.stringify(equal)} vs ${JSON.stringify(commentAssets)}`,
  );
  expect(equal.every((img) => img.naturalHeight === 60), `equal-height fixtures did not keep their height: ${JSON.stringify(equal)}`);
  expect(Math.abs(equal[0].top - equal[1].top) < 1, `equal-height images do not share a top edge: ${JSON.stringify(equal)}`);
  expect(
    Math.abs(unequal[0].top - unequal[1].top) > 10,
    `GitHub no longer vertically centres table cells (tops ${unequal[0].top} vs ${unequal[1].top}); the equal-height padding guidance in SKILL.md may be obsolete`,
  );
  const [video] = rendered.videos;
  expect(assetId(video.src) === assetId(videoAssetUrl), `own-line video does not play its uploaded asset: ${JSON.stringify(video)}`);
  expect(video.controls, "own-line video rendered without controls");
  expect(!video.inTable, "own-line video unexpectedly rendered inside a table");

  // ---- Phase B: the fixture PR description --------------------------------------------
  const prose = originalBody.trimEnd();
  const publishArgs = ["--before", "equal-before.png", "--after", "equal-after.png", "--label", "Desktop"];

  writeFileSync(join(cwd, "body-0.md"), originalBody);
  writeFileSync(join(cwd, "body-1.md"), await format("--body-file", "body-0.md", ...publishArgs));
  const publishAttachments = (await format("--attach-list", ...publishArgs)).trim().split("\n");
  gh(["pr", "edit", pr, "--repo", repository, "--body-file", "body-1.md", ...publishAttachments.flatMap((file) => ["--attach", file])], { cwd });

  const body1 = prBody();
  expect(markerCount(body1) === 1, `first publish produced ${markerCount(body1)} marker blocks`);
  expect(body1.startsWith(prose), "first publish altered the prose above the evidence block");
  expect(localRefs(body1).length === 0, `first publish left local references: ${localRefs(body1).join(", ")}`);
  expect((body1.match(ATTACHMENT_URL) ?? []).length === 2, "first publish did not upload both images");

  // Second publish with the same media must replace the block, not duplicate or move it.
  writeFileSync(join(cwd, "body-1.md"), body1);
  writeFileSync(join(cwd, "body-2.md"), await format("--body-file", "body-1.md", ...publishArgs));
  gh(["pr", "edit", pr, "--repo", repository, "--body-file", "body-2.md", ...publishAttachments.flatMap((file) => ["--attach", file])], { cwd });
  const body2 = prBody();
  expect(markerCount(body2) === 1, `second publish produced ${markerCount(body2)} marker blocks`);
  expect(body2.startsWith(prose), "second publish altered the prose above the evidence block");
  expect(body2.indexOf("<!-- before-and-after:start -->") === body1.indexOf("<!-- before-and-after:start -->"), "second publish moved the evidence block");
  expect(localRefs(body2).length === 0, `second publish left local references: ${localRefs(body2).join(", ")}`);

  // Two-step video table: final attachment URL from Phase A, no --attach needed.
  writeFileSync(join(cwd, "body-2.md"), body2);
  writeFileSync(join(cwd, "body-3.md"), await format("--body-file", "body-2.md", "--after-video-url", videoAssetUrl, "--label", "Motion"));
  gh(["pr", "edit", pr, "--repo", repository, "--body-file", "body-3.md"], { cwd });
  const body3 = prBody();
  expect(markerCount(body3) === 1, `video-table publish produced ${markerCount(body3)} marker blocks`);
  expect(body3.startsWith(prose), "video-table publish altered the prose above the evidence block");
  expect(body3.includes(`<video src="${videoAssetUrl}"`), "video-table publish did not embed the final attachment URL");

  // The comment URL differs from the PR URL only by its fragment, so a plain open would be a
  // same-document navigation and show the stale description. Force a fresh load.
  await browser("open", `${prUrl}?verify=${Date.now()}`);
  const renderedDescription = await evalUntil(
    browser,
    `(() => {
      const scope = document.querySelector(".comment-body, .markdown-body");
      const video = scope?.querySelector("table video");
      if (!video || video.readyState < 1) return null;
      return { controls: video.controls, readyState: video.readyState, src: video.currentSrc || video.src, headers: [...scope.querySelectorAll("table th")].map((th) => th.textContent.trim()) };
    })()`,
    { label: "PR description video table to reach a playable state" },
  );
  expect(renderedDescription.controls, "video table rendered without controls");
  expect(assetId(renderedDescription.src) === assetId(videoAssetUrl), `video table plays an unexpected asset: ${JSON.stringify(renderedDescription)}`);
  expect(renderedDescription.headers.includes("Preview (Motion)"), `video table header missing: ${JSON.stringify(renderedDescription.headers)}`);

  console.log(`GitHub smoke passed on ${repository}#${pr}: ${commentIds.length} disposable comments, description edited 3× and restored.`);
} finally {
  await browser.close();
  writeFileSync(join(cwd, "original.md"), originalBody);
  try {
    gh(["pr", "edit", pr, "--repo", repository, "--body-file", "original.md"], { cwd });
    if (prBody() !== originalBody) console.error(`WARNING: fixture description on ${repository}#${pr} differs from the snapshot; run pnpm fixture:pr`);
  } catch (error) {
    console.error(`WARNING: failed to restore fixture description on ${repository}#${pr}: ${error.message}`);
  }
  if (process.env.KEEP_FIXTURE_COMMENT !== "1") {
    for (const id of commentIds) gh(["api", "--method", "DELETE", `repos/${repository}/issues/comments/${id}`]);
  }
}
