#!/usr/bin/env node
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { ArgError, parseCliArgs } from "./args.ts";
import { runInherit } from "./exec.ts";
import { buildTrustArgs, checkVersions, displayCommand, isPublished } from "./npm.ts";
import type { Pkg } from "./types.ts";
import { discoverPackages, filterPackages } from "./workspace.ts";

const VERSION = "0.1.0";

const HELP = `trustci — bulk-register npm Trusted Publishers across a monorepo

Usage:
  trustci [trust] --provider <github|gitlab|circleci> [provider flags] [options]
  trustci list [package] [--dry-run]

Providers:
  github     --repo <owner/repo> --file <workflow> [--env <name>]
  gitlab     --project <group/project> --file <workflow> [--env <name>]
             (--repo is accepted as an alias for --project)
  circleci   --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid>
             --vcs-origin <url> [--context-id <uuid> ...]

Permissions (at least one required):
  --allow-publish           allow npm publish
  --allow-stage-publish     allow npm stage publish

Options:
  --dry-run                 print the npm trust commands without executing them
  --only <name-glob>        only include packages matching (repeatable)
  --exclude <name-glob>     exclude packages matching (repeatable)
  -y, --yes                 skip the confirmation prompt (and npm's)
  -h, --help                show this help
  -v, --version             show the trustci version

Workspaces are detected from pnpm-workspace.yaml, package.json "workspaces",
or lerna.json. Private packages (\"private\": true) are always excluded.

Examples:
  trustci --dry-run --provider github --repo me/repo --file release.yml --allow-publish
  trustci --provider gitlab --project me/repo --file .gitlab-ci.yml --allow-publish -y
  trustci --provider circleci --org-id <uuid> --project-id <uuid> \\
    --pipeline-definition-id <uuid> --vcs-origin https://github.com/me/repo --allow-publish
  trustci list
`;

/** Prompt the user for a yes/no answer on the terminal. */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

/** Run `npm trust list` for a single package or every public workspace package. */
async function runList(pkg: string | undefined, dryRun: boolean): Promise<number> {
  const targets: string[] = [];
  if (pkg) {
    targets.push(pkg);
  } else {
    const { all, source } = discoverPackages(process.cwd());
    const pub = filterPackages(all, [], []);
    if (pub.length === 0) {
      console.error(`No public workspace packages found (detected via ${source}).`);
      return 1;
    }
    targets.push(...pub.map((p) => p.name));
  }
  let failures = 0;
  for (const name of targets) {
    const args = ["trust", "list", name];
    if (dryRun) {
      console.log(displayCommand(args));
    } else {
      console.error(`\n$ ${displayCommand(args)}`);
      if (runInherit("npm", args) !== 0) failures++;
    }
  }
  return failures > 0 ? 1 : 0;
}

/**
 * Discover and filter workspace packages, then register each with the provider
 * (or print the commands under --dry-run).
 */
async function runTrust(parsed: Extract<ReturnType<typeof parseCliArgs>, { kind: "trust" }>): Promise<number> {
  const root = process.cwd();
  const { all, source } = discoverPackages(root);
  if (all.length === 0) {
    console.error(`No workspace packages found (detected via ${source}).`);
    return 1;
  }
  const candidates = filterPackages(all, parsed.only, parsed.exclude);
  if (candidates.length === 0) {
    console.error(`No public packages matched (out of ${all.length} discovered via ${source}).`);
    return 1;
  }

  console.error(
    `Detected ${all.length} package(s) via ${source}; ${candidates.length} public after filters.`,
  );

  const provider = parsed.options.provider;

  if (parsed.dryRun) {
    console.log(`\n# ${candidates.length} command(s) for provider "${provider}" (dry run):\n`);
    for (const pkg of candidates) {
      console.log(displayCommand(buildTrustArgs(parsed.options, pkg.name)));
    }
    console.error("\n(dry run — registry publish-state was not checked and nothing was executed)");
    return 0;
  }

  // Real run: skip packages that are not yet published to the registry.
  const targets: Pkg[] = [];
  for (const pkg of candidates) {
    try {
      if (isPublished(pkg.name)) {
        targets.push(pkg);
      } else {
        console.warn(`skip ${pkg.name}: not published to the registry yet`);
      }
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      return 1;
    }
  }
  if (targets.length === 0) {
    console.error("Nothing to do: no published packages to register.");
    return 1;
  }

  console.error(`\nWill register ${targets.length} package(s) with ${provider}:`);
  for (const pkg of targets) console.error(`  - ${pkg.name}`);

  if (!parsed.options.yes) {
    if (!process.stdin.isTTY) {
      console.error(
        "error: confirmation required but stdin is not a TTY. Pass --yes (-y) to run non-interactively.",
      );
      return 1;
    }
    if (!(await confirm("\nProceed?"))) {
      console.error("Aborted.");
      return 1;
    }
  }

  let failures = 0;
  for (const pkg of targets) {
    const args = buildTrustArgs(parsed.options, pkg.name);
    console.error(`\n$ ${displayCommand(args)}`);
    const code = runInherit("npm", args);
    if (code !== 0) {
      failures++;
      console.error(`  ${pkg.name}: failed (exit ${code})`);
    }
  }
  console.error(`\nDone. ${targets.length - failures} succeeded, ${failures} failed.`);
  return failures > 0 ? 1 : 0;
}

/** Parse argv, run version guards, and dispatch to the right subcommand. */
async function main(): Promise<number> {
  let parsed: ReturnType<typeof parseCliArgs>;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof ArgError) {
      console.error(`error: ${err.message}\n`);
      console.error(HELP);
      return 1;
    }
    throw err;
  }

  if (parsed.kind === "help") {
    console.log(HELP);
    return 0;
  }
  if (parsed.kind === "version") {
    console.log(VERSION);
    return 0;
  }

  // Version guard. On --dry-run we warn but continue, since npm is not invoked.
  const verr = checkVersions();
  if (verr) {
    if (parsed.dryRun) {
      console.error(`warning: ${verr}\n(continuing because --dry-run does not execute npm)\n`);
    } else {
      console.error(`error: ${verr}`);
      return 1;
    }
  }

  return parsed.kind === "list" ? runList(parsed.pkg, parsed.dryRun) : runTrust(parsed);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err);
    process.exitCode = 1;
  },
);
