#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { agentBrowserSession, pngDimensions, probeVideo, root, run } from "./lib.mjs";

const output = mkdtempSync(join(tmpdir(), "before-and-after-verify-"));
const session = `before-and-after-${process.pid}`;
const before = agentBrowserSession(session);
const after = agentBrowserSession(`${session}-after`);
const skill = readFileSync(resolve(root, "skill/SKILL.md"), "utf8");

const pages = {
  "/before": "<!doctype html><title>Before</title><main style='min-height:1400px;background:#eee'><h1>Before</h1><button>Open</button></main>",
  "/after": "<!doctype html><title>After</title><main style='min-height:900px;background:#eee'><h1>After</h1><button>Open</button></main>",
};

const PROBE_HEADER = "x-before-and-after-probe";
const requests = [];

async function pageHeight(browser) {
  return Number(await browser.text("eval", "document.documentElement.scrollHeight"));
}

async function padToHeight(browser, targetHeight) {
  const script = `(() => {
    const currentHeight = document.documentElement.scrollHeight;
    const delta = ${targetHeight} - currentHeight;
    if (delta <= 0) return currentHeight;
    const spacer = document.createElement("div");
    spacer.dataset.beforeAfterPadding = "";
    spacer.style.height = delta + "px";
    spacer.style.flex = "none";
    spacer.style.width = "100%";
    document.body.append(spacer);
    return document.documentElement.scrollHeight;
  })()`;
  return Number(await browser.text("eval", script));
}

const server = createServer((request, response) => {
  requests.push({ url: request.url, probeHeader: request.headers[PROBE_HEADER] ?? null });
  const body = pages[request.url] ?? "Not found";
  response.writeHead(pages[request.url] ? 200 : 404, { "content-type": "text/html" });
  response.end(body);
});

await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  const version = (await run(before.binary, ["--version"])).trim();
  await run(before.binary, ["skills", "get", "core", "--full"]);

  // Equal-height full-page pair, following the SKILL.md "Equal-height image pairs" steps.
  await before("open", `${origin}/before`);
  await before("set", "viewport", "1280", "720");
  await after("open", `${origin}/after`, "--headers", JSON.stringify({ [PROBE_HEADER]: "1" }));
  await after("set", "viewport", "1280", "720");
  const targetHeight = Math.max(await pageHeight(before), await pageHeight(after));
  await padToHeight(before, targetHeight);
  await padToHeight(after, targetHeight);
  await before("screenshot", join(output, "before.png"), "--full");
  await after("screenshot", join(output, "after.png"), "--full");

  const beforeDimensions = pngDimensions(join(output, "before.png"));
  const afterDimensions = pngDimensions(join(output, "after.png"));
  if (JSON.stringify(beforeDimensions) !== JSON.stringify(afterDimensions)) {
    throw new Error(`full-page captures have mismatched dimensions: ${JSON.stringify({ beforeDimensions, afterDimensions })}`);
  }
  if (afterDimensions.height <= 720) throw new Error("full-page capture did not extend past the viewport");

  // Recording: must decode to real frames, not just be a non-empty file.
  requests.length = 0;
  await after("record", "start", join(output, "preview.webm"));
  await after("wait", "400");
  await after("record", "stop");
  if (statSync(join(output, "preview.webm")).size === 0) throw new Error("preview.webm is empty");
  const video = await probeVideo(join(output, "preview.webm"));
  if (video.frames !== null && video.frames < 2) throw new Error(`recording decoded to ${video.frames} frame(s)`);

  // SKILL.md warns that `record start` opens a fresh context that drops origin-scoped headers.
  // Verify the claim against the installed agent-browser instead of asserting the sentence exists.
  const afterRecordStart = requests.filter((entry) => entry.url === "/after");
  const headerDropped = afterRecordStart.length > 0 && afterRecordStart.every((entry) => entry.probeHeader === null);
  const skillWarnsAboutRecordingContext = /record start[\s\S]{0,200}fresh browser context/i.test(skill);
  if (headerDropped && !skillWarnsAboutRecordingContext) {
    throw new Error(`${version} drops custom headers after \`record start\`, but SKILL.md no longer warns about the fresh recording context`);
  }
  if (!headerDropped) {
    console.warn(
      `note: ${version} ${afterRecordStart.length ? "preserved custom headers" : "did not re-request the page"} after \`record start\`; the SKILL.md recording-context caveat may be stale for this version`,
    );
  }

  // SKILL.md discloses the recorder's native cadence; keep the number honest for the installed version.
  if (video.fps !== null) {
    const documentedCadence = new RegExp(`\\b${Math.round(video.fps)} fps\\b`);
    if (!documentedCadence.test(skill)) {
      throw new Error(`${version} records at ${video.fps} fps, but SKILL.md does not mention "${Math.round(video.fps)} fps"`);
    }
  }

  const cadence = video.fps === null ? "ffprobe unavailable, container only" : `${video.frames} frames at ${video.fps} fps`;
  console.log(`Local browser smoke passed with ${version} (${cadence}, headers ${headerDropped ? "dropped" : "kept"} after record start): ${output}`);
} finally {
  await before.close();
  await after.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
