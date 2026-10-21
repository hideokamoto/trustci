import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(path.join(import.meta.dir, "../package.json"), "utf8"));

describe("package.json toolchain pins", () => {
  test("@types/bun matches the packageManager Bun version", () => {
    expect(pkg.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies["@types/bun"]).toBe(pkg.packageManager.slice("bun@".length));
  });
});
