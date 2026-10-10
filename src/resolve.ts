import { resolveOrgAndProjectId, resolvePipelineDefinitionId } from "./circleci.ts";
import type { ParsedArgs } from "./types.ts";

type TrustArgs = Extract<ParsedArgs, { kind: "trust" }>;

/** External effects used while resolving CircleCI options; injectable for tests. */
export interface ResolveDeps {
  resolveOrgAndProjectId: typeof resolveOrgAndProjectId;
  resolvePipelineDefinitionId: typeof resolvePipelineDefinitionId;
  log: (message: string) => void;
}

export const defaultResolveDeps: ResolveDeps = {
  resolveOrgAndProjectId,
  resolvePipelineDefinitionId,
  log: (message) => console.error(message),
};

/**
 * Fill in missing CircleCI UUIDs via the CircleCI API when a token is available.
 * Explicitly provided UUIDs are never overwritten. No-op for other providers.
 */
export async function resolveCircleciOptions(
  parsed: TrustArgs,
  deps: ResolveDeps = defaultResolveDeps,
): Promise<void> {
  const opts = parsed.options;
  if (opts.provider !== "circleci") return;
  // Skipped on --dry-run since npm is not invoked and no real execution happens.
  if (parsed.dryRun || !opts.circleToken) return;
  if (!opts.orgId || !opts.projectId) {
    deps.log("Resolving org-id and project-id via CircleCI API...");
    const resolved = await deps.resolveOrgAndProjectId(opts.circleToken, opts.vcsOrigin);
    opts.orgId ??= resolved.orgId;
    opts.projectId ??= resolved.projectId;
  }
  if (!opts.pipelineDefinitionId) {
    deps.log("Resolving pipeline-definition-id via CircleCI API...");
    opts.pipelineDefinitionId = await deps.resolvePipelineDefinitionId(
      opts.circleToken,
      opts.projectId!,
      opts.file,
    );
  }
}
