#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./lib.mjs";

const skill = readFileSync(resolve(root, "skill/SKILL.md"), "utf8");
const formatter = readFileSync(resolve(root, "skill/scripts/format.mjs"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const scripts = readdirSync(resolve(root, "skill/scripts")).sort();

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

// Package boundary: the skill ships one script and nothing else executable.
assert(scripts.length === 1 && scripts[0] === "format.mjs", "skill/scripts must contain only format.mjs");
assert(packageJson.files?.length === 1 && packageJson.files[0] === "skill", "npm package must ship only skill/");
assert(!packageJson.bin, "the package must not expose a CLI alias");
assert(!packageJson.dependencies, "the skill must not have runtime dependencies");
assert(!packageJson.peerDependencies?.["agent-browser"], "agent-browser must not be a package dependency");

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))[0];
const unexpected = packed.files.map((file) => file.path).filter((path) => !/^(skill\/|package\.json$|README|LICENSE)/.test(path));
assert(unexpected.length === 0, `npm pack would publish files outside skill/: ${unexpected.join(", ")}`);

// Delegation boundary: capture and Vercel auth stay with agent-browser's own skills.
assert(skill.includes("agent-browser skills get core --full"), "SKILL.md must delegate capture to the bundled core skill");
assert(
  skill.includes("agent-browser skills get protected-vercel-deployments --full"),
  "SKILL.md must delegate protected Preview access to the bundled Vercel skill",
);
assert(!skill.includes("x-vercel-protection-bypass"), "SKILL.md must not duplicate Vercel bypass mechanics");
assert(!skill.includes("x-vercel-trusted-oidc-idp-token"), "SKILL.md must not duplicate Vercel OIDC mechanics");

// Docs ↔ CLI contract: every flag SKILL.md shows must exist in format.mjs, and every flag
// format.mjs accepts must be documented. This replaces asserting on specific sentences.
const optionsBlock = formatter.match(/options:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? "";
const cliFlags = new Set([...optionsBlock.matchAll(/^\s*"?([a-z-]+)"?:\s*\{/gm)].map((match) => match[1]));
const formatterInvocations = [...skill.matchAll(/format\.mjs[\s\S]*?(?=\n\s*\n|```)/g)].map((match) => match[0]);
const documentedFlags = new Set(formatterInvocations.flatMap((block) => [...block.matchAll(/--([a-z-]+)/g)].map((match) => match[1])));
assert(cliFlags.size > 0, "could not read parseArgs options from format.mjs");
for (const flag of documentedFlags) assert(cliFlags.has(flag), `SKILL.md documents --${flag}, which format.mjs does not accept`);
for (const flag of cliFlags) assert(documentedFlags.has(flag) || skill.includes(`--${flag}`), `format.mjs accepts --${flag}, which SKILL.md never documents`);

// Marker contract: the skill and the formatter agree on the replacement markers.
for (const marker of ["<!-- before-and-after:start -->", "<!-- before-and-after:end -->"]) {
  assert(formatter.includes(marker), `format.mjs must define ${marker}`);
}
assert(skill.includes("before-and-after:start/end"), "SKILL.md must name the marker block it replaces");

// Placement contract: judgment stays in the skill, and must cover safe anchoring,
// evidence hierarchy, preservation, and rendered-order verification.
const placement = skill.match(/## Place the evidence\n([\s\S]*?)\n## Publish/)?.[1] ?? "";
assert(placement, "SKILL.md must include a Place the evidence section before Publish");
for (const [phrase, message] of [
  ["existing Preview or deployment-link section", "placement must account for Preview or deployment links"],
  ["before implementation-heavy sections", "placement must precede implementation-heavy sections"],
  ["proves the PR first", "primary PR evidence must come first"],
  ["supplemental formats", "supplemental evidence must follow primary evidence"],
  ["as a demo", "skill demonstrations must be labeled as demos"],
  ["10 fps", "material recorder limitations must be disclosed"],
  ["preserve every byte of unrelated prose", "placement must preserve unrelated prose"],
  ["open the rendered PR", "placement must be verified in rendered GitHub"],
]) {
  assert(placement.includes(phrase), message);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log(`Skill boundary verified (${cliFlags.size} formatter flags documented, ${packed.files.length} files packed).`);
