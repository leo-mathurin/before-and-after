#!/usr/bin/env node
/**
 * Canonical before/after markdown emitter. Turns a capture manifest (from
 * capture.mjs) into the comparison block for a PR description or comment.
 *
 * Two output modes:
 *
 * - **attach** (default): references capture files by local path, for
 *   publishing with `gh --attach` (gh >= 2.99), which uploads the files to
 *   GitHub's CDN and rewrites the references in place. Images sit in
 *   side-by-side tables; videos go on their own line under a bold label,
 *   because GitHub renders own-line attachment videos as inline players but
 *   downgrades video refs inside table cells to plain links (verified
 *   2026-09-02).
 * - **hosted** (`--url-map`): references pre-uploaded public URLs (e.g.
 *   Vercel Blob) for surfaces where gh --attach doesn't apply. Videos become
 *   poster-frame images linked to the mp4, since GitHub strips external
 *   <video> sources.
 *
 * Owns all formatting decisions so every consumer posts the same block:
 * after-only captures render as "Preview" (net-new pages), and --markers
 * wraps the block for idempotent re-runs.
 *
 * Interface stability: none promised. The SKILL.md next to this file is the
 * only supported consumer.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseArgs } from "node:util";

const MARKER_START = "<!-- website-agent:before-after:start -->";
const MARKER_END = "<!-- website-agent:before-after:end -->";

function urlFor(urlMap, file) {
  if (!file) return null;
  const url = urlMap[file];
  if (!url) throw new Error(`No public URL provided for ${file} — upload it first and pass the mapping`);
  return url;
}

/** Local path shaped the way gh matches --attach args: ./relative-to-cwd. */
function localRef(file) {
  const rel = relative(process.cwd(), file);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function imageCell(side, urlMap) {
  if (!side) return " ";
  return urlMap ? `![](${urlFor(urlMap, side.file)})` : `![](${localRef(side.file)})`;
}

function hostedVideoCell(side, urlMap) {
  if (!side) return " ";
  const poster = urlFor(urlMap, side.poster);
  const mp4 = urlFor(urlMap, side.file);
  return `[![video](${poster})](${mp4})`;
}

function pairLabel(manifest, pair) {
  return manifest.pairs.length > 1 ? ` (${pair.viewport.name}, ${pair.viewport.width}×${pair.viewport.height})` : "";
}

function imageTable(manifest, pair, urlMap, lines) {
  const label = pairLabel(manifest, pair);
  if (pair.before) {
    lines.push(
      `| Before${label} | After${label} |`,
      "|:---:|:---:|",
      `| ${imageCell(pair.before, urlMap)} | ${imageCell(pair.after, urlMap)} |`,
      "",
    );
  } else {
    lines.push(`| Preview${label} |`, "|:---:|", `| ${imageCell(pair.after, urlMap)} |`, "");
  }
}

// Attach mode: own-line refs rewrite to bare attachment URLs, which GitHub
// renders as inline players. Table cells would demote them to links.
function attachedVideoSections(manifest, pair, lines) {
  const label = pairLabel(manifest, pair);
  if (pair.before) {
    lines.push(`**Before${label}**`, "", `![before](${localRef(pair.before.file)})`, "");
  }
  lines.push(`**${pair.before ? "After" : "Preview"}${label}**`, "", `![after](${localRef(pair.after.file)})`, "");
}

function hostedVideoTable(manifest, pair, urlMap, lines) {
  const label = pairLabel(manifest, pair);
  if (pair.before) {
    lines.push(
      `| Before${label} | After${label} |`,
      "|:---:|:---:|",
      `| ${hostedVideoCell(pair.before, urlMap)} | ${hostedVideoCell(pair.after, urlMap)} |`,
      "",
    );
  } else {
    lines.push(`| Preview${label} |`, "|:---:|", `| ${hostedVideoCell(pair.after, urlMap)} |`, "");
  }
}

/**
 * @param urlMap `{localPath: publicUrl}` for hosted mode, or null/undefined
 *   for attach mode (local refs for `gh --attach`).
 */
export function formatMarkdown(manifest, urlMap, { attribution, markers = false } = {}) {
  const lines = [];
  if (markers) lines.push(MARKER_START);
  if (attribution) lines.push(`> Before/after by ${attribution}`, "");

  for (const pair of manifest.pairs) {
    if (manifest.mode === "video") {
      if (urlMap) hostedVideoTable(manifest, pair, urlMap, lines);
      else attachedVideoSections(manifest, pair, lines);
    } else {
      imageTable(manifest, pair, urlMap ?? null, lines);
    }
  }

  if (manifest.mode === "video" && urlMap) {
    lines.push("_Click a frame to play the video._", "");
  }
  if (markers) lines.push(MARKER_END);
  return `${lines.join("\n").trim()}\n`;
}

/** The files a publish must upload: `gh ... $(printf -- '--attach %s ' ...)`. */
export function attachList(manifest) {
  return manifest.pairs
    .flatMap((pair) => [pair.before?.file, pair.after.file])
    .filter(Boolean)
    .map(localRef);
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
      "attach-list": { type: "boolean" },
    },
  });
  if (!values.manifest) {
    console.error(
      "usage: format.mjs --manifest captures/manifest.json [--url-map map.json] [--attribution @agent] [--markers] [--style markdown|text] [--attach-list]",
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(values.manifest, "utf-8"));
  const urlMap = values["url-map"] ? JSON.parse(readFileSync(values["url-map"], "utf-8")) : null;
  if (values["attach-list"]) {
    process.stdout.write(`${attachList(manifest).join("\n")}\n`);
  } else if (values.style === "text") {
    process.stdout.write(formatText(manifest, urlMap ?? {}));
  } else {
    process.stdout.write(formatMarkdown(manifest, urlMap, { attribution: values.attribution, markers: values.markers ?? false }));
  }
}
