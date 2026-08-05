#!/usr/bin/env node
/**
 * Upload captures to a Vercel Blob store and print a {localPath: publicUrl}
 * map (feed it to format.mjs --url-map). Reads the standard
 * BLOB_READ_WRITE_TOKEN env var — export it from wherever your team keeps
 * the store token.
 *
 * Agent environments with their own trusted upload path (keeping tokens out
 * of the shell) should use that instead and skip this script.
 *
 * Usage: BLOB_READ_WRITE_TOKEN=... upload.mjs [--prefix captures/my-pr] <files...>
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function uploadToBlob(files, { token, prefix = "captures" } = {}) {
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const urlMap = {};
  for (const file of files) {
    const name = basename(file);
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const response = await fetch(
      `https://blob.vercel-storage.com/${prefix.replace(/\/+$/, "")}/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "x-api-version": "7",
          "x-content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
          "x-add-random-suffix": "1",
        },
        body: readFileSync(file),
      },
    );
    if (!response.ok) {
      throw new Error(`Upload of ${file} failed (${response.status}): ${await response.text()}`);
    }
    const result = await response.json();
    urlMap[file] = result.url;
  }
  return urlMap;
}

if (process.argv[1] && import.meta.url.endsWith("upload.mjs")) {
  const { values, positionals } = parseArgs({
    options: { prefix: { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    console.error("usage: BLOB_READ_WRITE_TOKEN=... upload.mjs [--prefix captures/pr-123] <files...>");
    process.exit(1);
  }
  uploadToBlob(positionals, { token: process.env.BLOB_READ_WRITE_TOKEN, prefix: values.prefix })
    .then((urlMap) => console.log(JSON.stringify(urlMap, null, 2)))
    .catch((error) => {
      console.error(String(error?.message ?? error));
      process.exit(1);
    });
}
