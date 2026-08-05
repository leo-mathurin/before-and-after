#!/usr/bin/env node
/**
 * Canonical before/after markdown emitter. Turns a capture manifest (from
 * capture.mjs) plus a local-file → public-URL map into the comparison block
 * for a PR description, or a plain-text summary for chat.
 *
 * Owns all formatting decisions so every consumer posts the same block:
 * - side-by-side table per viewport
 * - after-only mode titled "Preview" when there is no before (net-new pages)
 * - video cells as poster-frame images linked to the mp4 (GitHub only
 *   inline-plays videos uploaded to its own CDN, so external mp4s can't embed)
 * - optional attribution line and marker comments
 *
 * Interface stability: none promised. The SKILL.md next to this file is the
 * only supported consumer.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const MARKER_START = "<!-- website-agent:before-after:start -->";
const MARKER_END = "<!-- website-agent:before-after:end -->";

function urlFor(urlMap, file) {
  if (!file) return null;
  const url = urlMap[file];
  if (!url) throw new Error(`No public URL provided for ${file} — upload it first and pass the mapping`);
  return url;
}

function cell(side, urlMap) {
  if (!side) return " ";
  if (side.kind === "video") {
    const poster = urlFor(urlMap, side.poster);
    const mp4 = urlFor(urlMap, side.file);
    return `[![video](${poster})](${mp4})`;
  }
  return `![](${urlFor(urlMap, side.file)})`;
}

export function formatMarkdown(manifest, urlMap, { attribution, markers = false } = {}) {
  const lines = [];
  if (markers) lines.push(MARKER_START);
  if (attribution) lines.push(`> Before/after by ${attribution}`, "");

  for (const pair of manifest.pairs) {
    const label = manifest.pairs.length > 1 ? ` (${pair.viewport.name}, ${pair.viewport.width}×${pair.viewport.height})` : "";
    if (pair.before) {
      lines.push(
        `| Before${label} | After${label} |`,
        "|:---:|:---:|",
        `| ${cell(pair.before, urlMap)} | ${cell(pair.after, urlMap)} |`,
        "",
      );
    } else {
      lines.push(`| Preview${label} |`, "|:---:|", `| ${cell(pair.after, urlMap)} |`, "");
    }
  }

  if (manifest.mode === "video") {
    lines.push("_Click a frame to play the video._", "");
  }
  if (markers) lines.push(MARKER_END);
  return `${lines.join("\n").trim()}\n`;
}

/** Plain-text variant for chat surfaces where files are attached natively. */
export function formatText(manifest, urlMap = {}) {
  const lines = [];
  for (const pair of manifest.pairs) {
    const scope = `${pair.viewport.name} ${pair.viewport.width}×${pair.viewport.height}`;
    if (pair.before) {
      lines.push(`Before → After (${scope}): ${urlMap[pair.before.file] ?? pair.before.file} → ${urlMap[pair.after.file] ?? pair.after.file}`);
    } else {
      lines.push(`Preview (${scope}): ${urlMap[pair.after.file] ?? pair.after.file}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string" },
      "url-map": { type: "string" },
      attribution: { type: "string" },
      markers: { type: "boolean" },
      style: { type: "string" },
    },
  });
  if (!values.manifest) {
    console.error("usage: format.mjs --manifest captures/manifest.json [--url-map map.json] [--attribution @agent] [--markers] [--style markdown|text]");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(values.manifest, "utf-8"));
  const urlMap = values["url-map"] ? JSON.parse(readFileSync(values["url-map"], "utf-8")) : {};
  const output =
    values.style === "text"
      ? formatText(manifest, urlMap)
      : formatMarkdown(manifest, urlMap, { attribution: values.attribution, markers: values.markers ?? false });
  process.stdout.write(output);
}
