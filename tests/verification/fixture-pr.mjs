#!/usr/bin/env node
/**
 * Find or create the permanent verification fixture PR.
 *
 * The GitHub smoke needs a pull request whose description it may rewrite. Rather
 * than opening a new PR per run (closed PRs are permanent), one draft PR stays
 * open forever and every run restores its body when it finishes.
 *
 * Prints the PR number. Safe to run repeatedly.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gh, root } from "./lib.mjs";

export const FIXTURE_BRANCH = "verification-fixture";
export const FIXTURE_TITLE = "Verification fixture (keep open, do not merge)";
export const FIXTURE_BODY = `# Verification fixture

This pull request stays open so \`pnpm verify:github\` has a real description to edit, verify, and restore. Do not merge it, close it, or edit its description by hand. If a run is interrupted, re-run \`pnpm fixture:pr\` to restore this text.

## Summary

Prose above the evidence block. The smoke asserts this paragraph survives every publish.

## Notes

Prose below the evidence block. The smoke asserts this paragraph survives every publish, too.
`;

export function repositoryFromEnv() {
  return process.env.FIXTURE_REPO ?? gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim();
}

/**
 * The repository requires signed commits, so the fixture branch is committed through
 * local git (which applies the developer's signing config) rather than the contents API.
 * Uses a temporary worktree so the current checkout is never touched.
 */
function pushFixtureBranch(defaultBranch) {
  const git = (args, options = {}) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", ...options });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
    return result.stdout;
  };
  const worktree = mkdtempSync(join(tmpdir(), "before-and-after-fixture-"));
  git(["fetch", "--quiet", "origin", defaultBranch]);
  git(["worktree", "add", "--quiet", "--detach", worktree, `origin/${defaultBranch}`]);
  try {
    mkdirSync(join(worktree, "tests/fixtures"), { recursive: true });
    writeFileSync(
      join(worktree, "tests/fixtures/VERIFICATION_FIXTURE.md"),
      "This branch exists only to keep the verification fixture pull request open.\n",
    );
    git(["add", "tests/fixtures/VERIFICATION_FIXTURE.md"], { cwd: worktree });
    git(["commit", "--quiet", "-m", "Add verification fixture marker"], { cwd: worktree });
    git(["push", "--quiet", "--force", "origin", `HEAD:refs/heads/${FIXTURE_BRANCH}`], { cwd: worktree });
  } finally {
    git(["worktree", "remove", "--force", worktree]);
  }
}

export function findFixturePr(repository) {
  const open = JSON.parse(
    gh(["pr", "list", "--repo", repository, "--head", FIXTURE_BRANCH, "--state", "open", "--json", "number,body,url"]),
  );
  return open[0] ?? null;
}

export function ensureFixturePr(repository) {
  const existing = findFixturePr(repository);
  if (existing) return existing;

  const defaultBranch = gh(["repo", "view", repository, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]).trim();
  let ahead = 0;
  try {
    ahead = Number(gh(["api", `repos/${repository}/compare/${defaultBranch}...${FIXTURE_BRANCH}`, "--jq", ".ahead_by"]).trim());
  } catch {
    ahead = 0; // branch does not exist yet
  }
  if (ahead === 0) pushFixtureBranch(defaultBranch);

  const url = gh([
    "pr",
    "create",
    "--repo",
    repository,
    "--draft",
    "--head",
    FIXTURE_BRANCH,
    "--title",
    FIXTURE_TITLE,
    "--body",
    FIXTURE_BODY,
  ]).trim();
  const number = Number(url.match(/\/pull\/(\d+)/)?.[1]);
  return { number, body: FIXTURE_BODY, url };
}

export function restoreFixtureBody(repository, number) {
  gh(["pr", "edit", String(number), "--repo", repository, "--body", FIXTURE_BODY]);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").at(-1))) {
  const repository = repositoryFromEnv();
  const pr = ensureFixturePr(repository);
  if (pr.body.trim() !== FIXTURE_BODY.trim()) {
    restoreFixtureBody(repository, pr.number);
    console.error(`Restored the fixture description on ${repository}#${pr.number}`);
  }
  console.log(pr.number);
}
