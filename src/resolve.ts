import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CircleApiError, resolveOrgAndProjectId, resolvePipelineDefinitionId } from "./circleci.ts";
import { run } from "./exec.ts";
import { resolveCircleToken, TOKEN_SOURCES } from "./token.ts";
import { repositoryFromPackageJson, resolveVcsOrigin } from "./vcs.ts";
import type { ParsedArgs } from "./types.ts";

type TrustArgs = Extract<ParsedArgs, { kind: "trust" }>;

/** External effects used while resolving CircleCI options; injectable for tests. */
export interface ResolveDeps {
  resolveOrgAndProjectId: typeof resolveOrgAndProjectId;
  resolvePipelineDefinitionId: typeof resolvePipelineDefinitionId;
  log: (message: string) => void;
  env: Record<string, string | undefined>;
  homedir: string;
  readFile: (path: string) => string | null;
  /** Repository root whose package.json `repository` is consulted. */
  cwd: string;
  /** `git remote get-url origin`, or null when unavailable. */
  gitRemoteUrl: () => string | null;
}

export const defaultResolveDeps: ResolveDeps = {
  resolveOrgAndProjectId,
  resolvePipelineDefinitionId,
  log: (message) => console.error(message),
  env: process.env,
  homedir: homedir(),
  readFile: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  },
  cwd: process.cwd(),
  gitRemoteUrl: () => {
    const r = run("git", ["remote", "get-url", "origin"]);
    return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
  },
};

/** Fill in --vcs-origin from package.json or git when it was not given. */
function resolveMissingVcsOrigin(opts: { vcsOrigin?: string }, deps: ResolveDeps): string {
  if (opts.vcsOrigin) return opts.vcsOrigin;
  let pkgRepository: string | undefined;
  const pkgText = deps.readFile(join(deps.cwd, "package.json"));
  if (pkgText !== null) {
    try {
      pkgRepository = repositoryFromPackageJson((JSON.parse(pkgText) as { repository?: unknown }).repository);
    } catch {
      deps.log("warning: could not parse package.json while looking for a repository");
    }
  }
  const found = resolveVcsOrigin({ pkgRepository, gitRemote: deps.gitRemoteUrl() });
  for (const w of found.warnings) deps.log(`warning: ${w}`);
  if (found.value === undefined) {
    throw new Error(
      "--vcs-origin is required for --provider circleci and could not be inferred " +
        "(looked in: package.json repository, git remote origin). Pass e.g. --vcs-origin github.com/org/repo.",
    );
  }
  deps.log(`vcs-origin: ${found.value} (from ${found.source})`);
  opts.vcsOrigin = found.value;
  return found.value;
}

/**
 * Fill in a missing --vcs-origin (from package.json or git) and missing CircleCI
 * UUIDs (via the CircleCI API). Explicit values are never overwritten, and no
 * token is looked up when no UUID is missing. No-op for other providers.
 */
export async function resolveCircleciOptions(
  parsed: TrustArgs,
  deps: ResolveDeps = defaultResolveDeps,
): Promise<void> {
  const opts = parsed.options;
  if (opts.provider !== "circleci") return;
  const vcsOrigin = resolveMissingVcsOrigin(opts, deps);

  const missing = [
    !opts.orgId && "--org-id",
    !opts.projectId && "--project-id",
    !opts.pipelineDefinitionId && "--pipeline-definition-id",
  ].filter((m): m is string => Boolean(m));
  if (missing.length === 0) return;

  // Also runs on --dry-run: these are read-only GETs, and the printed commands
  // would otherwise contain empty UUIDs.
  const found = resolveCircleToken({
    flag: opts.circleToken,
    env: deps.env,
    homedir: deps.homedir,
    readFile: deps.readFile,
  });
  for (const note of found.notes) deps.log(`note: ${note}`);
  if (found.token === undefined) {
    throw new Error(
      `missing ${missing.join(", ")} for --provider circleci. Pass them explicitly, ` +
        `or provide a CircleCI API token so they can be resolved (looked in: ${TOKEN_SOURCES.join(", ")}).`,
    );
  }
  const { token, source } = found;
  deps.log(`Using CircleCI token from ${source}`);

  try {
    if (!opts.orgId || !opts.projectId) {
      deps.log("Resolving org-id and project-id via CircleCI API...");
      const resolved = await deps.resolveOrgAndProjectId(token, vcsOrigin);
      opts.orgId ??= resolved.orgId;
      opts.projectId ??= resolved.projectId;
    }
    if (!opts.pipelineDefinitionId) {
      deps.log("Resolving pipeline-definition-id via CircleCI API...");
      opts.pipelineDefinitionId = await deps.resolvePipelineDefinitionId(token, opts.projectId!, opts.file);
    }
  } catch (err) {
    if (err instanceof CircleApiError && (err.status === 401 || err.status === 403)) {
      throw new Error(
        `CircleCI rejected the token from ${source} (${err.status}). ` +
          `Pass a valid token with --circle-token or the CIRCLE_TOKEN environment variable.`,
      );
    }
    throw err;
  }
}
