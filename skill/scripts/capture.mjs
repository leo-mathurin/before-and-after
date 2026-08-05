#!/usr/bin/env node
/**
 * Parity capture engine: shoot the same page state on two URLs (or one, for
 * net-new pages) with identical viewport, wait conditions, and timing, so
 * before/after comparisons don't drift. Optionally records video instead of
 * stills (--record).
 *
 * This is the deterministic core the before-and-after skill calls after all
 * judgment (which URLs, which selector, what UI state) has been made. It is
 * not a general automation tool — drive the page with agent-browser directly
 * for anything stateful, then invoke this for the final parity shots.
 *
 * Depends on the agent-browser CLI (and ffmpeg when recording). Uses one
 * agent-browser session per viewport (named after the viewport preset), so a
 * prewarmed daemon (see prewarm.mjs) makes captures near-instant.
 *
 * Emits a manifest.json in --out for format.mjs.
 *
 * Interface stability: none promised. The SKILL.md next to this file is the
 * only supported consumer.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

export const VIEWPORT_PRESETS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

export function resolveViewport(name) {
  if (VIEWPORT_PRESETS[name]) return { name, ...VIEWPORT_PRESETS[name] };
  const match = /^(\d+)x(\d+)$/.exec(name);
  if (match) {
    return { name, width: Number(match[1]), height: Number(match[2]) };
  }
  throw new Error(`Unknown viewport "${name}" — use a preset (${Object.keys(VIEWPORT_PRESETS).join(", ")}) or WxH`);
}

/** Slug for filenames: /pricing → pricing, / → home. */
export function pathSlug(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return (pathname || "home").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60);
  } catch {
    return "page";
  }
}

function ab(session, args, opts = {}) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function settle(session, settleMs) {
  try {
    ab(session, ["wait", "--load", "networkidle"], { timeout: 30_000 });
  } catch {
    // Pages with long-polling never reach networkidle; the fixed settle
    // below still gives fonts/animations time.
  }
  await sleep(settleMs);
}

async function captureSide({ session, side, url, selector, full, out, slugBase, recordSeconds, settleMs }) {
  ab(session, ["open", url]);
  await settle(session, settleMs);

  if (selector) {
    ab(session, ["scrollintoview", selector]);
    await sleep(200);
  }

  if (recordSeconds) {
    const webm = join(out, `${slugBase}-${side}.webm`);
    ab(session, ["record", "start", webm]);
    await sleep(recordSeconds * 1000);
    ab(session, ["record", "stop"]);
    const mp4 = join(out, `${slugBase}-${side}.mp4`);
    const poster = join(out, `${slugBase}-${side}-poster.png`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-movflags", "+faststart", "-pix_fmt", "yuv420p", mp4]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-frames:v", "1", poster]);
    return { url, file: mp4, poster, kind: "video" };
  }

  const png = join(out, `${slugBase}-${side}.png`);
  ab(session, ["screenshot", ...(full ? ["--full"] : []), png]);
  return { url, file: png, kind: "image" };
}

export async function capture(options) {
  const {
    before,
    after,
    viewports = ["desktop"],
    selector,
    selectorBefore,
    selectorAfter,
    full = false,
    record = 0,
    out = "./captures",
    settleMs = 800,
  } = options;
  if (!after) throw new Error("--after is required (before is optional for net-new pages)");

  const outDir = resolve(out);
  mkdirSync(outDir, { recursive: true });

  const pairs = [];
  for (const viewportName of viewports) {
    const viewport = resolveViewport(viewportName);
    const session = viewport.name.replace(/[^a-zA-Z0-9-]/g, "-");
    ab(session, ["open", "about:blank"]);
    ab(session, ["set", "viewport", String(viewport.width), String(viewport.height)]);

    const slugBase = `${pathSlug(after)}-${viewport.name}`;
    const shared = { session, full, out: outDir, recordSeconds: record, settleMs };

    // Same session, same viewport, back-to-back: parity by construction.
    const beforeResult = before
      ? await captureSide({ ...shared, side: "before", url: before, selector: selectorBefore ?? selector, slugBase })
      : null;
    const afterResult = await captureSide({
      ...shared,
      side: "after",
      url: after,
      selector: selectorAfter ?? selector,
      slugBase,
    });

    pairs.push({ viewport, before: beforeResult, after: afterResult });
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    mode: record ? "video" : "image",
    recordSeconds: record || undefined,
    pairs,
  };
  const manifestPath = join(outDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}

function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      before: { type: "string" },
      after: { type: "string" },
      viewport: { type: "string", multiple: true },
      selector: { type: "string" },
      "selector-before": { type: "string" },
      "selector-after": { type: "string" },
      full: { type: "boolean" },
      record: { type: "string" },
      out: { type: "string" },
      settle: { type: "string" },
    },
  });
  // Frozen alias compatibility: `before-and-after <before> <after>` (or a
  // single URL, treated as after-only). Protocol optional, https assumed.
  const withScheme = (url) => (url && !/^[a-z]+:\/\//.test(url) ? `https://${url}` : url);
  const [posBefore, posAfter] = positionals.length >= 2 ? positionals : [undefined, positionals[0]];

  return {
    before: values.before ?? withScheme(posBefore),
    after: values.after ?? withScheme(posAfter),
    viewports: values.viewport?.length ? values.viewport : ["desktop"],
    selector: values.selector,
    selectorBefore: values["selector-before"],
    selectorAfter: values["selector-after"],
    full: values.full ?? false,
    record: values.record ? Number(values.record) : 0,
    out: values.out ?? "./captures",
    settleMs: values.settle ? Number(values.settle) : 800,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  capture(parseCli(process.argv.slice(2)))
    .then(({ manifest, manifestPath }) => {
      console.log(JSON.stringify({ manifestPath, files: manifest.pairs.flatMap((p) => [p.before?.file, p.after.file, p.before?.poster, p.after.poster].filter(Boolean)) }, null, 2));
    })
    .catch((error) => {
      console.error(String(error?.message ?? error));
      process.exit(1);
    });
}
