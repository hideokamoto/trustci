import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { compilePathGlob, expandPatterns, matchName } from "../src/glob.ts";

describe("compilePathGlob", () => {
  test("single-level star", () => {
    const re = compilePathGlob("packages/*");
    expect(re.test("packages/a")).toBe(true);
    expect(re.test("packages/a/b")).toBe(false);
    expect(re.test("apps/a")).toBe(false);
  });
  test("double star is recursive", () => {
    const re = compilePathGlob("apps/**");
    expect(re.test("apps/a")).toBe(true);
    expect(re.test("apps/a/b")).toBe(true);
  });
  test("leading **/", () => {
    const re = compilePathGlob("**/test");
    expect(re.test("test")).toBe(true);
    expect(re.test("packages/a/test")).toBe(true);
  });
});

describe("matchName", () => {
  test("scoped wildcard", () => {
    expect(matchName("@scope/*", "@scope/a")).toBe(true);
    expect(matchName("@scope/*", "@other/a")).toBe(false);
    expect(matchName("*", "anything")).toBe(true);
  });
});

describe("expandPatterns", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-glob-"));
    for (const d of ["packages/a", "packages/b", "apps/web", "packages/a/node_modules/dep", "tooling"]) {
      mkdirSync(path.join(root, d), { recursive: true });
    }
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test("expands packages/* and apps/*", () => {
    const dirs = expandPatterns(root, ["packages/*", "apps/*"]).map((d) => path.relative(root, d));
    expect(dirs.sort()).toEqual(["apps/web", "packages/a", "packages/b"]);
  });

  test("negation removes matches", () => {
    const dirs = expandPatterns(root, ["packages/*", "!packages/b"]).map((d) => path.relative(root, d));
    expect(dirs.sort()).toEqual(["packages/a"]);
  });

  test("ignores node_modules", () => {
    const dirs = expandPatterns(root, ["packages/**"]).map((d) => path.relative(root, d));
    expect(dirs).not.toContain(path.join("packages", "a", "node_modules", "dep"));
  });
});
