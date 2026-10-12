import type { APIRoute } from "astro";
import { skillResponse } from "../../../../lib/skill";

export const GET: APIRoute = () => skillResponse();
