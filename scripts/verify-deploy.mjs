// Confirms a pushed commit actually reached production, and says which of the
// two ways it can fail happened.
//
// Run:  node scripts/verify-deploy.mjs              # HEAD
//       node scripts/verify-deploy.mjs <sha|ref>    # a specific commit
//       npm run verify-deploy
//
// Why this exists: on 2026-08-04 a push to main (4d14cfa) was silently dropped
// by Vercel's GitHub App — no deployment record, no queue entry, no failure.
// Production kept serving the previous commit. The trap is that the rollup
// `commits/<sha>/status` reports "pending" both for a build in flight and for a
// push nothing ever picked up, so the two look identical there.
//
// They are not identical one level down. Vercel posts a *pending commit status*
// on a push it has accepted, long before the build ends, so the question "was
// this push picked up at all" is answered by whether any Vercel status exists —
// not by how long we have been waiting. Of the 94 pushes on record, 93 have one;
// the 94th is 4d14cfa, which has no status and no deployment record, forever.
//
// Waiting on the deployment *record* to make that call is what the earlier
// version did, and it cannot work: Vercel creates the record when the build
// finishes, not when it starts (measured record -> success: 0s, 1s), so "no
// record yet" is the normal state for the entire length of a build. With
// push -> record running p50 181s / max 581s against a 5m grace, roughly one
// healthy deploy in ten was announced as "likely dropped".
//
// On how long acknowledgement takes, trust little: deriving it from the GitHub
// events API gives push -> status of p50 2s / max 5s, and those numbers are not
// real. That API does not timestamp the push instant — one sample comes out at
// -462s (a status before its own push) and four more at under a second, which no
// webhook round trip achieves. The one measurement taken against a clock we
// control, the push of cad6fb9, was 46s. So ACK_MS is set with a wide margin
// rather than a tight multiple of a distribution that can't be trusted.
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
// Exit codes:  0 deployed and succeeded    2 the push was never picked up
//              1 the build failed          3 still building when time ran out

import { execFileSync } from "node:child_process";

// Overridable so the slow paths can be exercised without waiting them out.
const num = (name, fallback) => Number(process.env[name]) || fallback;
// How long to allow for Vercel to acknowledge the push at all. Deliberately
// generous: the cost of firing early is telling someone to push an empty commit
// over a deploy that was fine, while the cost of firing late is a few more
// minutes of waiting on a case that never resolves anyway. A healthy push has
// acknowledged (46s observed) and usually finished deploying (2m39s) well inside
// this, so in practice a green run exits before the deadline is ever consulted.
//
// Same number as the grace it replaces, and worth being clear that the number is
// not the fix — the signal is. At 5m the old check was still waiting on a record
// that normally doesn't exist yet; this one is waiting on a status that arrives
// before the build does.
const ACK_MS = num("VERIFY_DEPLOY_ACK_MS", 5 * 60_000);
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

// Vercel's own statuses on the commit, newest first — the acknowledgement signal.
// GitHub Actions reports through the Checks API rather than this one, so on this
// repo the statuses list is Vercel's alone; the filter is there so that a second
// status provider added later can't stand in for Vercel having picked the push up.
function vercelStatuses(repo, sha) {
  const statuses = gh(`repos/${repo}/commits/${sha}/statuses?per_page=100`);
  return {
    mine: statuses.filter((status) => /vercel/i.test(status.context ?? "")),
    anyContext: statuses.map((status) => status.context),
  };
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
  let announcedPickup = false;

  for (;;) {
    const elapsed = Date.now() - startedAt;
    // Re-read every poll rather than latching: this is the acknowledgement
    // signal *and* the outcome signal, and a build that fails ten minutes in
    // needs to be caught on the poll it fails, not on the one that saw it start.
    const { mine, anyContext } = vercelStatuses(repo, sha);

    if (mine.length === 0) {
      if (elapsed > ACK_MS) {
        console.error(`\n✗ Vercel never picked up the push of ${short}.`);
        console.error(
          `  No Vercel commit status after ${Math.round(elapsed / 1000)}s. It posts one`,
        );
        console.error("  well before a build finishes — under a minute, in the last case");
        console.error("  measured — so this is the silent-drop case, not a slow build.");
        console.error("  Nothing is queued, so it will not resolve on its own.");
        if (anyContext.length > 0) {
          console.error(`\n  Statuses that DO exist: ${anyContext.join(", ")}.`);
          console.error("  If Vercel's status context was renamed, this script is looking");
          console.error("  for the wrong one — check that before pushing an empty commit.");
        }
        console.error("\n  Re-trigger with an empty commit (no code change):");
        console.error("    git commit --allow-empty -m 'Re-trigger the deploy Vercel missed'");
        console.error("    git push origin main");
        console.error("\n  Do NOT run `vercel deploy` to fix this: it uploads the working");
        console.error("  tree, which may hold other sessions' uncommitted work.");
        process.exit(2);
      }
      console.log("  … waiting for Vercel to pick up the push");
      await sleep(POLL_MS);
      continue;
    }

    if (!announcedPickup) {
      announcedPickup = true;
      console.log("  … picked up by Vercel; building");
    }

    const state = mine[0].state;

    if (state === "failure" || state === "error") {
      console.error(`\n✗ The build for ${short} ended in "${state}".`);
      console.error("  Vercel picked the push up, so this is a real build failure, not");
      console.error("  a dropped push. Check the logs:");
      console.error(`    ${mine[0].target_url ?? `gh api repos/${repo}/commits/${short}/status`}`);
      process.exit(1);
    }

    if (state === "success") {
      // The record carries the environment name, and Vercel creates it as the
      // build lands — so it is normally here by now. If this particular poll
      // caught the gap, the status is still decisive; just say less.
      const deployments = gh(`repos/${repo}/deployments?sha=${sha}&per_page=10`);
      const deployment = deployments[0];
      const environment =
        deployment && latestState(repo, deployment.id) === "success"
          ? ` (${deployment.environment})`
          : "";

      console.log(`\n✓ ${short} deployed${environment}.`);
      console.log("  Confirm what's serving by loading the site and reading the");
      console.log("  `?dpl=` id on its script tags.");
      process.exit(0);
    }

    if (elapsed > BUDGET_MS) {
      console.error(
        `\n✗ Timed out: ${short} is still "${state}" after ${Math.round(BUDGET_MS / 60_000)}m.`,
      );
      console.error("  Vercel picked it up, so it wasn't dropped — it's slow or stuck.");
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
