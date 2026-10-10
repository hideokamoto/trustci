import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { CircleApiError, resolveOrgAndProjectId, resolvePipelineDefinitionId } from "./circleci.ts";
import { resolveCircleToken, TOKEN_SOURCES } from "./token.ts";
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
};

/**
 * Fill in missing CircleCI UUIDs via the CircleCI API. Explicitly provided UUIDs
 * are never overwritten, and no token is looked up when none are missing.
 * No-op for other providers.
 */
export async function resolveCircleciOptions(
  parsed: TrustArgs,
  deps: ResolveDeps = defaultResolveDeps,
): Promise<void> {
  const opts = parsed.options;
  if (opts.provider !== "circleci") return;

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
      const resolved = await deps.resolveOrgAndProjectId(token, opts.vcsOrigin);
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
