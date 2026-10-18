import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../src/args.ts";
import { buildTrustArgs, cmpVersion, displayCommand, realRunCommand } from "../src/npm.ts";
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
      vcsOrigin: "github.com/me/repo",
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
      "--vcs-origin", "github.com/me/repo",
      "--context-id", "ctx-1",
      "--context-id", "ctx-2",
      "--allow-publish",
      "--allow-stage-publish",
    ]);
  });
});

// Mirrors validateVcsOrigin in npm's lib/commands/trust/circleci.js (npm 12.2.0):
// npm rejects a vcs-origin containing "://" or with fewer than 3 "/"-separated parts.
function npmAcceptsVcsOrigin(value: string): boolean {
  return !value.includes("://") && value.split("/").length >= 3;
}

describe("circleci vcs-origin reaches npm in the form npm accepts", () => {
  for (const input of ["https://github.com/me/repo", "github.com/me/repo"]) {
    test(`--vcs-origin ${input}`, () => {
      const parsed = parseCliArgs([
        "--provider", "circleci",
        "--org-id", "o", "--project-id", "p", "--pipeline-definition-id", "d",
        "--vcs-origin", input,
        "--allow-publish",
      ]);
      if (parsed.kind !== "trust") throw new Error("expected trust command");
      const args = buildTrustArgs(parsed.options, "pkg");
      const value = args[args.indexOf("--vcs-origin") + 1]!;
      expect(npmAcceptsVcsOrigin(value)).toBe(true);
      expect(value).toBe("github.com/me/repo");
    });
  }
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

describe("realRunCommand", () => {
  test("drops --dry-run and adds -y, keeping the flags the user passed", () => {
    expect(realRunCommand(["--dry-run", "--provider", "circleci", "--allow-publish"], false)).toEqual({
      command: "npx trustci --provider circleci --allow-publish -y",
      tokenOmitted: false,
    });
  });

  test("does not add -y twice", () => {
    expect(realRunCommand(["--provider", "circleci", "--allow-publish", "--dry-run", "-y"], true).command).toBe(
      "npx trustci --provider circleci --allow-publish -y",
    );
  });

  test("leaves --circle-token out in both spellings", () => {
    for (const argv of [
      ["--provider", "circleci", "--circle-token", "secret", "--allow-publish", "--dry-run"],
      ["--provider", "circleci", "--circle-token=secret", "--allow-publish", "--dry-run"],
    ]) {
      const r = realRunCommand(argv, false);
      expect(r.command).toBe("npx trustci --provider circleci --allow-publish -y");
      expect(r.command).not.toContain("secret");
      expect(r.tokenOmitted).toBe(true);
    }
  });

  test("quotes globs and keeps repeatable flags", () => {
    expect(
      realRunCommand(
        ["trust", "--provider", "circleci", "--only", "@scope/*", "--context-id", "c1", "--context-id", "c2", "--allow-publish", "--dry-run"],
        false,
      ).command,
    ).toBe("npx trustci trust --provider circleci --only '@scope/*' --context-id c1 --context-id c2 --allow-publish -y");
  });
});
