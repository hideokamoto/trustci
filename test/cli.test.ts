import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const pkgVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;

describe("trustci --version", () => {
  test("prints the version from package.json", () => {
    const r = spawnSync(process.execPath, [join(root, "src/cli.ts"), "--version"], { encoding: "utf8" });
    expect(r.stdout.trim()).toBe(pkgVersion);
  });
});
