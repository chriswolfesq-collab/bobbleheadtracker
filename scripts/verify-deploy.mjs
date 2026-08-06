// Confirms a pushed commit actually reached production, and says which of the
// two ways it can fail happened.
//
// Run:  node scripts/verify-deploy.mjs              # HEAD
//       node scripts/verify-deploy.mjs <sha|ref>    # a specific commit
//       npm run verify-deploy
//
// Why this exists: on 2026-08-04 a push to main (4d14cfa) was silently dropped
// by Vercel's GitHub App — no deployment record, no queue entry, no failure.
// Production kept serving the previous commit. Watching the commit *status* for
// that push was useless: a build that never starts posts no status, so "no
// deployment" and "still building" both look like silence. This polls the thing
// that actually distinguishes them — whether a deployment record exists at all —
// and only then waits on its outcome.
//
// The delivery log that would show the dropped webhook belongs to Vercel, not to
// this repo (there are no repo webhooks; it's a GitHub App), so it can't be read
// from here. This is the next best thing: notice the gap and name the remedy.
//
// Not covered: whether the alias actually flipped to the new build. Checking that
// means fetching bobbleshelf.com, which serves a bot challenge to anything
// without a real browser — verify that by loading the site and reading the
// `?dpl=` id on its script tags.
//
// Exit codes:  0 deployed and succeeded    2 no deployment was ever created
//              1 the build failed          3 still building when time ran out

import { execFileSync } from "node:child_process";

// Overridable so the slow paths can be exercised without waiting them out.
const num = (name, fallback) => Number(process.env[name]) || fallback;
const GRACE_MS = num("VERIFY_DEPLOY_GRACE_MS", 5 * 60_000); // a healthy build is recorded well inside this
const BUDGET_MS = num("VERIFY_DEPLOY_BUDGET_MS", 20 * 60_000); // total wait, including the build itself
const POLL_MS = num("VERIFY_DEPLOY_POLL_MS", 15_000);

function gh(path) {
  const out = execFileSync("gh", ["api", path], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** owner/repo from the origin remote, so this isn't pinned to one fork. */
function repoSlug() {
  const url = git("remote", "get-url", "origin");
  const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match) throw new Error(`origin doesn't look like a GitHub remote: ${url}`);
  return match[1];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The most recent status wins: GitHub appends them, so a deployment that goes
// in_progress → success has both on record, newest first.
//
// `inactive` is skipped rather than treated as an outcome — GitHub uses it to
// mark a deployment superseded by a later one, which says nothing about whether
// this build passed. Vercel doesn't appear to post it on this project, but it is
// a documented state, and reading it as "not finished yet" would time out a
// commit that deployed perfectly well.
function latestState(repo, deploymentId) {
  const statuses = gh(`repos/${repo}/deployments/${deploymentId}/statuses?per_page=100`);
  const decisive = statuses.find((status) => status.state !== "inactive");
  return decisive ? decisive.state : "pending";
}

async function main() {
  const ref = process.argv[2] ?? "HEAD";
  const sha = git("rev-parse", ref);
  const short = sha.slice(0, 7);
  const repo = repoSlug();
  const subject = git("log", "-1", "--format=%s", sha);

  console.log(`Verifying ${short} — ${subject}`);
  console.log(`  repo: ${repo}`);

  // A commit that isn't on the remote can't deploy, and that mistake is easy to
  // make and slow to notice. Catch it before spending twenty minutes on it.
  try {
    git("merge-base", "--is-ancestor", sha, "origin/main");
  } catch {
    console.error(`\n✗ ${short} is not an ancestor of origin/main — is it pushed?`);
    console.error("  Run: git fetch origin && git push origin main");
    process.exit(2);
  }

  const startedAt = Date.now();
  let warnedAboutGrace = false;

  for (;;) {
    const deployments = gh(`repos/${repo}/deployments?sha=${sha}&per_page=10`);
    const elapsed = Date.now() - startedAt;

    if (deployments.length === 0) {
      if (elapsed > BUDGET_MS) {
        console.error(`\n✗ No deployment was ever created for ${short}.`);
        console.error("  Vercel's GitHub App did not pick up the push — this is the");
        console.error("  silent-drop case, not a slow build. Nothing is queued, so it");
        console.error("  will not resolve on its own.");
        console.error("\n  Re-trigger with an empty commit (no code change):");
        console.error("    git commit --allow-empty -m 'Re-trigger the deploy Vercel missed'");
        console.error("    git push origin main");
        console.error("\n  Do NOT run `vercel deploy` to fix this: it uploads the working");
        console.error("  tree, which may hold other sessions' uncommitted work.");
        process.exit(2);
      }
      if (elapsed > GRACE_MS && !warnedAboutGrace) {
        warnedAboutGrace = true;
        const mins = Math.round(elapsed / 60_000);
        console.log(`  … still no deployment record after ${mins}m — a healthy build`);
        console.log("    is usually recorded within a minute. Likely dropped; waiting");
        console.log("    out the rest of the budget before calling it.");
      } else if (!warnedAboutGrace) {
        console.log("  … waiting for a deployment record");
      }
      await sleep(POLL_MS);
      continue;
    }

    const deployment = deployments[0];
    const state = latestState(repo, deployment.id);

    if (state === "success") {
      console.log(`\n✓ ${short} deployed (${deployment.environment}).`);
      console.log(`  Confirm what's serving by loading the site and reading the`);
      console.log(`  \`?dpl=\` id on its script tags.`);
      process.exit(0);
    }
    if (state === "failure" || state === "error") {
      console.error(`\n✗ The build for ${short} ended in "${state}".`);
      console.error("  The deployment exists, so this is a real build failure, not a");
      console.error("  dropped push. Check the logs:");
      console.error(`    gh api repos/${repo}/commits/${short}/status --jq '.statuses[0].target_url'`);
      process.exit(1);
    }
    if (elapsed > BUDGET_MS) {
      console.error(`\n✗ Timed out: ${short} is still "${state}" after ${Math.round(BUDGET_MS / 60_000)}m.`);
      console.error("  The deployment exists, so it wasn't dropped — it's just slow or stuck.");
      process.exit(3);
    }

    console.log(`  … ${state}`);
    await sleep(POLL_MS);
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  if (String(error.message).includes("ENOENT")) {
    console.error("  This needs the GitHub CLI: https://cli.github.com (then `gh auth login`).");
  }
  process.exit(1);
});
