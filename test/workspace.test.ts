import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  detectPatterns,
  discoverPackages,
  filterPackages,
  parsePnpmPackages,
} from "../src/workspace.ts";

describe("parsePnpmPackages", () => {
  test("block list with comments and quotes", () => {
    const yaml = `# header\npackages:\n  - "packages/*"\n  - 'apps/*'  # trailing\n  - "!**/test/**"\nother: 1\n`;
    expect(parsePnpmPackages(yaml)).toEqual(["packages/*", "apps/*", "!**/test/**"]);
  });
  test("same-indent block list", () => {
    expect(parsePnpmPackages("packages:\n- a/*\n- b/*\n")).toEqual(["a/*", "b/*"]);
  });
  test("flow array", () => {
    expect(parsePnpmPackages(`packages: ["packages/*", 'apps/*']`)).toEqual(["packages/*", "apps/*"]);
  });
});

function makePkg(root: string, dir: string, json: object): void {
  mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, dir, "package.json"), JSON.stringify(json));
}

describe("discover + filter (pnpm monorepo)", () => {
  let root: string;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  function buildMonorepo(): string {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), `packages:\n  - "packages/*"\n`);
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "root", private: true }));
    makePkg(root, "packages/a", { name: "@scope/a", version: "1.0.0" });
    makePkg(root, "packages/b", { name: "@scope/b", version: "1.0.0", private: true });
    makePkg(root, "packages/c", { name: "@scope/c", version: "1.0.0" });
    return root;
  }

  test("detects pnpm patterns", () => {
    buildMonorepo();
    expect(detectPatterns(root)).toEqual({ source: "pnpm-workspace.yaml", patterns: ["packages/*"] });
  });

  test("discovers all packages then excludes private", () => {
    buildMonorepo();
    const { all } = discoverPackages(root);
    expect(all.map((p) => p.name).sort()).toEqual(["@scope/a", "@scope/b", "@scope/c"]);
    const pub = filterPackages(all, [], []);
    expect(pub.map((p) => p.name).sort()).toEqual(["@scope/a", "@scope/c"]);
  });

  test("--only and --exclude name filters", () => {
    buildMonorepo();
    const { all } = discoverPackages(root);
    expect(filterPackages(all, ["@scope/a"], []).map((p) => p.name)).toEqual(["@scope/a"]);
    expect(filterPackages(all, [], ["@scope/c"]).map((p) => p.name)).toEqual(["@scope/a"]);
  });
});

describe("workspace detection fallbacks", () => {
  let root: string;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  test("package.json workspaces array", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws2-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "root", private: true, workspaces: ["pkgs/*"] }),
    );
    expect(detectPatterns(root)).toEqual({ source: "package.json (workspaces)", patterns: ["pkgs/*"] });
  });

  test("lerna.json", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws3-"));
    writeFileSync(path.join(root, "lerna.json"), JSON.stringify({ packages: ["modules/*"] }));
    expect(detectPatterns(root)).toEqual({ source: "lerna.json", patterns: ["modules/*"] });
  });

  test("malformed package.json does not crash, falls back to none", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws4-"));
    writeFileSync(path.join(root, "package.json"), "{ not valid json");
    expect(detectPatterns(root)).toEqual({ source: "none", patterns: [] });
  });

  test("a package directory with null package.json is ignored", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws5-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), `packages:\n  - "packages/*"\n`);
    makePkg(root, "packages/a", { name: "@scope/a", version: "1.0.0" });
    mkdirSync(path.join(root, "packages/bad"), { recursive: true });
    writeFileSync(path.join(root, "packages/bad/package.json"), "null");
    expect(discoverPackages(root).all.map((p) => p.name)).toEqual(["@scope/a"]);
  });
});
