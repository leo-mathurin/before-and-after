#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findExternalBinary } from "./lib.mjs";

const root = resolve(import.meta.dirname, "../..");
const agentBrowser = findExternalBinary("agent-browser", root);

const { VERCEL_PREVIEW_URL, VERCEL_PROJECT, VERCEL_SCOPE } = process.env;
if (!VERCEL_PREVIEW_URL || !VERCEL_PROJECT || !VERCEL_SCOPE) {
  console.error("Set VERCEL_PREVIEW_URL, VERCEL_PROJECT, and VERCEL_SCOPE.");
  process.exit(1);
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(capture ? stdout.trim() : stdout);
      else reject(new Error(`${command} failed\n${stderr || stdout}`));
    });
  });
}

const version = await run("vercel", ["--version"], { capture: true });
const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
if (!match || Number(match[1]) < 53 || (Number(match[1]) === 53 && Number(match[2]) < 3)) {
  throw new Error(`Vercel CLI 53.3.0 or newer is required; found ${version}`);
}

await run(agentBrowser, ["skills", "get", "protected-vercel-deployments", "--full"]);
const token = await run("vercel", ["project", "token", VERCEL_PROJECT, "--scope", VERCEL_SCOPE], { capture: true });
if (!token) throw new Error("Vercel returned an empty project token");

const session = `before-and-after-vercel-${process.pid}`;
const output = mkdtempSync(join(tmpdir(), "before-and-after-vercel-"));
const screenshot = join(output, "preview.png");
const headers = JSON.stringify({ "x-vercel-trusted-oidc-idp-token": token });

try {
  await run(agentBrowser, ["--session", session, "open", VERCEL_PREVIEW_URL, "--headers", headers]);
  const title = await run(agentBrowser, ["--session", session, "get", "title"], { capture: true });
  const url = await run(agentBrowser, ["--session", session, "get", "url"], { capture: true });
  if (/vercel.*login|log in.*vercel/i.test(`${title} ${url}`)) throw new Error("Preview resolved to a Vercel login page");
  await run(agentBrowser, ["--session", session, "screenshot", screenshot]);
  if (statSync(screenshot).size === 0) throw new Error("Preview screenshot is empty");
  console.log(`Protected Preview smoke passed: ${output}`);
} finally {
  await run(agentBrowser, ["--session", session, "close"]).catch(() => {});
}
