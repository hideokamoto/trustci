import { describe, expect, mock, test } from "bun:test";
import { resolveCircleciOptions, type ResolveDeps } from "../src/resolve.ts";
import type { CircleciOptions, ParsedArgs } from "../src/types.ts";

type TrustArgs = Extract<ParsedArgs, { kind: "trust" }>;

function trust(over: Partial<CircleciOptions> = {}, dryRun = false): TrustArgs {
  return {
    kind: "trust",
    dryRun,
    only: [],
    exclude: [],
    options: {
      provider: "circleci",
      vcsOrigin: "github.com/me/repo",
      contextIds: [],
      allowPublish: true,
      allowStagePublish: false,
      yes: false,
      ...over,
    },
  };
}

function deps(): ResolveDeps {
  return {
    resolveOrgAndProjectId: mock(async () => ({ orgId: "org-api", projectId: "proj-api" })),
    resolvePipelineDefinitionId: mock(async () => "pipe-api"),
    log: () => {},
  };
}

describe("resolveCircleciOptions", () => {
  for (const dryRun of [false, true]) {
    test(`fills missing UUIDs from the API with a token (dryRun=${dryRun})`, async () => {
      const p = trust({ circleToken: "t" }, dryRun);
      await resolveCircleciOptions(p, deps());
      expect(p.options).toMatchObject({ orgId: "org-api", projectId: "proj-api", pipelineDefinitionId: "pipe-api" });
    });
  }

  test("never overwrites explicitly provided UUIDs", async () => {
    const d = deps();
    const p = trust({ circleToken: "t", orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    await resolveCircleciOptions(p, d);
    expect(p.options).toMatchObject({ orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    expect(d.resolveOrgAndProjectId).not.toHaveBeenCalled();
    expect(d.resolvePipelineDefinitionId).not.toHaveBeenCalled();
  });
});
