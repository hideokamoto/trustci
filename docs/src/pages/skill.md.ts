import type { APIRoute } from "astro";
import { skillResponse } from "../lib/skill";

// /skill.md: the conventional single-skill URL on a docs site.
export const GET: APIRoute = () => skillResponse();
