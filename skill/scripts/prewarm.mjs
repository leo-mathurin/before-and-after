#!/usr/bin/env node
/**
 * Idempotent browser warm-up: ensure the agent-browser daemon is running with
 * one session per capture viewport, pre-sized. Run it at environment start
 * (or any time — re-running is cheap) so the first capture doesn't pay
 * browser launch.
 *
 * Usage: prewarm.mjs [viewport ...]   (defaults: desktop mobile)
 */

import { execFileSync } from "node:child_process";
import { resolveViewport } from "./capture.mjs";

export function prewarm(viewports = ["desktop", "mobile"]) {
  const warmed = [];
  for (const name of viewports) {
    const viewport = resolveViewport(name);
    const session = viewport.name.replace(/[^a-zA-Z0-9-]/g, "-");
    execFileSync("agent-browser", ["--session", session, "open", "about:blank"], { stdio: "pipe" });
    execFileSync(
      "agent-browser",
      ["--session", session, "set", "viewport", String(viewport.width), String(viewport.height)],
      { stdio: "pipe" },
    );
    warmed.push({ session, ...viewport });
  }
  return warmed;
}

if (process.argv[1] && import.meta.url.endsWith("prewarm.mjs")) {
  const viewports = process.argv.slice(2);
  const warmed = prewarm(viewports.length ? viewports : undefined);
  console.log(JSON.stringify({ warmed }, null, 2));
}
