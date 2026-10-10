import { describe, expect, mock, test } from "bun:test";
import { CircleApiError } from "../src/circleci.ts";
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

function deps(over: Partial<ResolveDeps> = {}): ResolveDeps & { logs: string[] } {
  const logs: string[] = [];
  return {
    resolveOrgAndProjectId: mock(async () => ({ orgId: "org-api", projectId: "proj-api" })),
    resolvePipelineDefinitionId: mock(async () => "pipe-api"),
    log: (m: string) => logs.push(m),
    env: {},
    homedir: "/home/u",
    readFile: () => null,
    cwd: "/repo",
    gitRemoteUrl: () => null,
    ...over,
    logs,
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

  test("with all UUIDs explicit, no token is looked up at all", async () => {
    let reads = 0;
    const d = deps({ readFile: () => (reads++, null) });
    const p = trust({ orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    await resolveCircleciOptions(p, d);
    expect(reads).toBe(0);
    expect(d.logs.join("\n")).not.toContain("token");
  });

  test("uses a token from the environment and reports where it came from", async () => {
    const d = deps({ env: { CIRCLE_TOKEN: "env-t" } });
    const p = trust();
    await resolveCircleciOptions(p, d);
    expect(d.resolveOrgAndProjectId).toHaveBeenCalledWith("env-t", "github.com/me/repo");
    expect(p.options).toMatchObject({ orgId: "org-api", projectId: "proj-api", pipelineDefinitionId: "pipe-api" });
    expect(d.logs.join("\n")).toContain("CIRCLE_TOKEN");
    expect(d.logs.join("\n")).not.toContain("env-t");
  });

  test("uses a token from ~/.circleci/cli.yml", async () => {
    const d = deps({ readFile: (path) => (path === "/home/u/.circleci/cli.yml" ? "token: file-t\n" : null) });
    await resolveCircleciOptions(trust(), d);
    expect(d.resolveOrgAndProjectId).toHaveBeenCalledWith("file-t", "github.com/me/repo");
    expect(d.logs.join("\n")).toContain("~/.circleci/cli.yml");
  });

  test("missing UUIDs and no token: names what is missing and where it looked", async () => {
    const p = trust({ orgId: "o" });
    const err = await resolveCircleciOptions(p, deps()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain("--project-id");
    expect(msg).toContain("--pipeline-definition-id");
    expect(msg).not.toContain("--org-id,");
    for (const where of ["--circle-token", "CIRCLE_TOKEN", "CIRCLECI_TOKEN", "CIRCLE_CLI_TOKEN", "CIRCLECI_CLI_TOKEN", "~/.circleci/cli.yml"]) {
      expect(msg).toContain(where);
    }
  });

  test("a rejected token names its source and how to override it", async () => {
    const d = deps({
      readFile: () => "token: stale\n",
      resolveOrgAndProjectId: mock(async () => {
        throw new CircleApiError(401, "/project/github/me/repo", '{"message":"Invalid token provided."}');
      }),
    });
    const err = await resolveCircleciOptions(trust(), d).catch((e: Error) => e);
    const msg = (err as Error).message;
    expect(msg).toContain("~/.circleci/cli.yml");
    expect(msg).toContain("401");
    expect(msg).toContain("--circle-token");
  });

  test("infers a missing --vcs-origin from package.json and reports the source", async () => {
    const d = deps({
      readFile: (path) => (path === "/repo/package.json" ? JSON.stringify({ repository: "github:o/r" }) : null),
    });
    const p = trust({ vcsOrigin: undefined, orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    await resolveCircleciOptions(p, d);
    expect(p.options).toMatchObject({ vcsOrigin: "github.com/o/r" });
    expect(d.logs.join("\n")).toContain("vcs-origin: github.com/o/r (from package.json repository)");
  });

  test("infers a missing --vcs-origin from the git remote before using it for the API", async () => {
    const d = deps({ env: { CIRCLE_TOKEN: "t" }, gitRemoteUrl: () => "git@github.com:o/r.git" });
    const p = trust({ vcsOrigin: undefined });
    await resolveCircleciOptions(p, d);
    expect(d.resolveOrgAndProjectId).toHaveBeenCalledWith("t", "github.com/o/r");
  });

  test("an explicit --vcs-origin is kept and the repo is not inspected", async () => {
    let gitCalls = 0;
    const d = deps({ gitRemoteUrl: () => (gitCalls++, "git@github.com:x/y.git") });
    const p = trust({ orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    await resolveCircleciOptions(p, d);
    expect(p.options).toMatchObject({ vcsOrigin: "github.com/me/repo" });
    expect(gitCalls).toBe(0);
  });

  test("no --vcs-origin and nothing to infer from: says where it looked", async () => {
    const p = trust({ vcsOrigin: undefined, orgId: "o", projectId: "p", pipelineDefinitionId: "d" });
    const err = await resolveCircleciOptions(p, deps()).catch((e: Error) => e);
    const msg = (err as Error).message;
    expect(msg).toContain("--vcs-origin");
    expect(msg).toContain("package.json");
    expect(msg).toContain("git remote");
  });
});
