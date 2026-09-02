#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const skill = readFileSync(resolve(root, "skill/SKILL.md"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const scripts = readdirSync(resolve(root, "skill/scripts")).sort();

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(scripts.length === 1 && scripts[0] === "format.mjs", "skill/scripts must contain only format.mjs");
assert(packageJson.files?.length === 1 && packageJson.files[0] === "skill", "npm package must ship only skill/");
assert(!packageJson.bin, "the package must not expose a CLI alias");
assert(!packageJson.peerDependencies?.["agent-browser"], "agent-browser must not be a package dependency");
assert(skill.includes("agent-browser skills get core --full"), "SKILL.md must delegate capture to the bundled core skill");
assert(
  skill.includes("agent-browser skills get protected-vercel-deployments --full"),
  "SKILL.md must delegate protected Preview access to the bundled Vercel skill",
);
assert(!skill.includes("x-vercel-protection-bypass"), "SKILL.md must not duplicate Vercel bypass mechanics");
assert(!skill.includes("x-vercel-trusted-oidc-idp-token"), "SKILL.md must not duplicate Vercel OIDC mechanics");
assert(skill.includes("fresh browser context"), "SKILL.md must explain the protected recording-context boundary");
assert(skill.includes("--after-video-url"), "SKILL.md must document the final-URL video-table phase");
assert(skill.includes("10 fps"), "SKILL.md must disclose agent-browser's current native recording cadence");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("Skill boundary verified.");
