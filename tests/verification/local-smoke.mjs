#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findExternalBinary } from "./lib.mjs";

const root = resolve(import.meta.dirname, "../..");
const output = mkdtempSync(join(tmpdir(), "before-and-after-verify-"));
const session = `before-and-after-${process.pid}`;
const agentBrowser = findExternalBinary("agent-browser", root);

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: options.cwd ?? root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} ${args.join(" ")} failed\n${stderr || stdout}`));
    });
  });
}

const pages = {
  "/before": "<!doctype html><title>Before</title><main><h1>Before</h1><button>Open</button></main>",
  "/after": "<!doctype html><title>After</title><main><h1>After</h1><button>Open</button></main>",
};

const server = createServer((request, response) => {
  const body = pages[request.url] ?? "Not found";
  response.writeHead(pages[request.url] ? 200 : 404, { "content-type": "text/html" });
  response.end(body);
});

await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

try {
  const version = (await run(agentBrowser, ["--version"])).trim();
  await run(agentBrowser, ["skills", "get", "core", "--full"]);
  await run(agentBrowser, ["--session", session, "open", `${origin}/before`]);
  await run(agentBrowser, ["--session", session, "set", "viewport", "1280", "720"]);
  await run(agentBrowser, ["--session", session, "screenshot", join(output, "before.png")]);
  await run(agentBrowser, ["--session", session, "open", `${origin}/after`]);
  await run(agentBrowser, ["--session", session, "screenshot", join(output, "after.png")]);
  await run(agentBrowser, ["--session", session, "record", "start", join(output, "preview.webm")]);
  await run(agentBrowser, ["--session", session, "wait", "250"]);
  await run(agentBrowser, ["--session", session, "record", "stop"]);

  for (const file of ["before.png", "after.png", "preview.webm"]) {
    if (statSync(join(output, file)).size === 0) throw new Error(`${file} is empty`);
  }

  const formatter = resolve(root, "skill/scripts/format.mjs");
  const imageArgs = [formatter, "--before", "before.png", "--after", "after.png", "--label", "Desktop"];
  const imageMarkdown = await run("node", imageArgs, { cwd: output });
  const imageAttachments = await run("node", [formatter, "--attach-list", ...imageArgs.slice(1)], { cwd: output });
  const videoMarkdown = await run("node", [formatter, "--after", "preview.webm", "--label", "Motion"], { cwd: output });

  if (!imageMarkdown.includes("| Before (Desktop) | After (Desktop) |")) throw new Error("image table was not generated");
  if (imageAttachments !== "./before.png\n./after.png\n") throw new Error("attachment paths do not match image references");
  if (!videoMarkdown.includes("**Preview (Motion)**\n\n![Preview](./preview.webm)")) throw new Error("video preview was not generated");

  console.log(`Local browser-to-Markdown smoke passed with ${version}: ${output}`);
} finally {
  await run(agentBrowser, ["--session", session, "close"]).catch(() => {});
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
