import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expandPatterns, matchName } from "./glob.ts";
import type { Pkg } from "./types.ts";

/** Remove a trailing YAML `# comment`, respecting single/double quotes. */
function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

/** Strip a single pair of surrounding single or double quotes, if present. */
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse a single-line YAML flow array such as `["a/*", "b/*"]`. */
function parseFlowArray(s: string): string[] {
  const open = s.indexOf("[");
  const close = s.lastIndexOf("]");
  if (open === -1 || close === -1) return [];
  return s
    .slice(open + 1, close)
    .split(",")
    .map((x) => unquote(x))
    .filter(Boolean);
}

/**
 * Parse the `packages:` list from a pnpm-workspace.yaml. Handles block lists
 * (with same- or deeper-indented `-` items) and single-line flow arrays.
 */
export function parsePnpmPackages(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let inBlock = false;
  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!inBlock) {
      const m = /^packages\s*:\s*(.*)$/.exec(trimmed);
      if (!m) continue;
      const rest = (m[1] ?? "").trim();
      if (rest.startsWith("[")) return parseFlowArray(rest);
      inBlock = true;
      continue;
    }
    if (trimmed.startsWith("-")) {
      const val = unquote(trimmed.slice(1).trim());
      if (val) result.push(val);
    } else {
      break; // next top-level key ends the packages block
    }
  }
  return result;
}

/** Read and parse a JSON file (throws on missing file or invalid JSON). */
function readJson(file: string): any {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Read JSON, returning null for missing/invalid files or non-object values. */
function readJsonSafe(file: string): any {
  try {
    const json = readJson(file);
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

/** Determine workspace glob patterns and the config file they came from. */
export function detectPatterns(root: string): { source: string; patterns: string[] } {
  const pnpmFile = path.join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpmFile)) {
    const patterns = parsePnpmPackages(readFileSync(pnpmFile, "utf8"));
    if (patterns.length > 0) return { source: "pnpm-workspace.yaml", patterns };
  }

  const pkgFile = path.join(root, "package.json");
  if (existsSync(pkgFile)) {
    const json = readJsonSafe(pkgFile);
    if (json) {
      const ws = json.workspaces;
      const patterns = Array.isArray(ws) ? ws : Array.isArray(ws?.packages) ? ws.packages : [];
      if (patterns.length > 0) return { source: "package.json (workspaces)", patterns };
    }
  }

  const lernaFile = path.join(root, "lerna.json");
  if (existsSync(lernaFile)) {
    const json = readJsonSafe(lernaFile);
    if (json) {
      const patterns = Array.isArray(json.packages) ? json.packages : ["packages/*"];
      if (patterns.length > 0) return { source: "lerna.json", patterns };
    }
  }

  return { source: "none", patterns: [] };
}

/** Read a package directory's package.json into a Pkg, or null if invalid. */
function readPkg(dir: string): Pkg | null {
  const file = path.join(dir, "package.json");
  if (!existsSync(file)) return null;
  const json = readJsonSafe(file);
  if (!json || typeof json.name !== "string" || !json.name) return null;
  return {
    name: json.name,
    version: typeof json.version === "string" ? json.version : undefined,
    private: json.private === true,
    dir,
  };
}

export interface DiscoverResult {
  source: string;
  patterns: string[];
  /** All discovered packages (before filtering). */
  all: Pkg[];
}

/** Discover all workspace packages under `root`. */
export function discoverPackages(root: string): DiscoverResult {
  const { source, patterns } = detectPatterns(root);
  const dirs = expandPatterns(root, patterns);
  const all: Pkg[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    const pkg = readPkg(dir);
    if (pkg && !seen.has(pkg.name)) {
      seen.add(pkg.name);
      all.push(pkg);
    }
  }
  return { source, patterns, all };
}

/**
 * Apply private exclusion and --only / --exclude name filters. Returns the
 * publishable candidates (public + name-matched).
 */
export function filterPackages(all: Pkg[], only: string[], exclude: string[]): Pkg[] {
  return all.filter((pkg) => {
    if (pkg.private) return false;
    if (only.length > 0 && !only.some((p) => matchName(p, pkg.name))) return false;
    if (exclude.some((p) => matchName(p, pkg.name))) return false;
    return true;
  });
}
