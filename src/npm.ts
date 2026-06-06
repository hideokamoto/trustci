import { run } from "./exec.ts";
import type { CommonOptions, ProviderOptions } from "./types.ts";

export const MIN_NODE = "22.14.0";
export const MIN_NPM = "11.5.1";

/** Compare dotted version strings. Returns -1, 0, or 1. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function getNpmVersion(): string | null {
  const r = run("npm", ["--version"]);
  if (r.status !== 0) return null;
  const v = r.stdout.trim();
  return v || null;
}

/**
 * Guard against unsupported Node/npm. Returns an error message, or null if the
 * environment satisfies the trusted-publishing requirements.
 */
export function checkVersions(): string | null {
  const node = process.versions.node;
  if (cmpVersion(node, MIN_NODE) < 0) {
    return `trustci requires Node ${MIN_NODE} or later (found ${node}).`;
  }
  const npm = getNpmVersion();
  if (!npm) {
    return "Could not determine the npm version. Is npm installed and on your PATH?";
  }
  if (cmpVersion(npm, MIN_NPM) < 0) {
    return (
      `trustci requires npm ${MIN_NPM} or later for trusted publishing (found ${npm}).\n` +
      "Update with: npm install -g npm@latest"
    );
  }
  return null;
}

/** Whether a package name already exists on the registry. */
export function isPublished(name: string): boolean {
  const r = run("npm", ["view", name, "version"]);
  if (r.status === 0) {
    return r.stdout.trim().length > 0;
  }
  // A 404 genuinely means "not published yet". Any other failure (network
  // outage, auth error, registry down) must not be silently treated as
  // unpublished, or we would skip packages that actually need registering.
  if (r.stderr.includes("E404") || r.stderr.includes("404 Not Found")) {
    return false;
  }
  throw new Error(`failed to check the registry for ${name}: ${r.stderr.trim() || "unknown error"}`);
}

function commonFlags(o: CommonOptions): string[] {
  const a: string[] = [];
  if (o.allowPublish) a.push("--allow-publish");
  if (o.allowStagePublish) a.push("--allow-stage-publish");
  if (o.yes) a.push("-y");
  return a;
}

/**
 * Build the argument vector (after the `npm` binary) for an `npm trust`
 * invocation registering `pkg` with the given provider configuration.
 */
export function buildTrustArgs(o: ProviderOptions, pkg: string): string[] {
  const args = ["trust", o.provider, pkg];
  switch (o.provider) {
    case "github":
      args.push("--repository", o.repo, "--file", o.file);
      if (o.env) args.push("--environment", o.env);
      break;
    case "gitlab":
      args.push("--project", o.project, "--file", o.file);
      if (o.env) args.push("--environment", o.env);
      break;
    case "circleci":
      args.push(
        "--org-id",
        o.orgId,
        "--project-id",
        o.projectId,
        "--pipeline-definition-id",
        o.pipelineDefinitionId,
        "--vcs-origin",
        o.vcsOrigin,
      );
      for (const c of o.contextIds) args.push("--context-id", c);
      break;
  }
  args.push(...commonFlags(o));
  return args;
}

/** Quote a single argument for human-readable display only. */
function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%/:.,=+-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

/** Render an argv (without the leading binary) as a copy-pasteable command. */
export function displayCommand(args: string[]): string {
  return ["npm", ...args].map(shellQuote).join(" ");
}
