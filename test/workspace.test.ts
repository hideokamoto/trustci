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
    // pnpm always treats the workspace root as a package; the private root is discovered but filtered out.
    expect(all.map((p) => p.name).sort()).toEqual(["@scope/a", "@scope/b", "@scope/c", "root"]);
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

describe("pnpm workspace root package", () => {
  let root: string;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  function buildRootPackageRepo(rootJson: object): void {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws-root-"));
    // Same shape as hono-stripe: a publishable root, with packages: listing only private dirs.
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), `packages:\n  - examples/*\n  - docs\n`);
    writeFileSync(path.join(root, "package.json"), JSON.stringify(rootJson));
    makePkg(root, "examples/app", { name: "example-app", version: "0.0.0", private: true });
    makePkg(root, "docs", { name: "docs", version: "0.0.0", private: true });
  }

  test("a public root package is discovered even when packages: does not list it", () => {
    buildRootPackageRepo({ name: "hono-stripe", version: "0.1.0" });
    const { all, source } = discoverPackages(root);
    expect(source).toBe("pnpm-workspace.yaml");
    expect(all.map((p) => p.name).sort()).toEqual(["docs", "example-app", "hono-stripe"]);
    expect(filterPackages(all, [], []).map((p) => p.name)).toEqual(["hono-stripe"]);
  });

  test("a private root package is discovered but excluded by filterPackages", () => {
    buildRootPackageRepo({ name: "monorepo-root", private: true });
    const { all } = discoverPackages(root);
    expect(all.map((p) => p.name)).toContain("monorepo-root");
    expect(filterPackages(all, [], [])).toHaveLength(0);
  });

  test("the root is not duplicated when packages: also matches it", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws-root-dup-"));
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), `packages:\n  - "."\n  - "packages/*"\n`);
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "dup-root", version: "1.0.0" }));
    makePkg(root, "packages/a", { name: "@scope/a", version: "1.0.0" });
    const names = discoverPackages(root).all.map((p) => p.name);
    expect(names.filter((n) => n === "dup-root")).toHaveLength(1);
  });

  test("a root without a name is ignored", () => {
    buildRootPackageRepo({ private: true });
    expect(discoverPackages(root).all.map((p) => p.name).sort()).toEqual(["docs", "example-app"]);
  });

  test("npm/yarn workspaces do not implicitly include the root", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-ws-root-npm-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "npm-root", version: "1.0.0", workspaces: ["pkgs/*"] }),
    );
    makePkg(root, "pkgs/a", { name: "@scope/a", version: "1.0.0" });
    expect(discoverPackages(root).all.map((p) => p.name)).toEqual(["@scope/a"]);
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

describe("single-package fallback mode", () => {
  let root: string;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  test("falls back to root package.json when no workspace config exists", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-single-"));
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "my-pkg", version: "1.0.0" }));
    const result = discoverPackages(root);
    expect(result.source).toBe("package.json (root)");
    expect(result.patterns).toEqual([]);
    expect(result.all).toHaveLength(1);
    expect(result.all[0]?.name).toBe("my-pkg");
    expect(result.all[0]?.private).toBe(false);
  });

  test("single-package fallback includes private packages in all (filterPackages excludes them)", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-single-priv-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "my-private-pkg", version: "1.0.0", private: true }),
    );
    const { all, source } = discoverPackages(root);
    expect(source).toBe("package.json (root)");
    expect(all).toHaveLength(1);
    expect(all[0]?.private).toBe(true);
    // filterPackages must exclude it
    expect(filterPackages(all, [], [])).toHaveLength(0);
  });

  test("no fallback when root package.json is also missing", () => {
    root = mkdtempSync(path.join(tmpdir(), "trustci-empty-"));
    const result = discoverPackages(root);
    expect(result.source).toBe("none");
    expect(result.all).toHaveLength(0);
  });
});
