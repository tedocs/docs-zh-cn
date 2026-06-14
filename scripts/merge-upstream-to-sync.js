import SimpleGit from "simple-git";
import { appendFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const UPSTREAM_BRANCH = process.env.UPSTREAM_BRANCH || "main";
const SYNC_BRANCH = process.env.SYNC_BRANCH || "sync";

const git = SimpleGit(ROOT);

// ── Helpers ──────────────────────────────────────────────────────

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`::set-output name=${key}::${value}`);
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  await git.fetch("origin");

  // Ensure sync branch exists
  const branches = await git.branchLocal();
  if (!branches.all.includes(SYNC_BRANCH)) {
    console.log(`Creating ${SYNC_BRANCH} branch from origin/main...`);
    await git.checkoutBranch(SYNC_BRANCH, "origin/main");
  } else {
    await git.checkout(SYNC_BRANCH);
  }

  // Get upstream hash
  const upstreamHash = (
    await git.raw(["rev-parse", "--short", "origin/" + UPSTREAM_BRANCH])
  ).trim();
  console.log(`Upstream hash: ${upstreamHash}`);

  // Attempt merge
  console.log(`Merging origin/${UPSTREAM_BRANCH} into ${SYNC_BRANCH}...`);
  let mergeResult;
  let conflictFiles = [];
  let changedFiles = [];

  try {
    await git.merge([`origin/${UPSTREAM_BRANCH}`], { "--no-edit": null });
    console.log("Merge completed without conflicts.");
    mergeResult = "clean";
  } catch (err) {
    if (!err.message?.includes("CONFLICT")) {
      throw err;
    }
    console.log("Merge has conflicts.");

    // Collect conflicted files
    const diffOutput = await git.raw(["diff", "--name-only", "--diff-filter=U"]);
    conflictFiles = diffOutput.split("\n").filter(Boolean);
    console.log(`Conflicted files (${conflictFiles.length}):`);
    conflictFiles.forEach((f) => console.log(`  ${f}`));

    mergeResult = "conflict";

    // Abort merge so the Copilot agent can redo it cleanly
    await git.merge(["--abort"]);
    console.log("Merge aborted — Copilot agent will redo the merge.");
  }

  // Detect changed .md files by comparing sync and upstream branches
  const diff = await git.diff([
    "--name-only",
    "--diff-filter=ACMR",
    SYNC_BRANCH,
    `origin/${UPSTREAM_BRANCH}`,
    "--",
    "src/**/*.md",
  ]);
  changedFiles = diff.split("\n").filter(Boolean);
  console.log(`Changed markdown files (${changedFiles.length}):`);
  changedFiles.forEach((f) => console.log(`  ${f}`));

  if (mergeResult === "clean" && changedFiles.length === 0 && conflictFiles.length === 0) {
    mergeResult = "no_changes";
    console.log("No content changes detected.");
  }

  // Write outputs
  setOutput("merge_result", mergeResult);
  setOutput("conflict_files", conflictFiles.join(","));
  setOutput("changed_files", changedFiles.join(","));
  setOutput("upstream_hash", upstreamHash);

  console.log(`\nResult: merge_result=${mergeResult}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
