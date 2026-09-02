#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.env.VERIFY_GITHUB_MUTATION !== "1") {
  console.error("Refusing to mutate GitHub. Set VERIFY_GITHUB_MUTATION=1 explicitly.");
  process.exit(1);
}

const pr = process.env.PR_NUMBER;
if (!pr) {
  console.error("Set PR_NUMBER to a disposable pull request.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "../..");
const cwd = mkdtempSync(join(tmpdir(), "before-and-after-github-"));
const repository = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
writeFileSync(join(cwd, "before.png"), png);
writeFileSync(join(cwd, "after.png"), png);

const formatter = resolve(root, "skill/scripts/format.mjs");
const args = ["--before", "before.png", "--after", "after.png", "--label", "Attachment smoke"];
const body = execFileSync("node", [formatter, ...args], { cwd, encoding: "utf8" });
writeFileSync(join(cwd, "body.md"), body);

let commentId = null;
try {
  const url = execFileSync(
    "gh",
    ["pr", "comment", pr, "--repo", repository, "--body-file", "body.md", "--attach", "before.png", "--attach", "after.png"],
    { cwd, encoding: "utf8" },
  ).trim();
  const match = url.match(/#issuecomment-(\d+)$/);
  if (!match) throw new Error(`Could not parse comment URL: ${url}`);
  commentId = match[1];

  const renderedBody = execFileSync("gh", ["api", `repos/${repository}/issues/comments/${commentId}`, "--jq", ".body"], {
    cwd: root,
    encoding: "utf8",
  });
  if (renderedBody.includes("./before.png") || renderedBody.includes("./after.png")) {
    throw new Error("GitHub did not rewrite all local attachment references");
  }
  const attachmentCount = (renderedBody.match(/github\.com\/user-attachments\/assets\//g) ?? []).length;
  if (attachmentCount < 2) throw new Error("GitHub comment does not contain both attachment URLs");
  console.log(`GitHub attachment smoke passed: ${url}`);
} finally {
  if (commentId) {
    execFileSync("gh", ["api", "--method", "DELETE", `repos/${repository}/issues/comments/${commentId}`], {
      cwd: root,
      stdio: "ignore",
    });
  }
}
