import { describe, expect, test } from "bun:test";
import { parseRepositoryUrl, repositoryFromPackageJson, resolveVcsOrigin } from "../src/vcs.ts";

describe("parseRepositoryUrl", () => {
  test.each([
    // URL forms
    ["https://github.com/o/r", "github.com/o/r"],
    ["https://github.com/o/r.git", "github.com/o/r"],
    ["https://github.com/o/r/", "github.com/o/r"],
    ["http://github.com/o/r", "github.com/o/r"],
    ["https://user@github.com/o/r.git", "github.com/o/r"],
    ["git+https://github.com/o/r.git", "github.com/o/r"],
    ["git+https://github.com/o/r.git#main", "github.com/o/r"],
    ["git+ssh://git@github.com/o/r.git", "github.com/o/r"],
    ["ssh://git@github.com/o/r", "github.com/o/r"],
    ["git://github.com/o/r.git", "github.com/o/r"],
    ["https://gitlab.com/group/sub/project.git", "gitlab.com/group/sub/project"],
    // scp-like (git remote)
    ["git@github.com:o/r.git", "github.com/o/r"],
    ["git@github.com:o/r", "github.com/o/r"],
    ["git@bitbucket.org:team/repo.git", "bitbucket.org/team/repo"],
    // npm shorthands (package.json)
    ["github:o/r", "github.com/o/r"],
    ["gitlab:o/r", "gitlab.com/o/r"],
    ["bitbucket:o/r", "bitbucket.org/o/r"],
    ["o/r", "github.com/o/r"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(parseRepositoryUrl(input)).toBe(expected);
  });

  test.each([
    "",
    "not a url",
    "gist:11081aaa281",
    "https://github.com/o",
    "https://github.com/",
    "file:///tmp/repo",
    "/local/path/repo",
  ])("rejects %p", (input) => {
    expect(parseRepositoryUrl(input)).toBeNull();
  });
});

describe("repositoryFromPackageJson", () => {
  test.each([
    [undefined, undefined],
    ["github:o/r", "github:o/r"],
    [{ type: "git", url: "git+https://github.com/o/r.git" }, "git+https://github.com/o/r.git"],
    [{ type: "git", url: "https://github.com/o/r.git", directory: "packages/a" }, "https://github.com/o/r.git"],
    [{ type: "git" }, undefined],
    [42, undefined],
  ] as const)("%j -> %p", (input, expected) => {
    expect(repositoryFromPackageJson(input)).toBe(expected);
  });
});

describe("resolveVcsOrigin", () => {
  test("the flag wins and nothing else is consulted", () => {
    expect(
      resolveVcsOrigin({ flag: "github.com/f/f", pkgRepository: "github:p/p", gitRemote: "git@github.com:g/g.git" }),
    ).toEqual({ value: "github.com/f/f", source: "--vcs-origin", warnings: [] });
  });

  test("package.json repository comes before the git remote", () => {
    expect(resolveVcsOrigin({ pkgRepository: "github:o/r", gitRemote: "git@github.com:o/r.git" })).toEqual({
      value: "github.com/o/r",
      source: "package.json repository",
      warnings: [],
    });
  });

  test("falls back to the git remote", () => {
    expect(resolveVcsOrigin({ pkgRepository: undefined, gitRemote: "git@github.com:o/r.git" })).toEqual({
      value: "github.com/o/r",
      source: "git remote origin",
      warnings: [],
    });
  });

  test("warns and keeps package.json when it differs from the git remote", () => {
    const r = resolveVcsOrigin({ pkgRepository: "github:up/r", gitRemote: "git@github.com:fork/r.git" });
    expect(r.value).toBe("github.com/up/r");
    expect(r.source).toBe("package.json repository");
    expect(r.warnings.join("\n")).toContain("github.com/fork/r");
  });

  test("warns about an unreadable package.json repository and falls back to the git remote", () => {
    const r = resolveVcsOrigin({ pkgRepository: "gist:11081aaa281", gitRemote: "https://github.com/o/r.git" });
    expect(r.value).toBe("github.com/o/r");
    expect(r.source).toBe("git remote origin");
    expect(r.warnings.join("\n")).toContain("gist:11081aaa281");
  });

  test("nothing usable", () => {
    expect(resolveVcsOrigin({ pkgRepository: undefined, gitRemote: null })).toEqual({ value: undefined, warnings: [] });
  });
});
