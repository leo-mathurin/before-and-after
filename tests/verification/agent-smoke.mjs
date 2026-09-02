#!/usr/bin/env node
/**
 * Runs a real agent against SKILL.md and grades the artifact, not the transcript.
 *
 * Everything else in this suite re-implements the skill's steps in JavaScript, which
 * proves the tools compose but not that SKILL.md leads an agent to compose them. This
 * probe hands Claude Code two existing captures and the fixture PR, lets it follow the
 * skill headlessly, then asserts on the resulting PR description with the same checks
 * the GitHub smoke uses. The description is restored afterwards.
 *
 * Opt-in: it spends model tokens and needs `claude` on PATH.
 *   VERIFY_GITHUB_MUTATION=1 VERIFY_AGENT=1 pnpm verify:agent
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ATTACHMENT_URL, gh, hasBinary, makePng, root } from "./lib.mjs";
import { ensureFixturePr, repositoryFromEnv } from "./fixture-pr.mjs";

if (process.env.VERIFY_GITHUB_MUTATION !== "1" || process.env.VERIFY_AGENT !== "1") {
  console.error("Refusing to run. Set VERIFY_GITHUB_MUTATION=1 and VERIFY_AGENT=1 explicitly.");
  process.exit(1);
}
if (!hasBinary("claude")) {
  console.error("claude is not on PATH.");
  process.exit(1);
}

const repository = repositoryFromEnv();
const fixture = ensureFixturePr(repository);
const pr = String(fixture.number);
const originalBody = gh(["pr", "view", pr, "--repo", repository, "--json", "body", "--jq", ".body"]).trimEnd();
const prBody = () => gh(["pr", "view", pr, "--repo", repository, "--json", "body", "--jq", ".body"]).trimEnd();

// Captures live under the repository because SKILL.md tells the agent to run the
// formatter and gh from the same directory. The folder is removed afterwards.
const captures = join(root, "captures-agent-smoke");
rmSync(captures, { recursive: true, force: true });
mkdirSync(captures);
writeFileSync(join(captures, "desktop-before.png"), makePng(40, 60, [220, 40, 40]));
writeFileSync(join(captures, "desktop-after.png"), makePng(80, 60, [40, 80, 220]));

const prompt = [
  `Use the before-and-after skill to add a Desktop before/after block to pull request #${pr} in ${repository}.`,
  "The screenshots already exist at captures-agent-smoke/desktop-before.png and captures-agent-smoke/desktop-after.png.",
  "Do not open a browser or capture anything new. Do not change any other text in the PR description.",
  "When finished, reply with the single word DONE.",
].join(" ");

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const started = Date.now();
  const raw = execFileSync(
    "claude",
    [
      "-p",
      prompt,
      "--permission-mode",
      "dontAsk",
      "--allowedTools",
      "Bash,Read,Glob,Grep,Skill",
      "--max-turns",
      String(process.env.VERIFY_AGENT_MAX_TURNS ?? 25),
      "--output-format",
      "json",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 },
  );
  const result = JSON.parse(raw);
  const seconds = Math.round((Date.now() - started) / 1000);

  const body = prBody();
  const markers = (body.match(/<!-- before-and-after:start -->/g) ?? []).length;
  expect(markers === 1, `agent left ${markers} marker blocks in the description`);
  expect(body.startsWith(originalBody), "agent altered the prose above the evidence block");
  expect(!/\]\(\.\/[^)]+\)/.test(body), "agent left local ./ references in the description");
  const block = body.slice(body.indexOf("<!-- before-and-after:start -->"), body.indexOf("<!-- before-and-after:end -->"));
  expect(block.includes("| Before (Desktop) | After (Desktop) |"), "agent did not produce the labelled Desktop table");
  expect((block.match(ATTACHMENT_URL) ?? []).length === 2, "agent did not upload both screenshots");

  console.log(
    `Agent smoke passed on ${repository}#${pr} in ${seconds}s, ${result.num_turns ?? "?"} turns, $${(result.total_cost_usd ?? 0).toFixed(2)} (session ${result.session_id}).`,
  );
} finally {
  rmSync(captures, { recursive: true, force: true });
  writeFileSync(join(root, "captures-agent-smoke.original.md"), originalBody);
  try {
    gh(["pr", "edit", pr, "--repo", repository, "--body-file", "captures-agent-smoke.original.md"]);
  } finally {
    rmSync(join(root, "captures-agent-smoke.original.md"), { force: true });
  }
}
