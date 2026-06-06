import { describe, expect, test } from "bun:test";
import { buildTrustArgs, cmpVersion, displayCommand } from "../src/npm.ts";
import type { CircleciOptions, GithubOptions, GitlabOptions } from "../src/types.ts";

describe("cmpVersion", () => {
  test("orders versions", () => {
    expect(cmpVersion("11.5.1", "11.5.1")).toBe(0);
    expect(cmpVersion("11.5.0", "11.5.1")).toBe(-1);
    expect(cmpVersion("11.6.0", "11.5.1")).toBe(1);
    expect(cmpVersion("22.22.2", "22.14.0")).toBe(1);
    expect(cmpVersion("22.9.0", "22.14.0")).toBe(-1);
  });
});

describe("buildTrustArgs", () => {
  test("github with environment", () => {
    const o: GithubOptions = {
      provider: "github",
      repo: "me/repo",
      file: "release.yml",
      env: "production",
      allowPublish: true,
      allowStagePublish: false,
      yes: false,
    };
    expect(buildTrustArgs(o, "@scope/a")).toEqual([
      "trust", "github", "@scope/a",
      "--repository", "me/repo",
      "--file", "release.yml",
      "--environment", "production",
      "--allow-publish",
    ]);
  });

  test("gitlab without environment, with yes", () => {
    const o: GitlabOptions = {
      provider: "gitlab",
      project: "grp/proj",
      file: ".gitlab-ci.yml",
      allowPublish: false,
      allowStagePublish: true,
      yes: true,
    };
    expect(buildTrustArgs(o, "pkg")).toEqual([
      "trust", "gitlab", "pkg",
      "--project", "grp/proj",
      "--file", ".gitlab-ci.yml",
      "--allow-stage-publish",
      "-y",
    ]);
  });

  test("circleci with multiple context ids", () => {
    const o: CircleciOptions = {
      provider: "circleci",
      orgId: "org-1",
      projectId: "proj-1",
      pipelineDefinitionId: "pipe-1",
      vcsOrigin: "https://github.com/me/repo",
      contextIds: ["ctx-1", "ctx-2"],
      allowPublish: true,
      allowStagePublish: true,
      yes: false,
    };
    expect(buildTrustArgs(o, "pkg")).toEqual([
      "trust", "circleci", "pkg",
      "--org-id", "org-1",
      "--project-id", "proj-1",
      "--pipeline-definition-id", "pipe-1",
      "--vcs-origin", "https://github.com/me/repo",
      "--context-id", "ctx-1",
      "--context-id", "ctx-2",
      "--allow-publish",
      "--allow-stage-publish",
    ]);
  });
});

describe("displayCommand", () => {
  test("prefixes npm and quotes when needed", () => {
    expect(displayCommand(["trust", "github", "pkg", "--file", "release.yml"])).toBe(
      "npm trust github pkg --file release.yml",
    );
  });
  test("quotes args with spaces", () => {
    expect(displayCommand(["trust", "list", "my pkg"])).toBe("npm trust list 'my pkg'");
  });
});
