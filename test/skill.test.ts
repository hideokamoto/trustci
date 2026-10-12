import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MIN_NODE, MIN_NPM } from "../src/npm.ts";

const skill = readFileSync(path.join(import.meta.dir, "../skills/trustci/SKILL.md"), "utf8");

describe("skills/trustci/SKILL.md", () => {
  test("frontmatter name matches the directory", () => {
    expect(skill).toMatch(/^---\nname: trustci\n/);
  });

  test("states the same npm and Node minimums as the CLI", () => {
    expect(skill).toContain(`npm ${MIN_NPM}+`);
    expect(skill).toContain(`Node ${MIN_NODE}+`);
    expect(skill).toContain(`\`npm --version\` (${MIN_NPM} or later)`);
    expect(skill).toContain(`\`node --version\` (${MIN_NODE} or later)`);
  });
});
