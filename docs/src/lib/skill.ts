import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Skill name; also its directory under ../skills and under /.well-known/agent-skills. */
export const SKILL_NAME = "trustci";

/**
 * Raw bytes of the repository's skills/trustci/SKILL.md, the single source of truth.
 * Astro runs with the docs/ directory as its working directory (locally and in CI).
 */
export function readSkill(): Buffer {
  return readFileSync(path.resolve(process.cwd(), "..", "skills", SKILL_NAME, "SKILL.md"));
}

/** Response serving SKILL.md as UTF-8 Markdown. */
export function skillResponse(): Response {
  return new Response(new Uint8Array(readSkill()), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

/** The `description` field of the SKILL.md frontmatter. */
export function skillDescription(): string {
  const match = /^description:\s*(.+)$/m.exec(readSkill().toString("utf8"));
  if (!match?.[1]) throw new Error(`skills/${SKILL_NAME}/SKILL.md has no description`);
  return match[1].trim();
}

/** `sha256:<hex>` over the raw SKILL.md bytes, as the discovery index requires. */
export function skillDigest(): string {
  return `sha256:${createHash("sha256").update(readSkill()).digest("hex")}`;
}
