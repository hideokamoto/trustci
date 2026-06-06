import { describe, expect, test } from "bun:test";
import { ArgError, parseCliArgs } from "../src/args.ts";

describe("parseCliArgs", () => {
  test("help and version", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-v"])).toEqual({ kind: "version" });
  });

  test("github trust", () => {
    const r = parseCliArgs([
      "--provider", "github",
      "--repo", "me/repo",
      "--file", "release.yml",
      "--allow-publish",
      "--dry-run",
    ]);
    expect(r).toMatchObject({
      kind: "trust",
      dryRun: true,
      options: { provider: "github", repo: "me/repo", file: "release.yml", allowPublish: true },
    });
  });

  test("gitlab accepts --repo as project alias", () => {
    const r = parseCliArgs([
      "--provider", "gitlab",
      "--repo", "grp/proj",
      "--file", ".gitlab-ci.yml",
      "--allow-stage-publish",
    ]);
    expect(r).toMatchObject({ kind: "trust", options: { provider: "gitlab", project: "grp/proj" } });
  });

  test("circleci with repeated context-id", () => {
    const r = parseCliArgs([
      "--provider", "circleci",
      "--org-id", "o", "--project-id", "p", "--pipeline-definition-id", "d",
      "--vcs-origin", "https://github.com/me/repo",
      "--context-id", "c1", "--context-id", "c2",
      "--allow-publish",
    ]);
    expect(r).toMatchObject({
      kind: "trust",
      options: { provider: "circleci", contextIds: ["c1", "c2"], vcsOrigin: "https://github.com/me/repo" },
    });
  });

  test("only/exclude collected as arrays", () => {
    const r = parseCliArgs([
      "--provider", "github", "--repo", "me/repo", "--file", "f", "--allow-publish",
      "--only", "@scope/*", "--exclude", "@scope/internal",
    ]);
    expect(r).toMatchObject({ kind: "trust", only: ["@scope/*"], exclude: ["@scope/internal"] });
  });

  test("list subcommand", () => {
    expect(parseCliArgs(["list"])).toEqual({ kind: "list", pkg: undefined, dryRun: false });
    expect(parseCliArgs(["list", "pkg", "--dry-run"])).toEqual({ kind: "list", pkg: "pkg", dryRun: true });
  });

  test("errors", () => {
    expect(() => parseCliArgs([])).toThrow(ArgError);
    expect(() => parseCliArgs(["--provider", "github", "--repo", "x", "--file", "f"])).toThrow(
      /allow-publish/,
    );
    expect(() => parseCliArgs(["--provider", "github", "--file", "f", "--allow-publish"])).toThrow(
      /--repo is required/,
    );
    expect(() => parseCliArgs(["--provider", "svn", "--allow-publish"])).toThrow(/Unknown provider/);
    expect(() =>
      parseCliArgs([
        "--provider", "circleci", "--org-id", "o", "--project-id", "p",
        "--pipeline-definition-id", "d", "--vcs-origin", "github.com/me/repo", "--allow-publish",
      ]),
    ).toThrow(/must include a protocol/);
    expect(() => parseCliArgs(["bogus"])).toThrow(/Unknown command/);
  });
});
