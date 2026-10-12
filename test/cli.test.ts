import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;

describe("trustci --version", () => {
  test("prints the version from package.json", () => {
    const r = spawnSync(process.execPath, [join(root, "src/cli.ts"), "--version"], { encoding: "utf8" });
    expect(r.stdout.trim()).toBe(pkgVersion);
  });
});

describe("trustci with no publishable packages", () => {
  test("explains which packages were discovered and why none matched", () => {
    const dir = mkdtempSync(join(tmpdir(), "trustci-cli-"));
    try {
      writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - docs\n");
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "root-pkg", private: true }));
      mkdirSync(join(dir, "docs"));
      writeFileSync(join(dir, "docs/package.json"), JSON.stringify({ name: "docs", private: true }));
      const r = spawnSync(
        process.execPath,
        [join(root, "src/cli.ts"), "--provider", "github", "--repo", "me/repo", "--file", "release.yml", "--allow-publish", "--dry-run"],
        { cwd: dir, encoding: "utf8" },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("No public packages matched (out of 2 discovered via pnpm-workspace.yaml)");
      expect(r.stderr).toContain("root-pkg (private)");
      expect(r.stderr).toContain("docs (private)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
