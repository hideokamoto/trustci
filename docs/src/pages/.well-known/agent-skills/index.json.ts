import type { APIRoute } from "astro";
import { SKILL_NAME, skillDescription, skillDigest } from "../../../lib/skill";

// Agent Skills discovery index (draft RFC v0.2.0).
export const GET: APIRoute = () =>
  Response.json({
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: SKILL_NAME,
        type: "skill-md",
        description: skillDescription(),
        url: `/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`,
        digest: skillDigest(),
      },
    ],
  });
