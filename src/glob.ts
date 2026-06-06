import { readdirSync } from "node:fs";
import path from "node:path";

const ALWAYS_IGNORE = new Set(["node_modules", ".git"]);

/** Escape regex metacharacters except the glob wildcards we handle. */
function escape(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile a path glob (supporting `**`, `*`, `?`) into an anchored RegExp that
 * tests POSIX-style relative paths. `**` crosses directory separators, `*` and
 * `?` stay within a single segment.
 */
export function compilePathGlob(pattern: string): RegExp {
  const segments = pattern.replace(/\/+$/, "").split("/");
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg === "**") {
      // `**` matches zero or more path segments. Consume a following separator
      // so that `a/**/b` and `a/**` both behave.
      parts.push("(?:.*/)?");
      // Skip the separator that compilePathGlob's join would otherwise add.
      if (i < segments.length - 1) continue;
      parts[parts.length - 1] = "(?:.*)?";
      break;
    }
    const segRe = escape(seg).replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
    parts.push(segRe);
    if (i < segments.length - 1) parts.push("/");
  }
  // Clean up any `(?:.*/)?` immediately followed by our manual "/".
  const body = parts.join("").replace(/\(\?:\.\*\/\)\?\//g, "(?:.*/)?");
  return new RegExp(`^${body}$`);
}

/**
 * Recursively collect every directory under `root` (relative, POSIX-style),
 * skipping node_modules and .git. The root itself is represented as "".
 */
function collectDirs(root: string): string[] {
  const out: string[] = [];
  const walk = (abs: string, rel: string): void => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ALWAYS_IGNORE.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      out.push(childRel);
      walk(path.join(abs, entry.name), childRel);
    }
  };
  walk(root, "");
  return out;
}

/**
 * Expand workspace patterns (relative to `root`) into a sorted, de-duplicated
 * list of absolute directory paths. Patterns starting with `!` are negations
 * that remove already-matched directories.
 */
export function expandPatterns(root: string, patterns: string[]): string[] {
  const positives: RegExp[] = [];
  const negatives: RegExp[] = [];
  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;
    if (pattern.startsWith("!")) {
      negatives.push(compilePathGlob(pattern.slice(1)));
    } else {
      positives.push(compilePathGlob(pattern));
    }
  }
  if (positives.length === 0) return [];

  const dirs = collectDirs(root);
  const matched = new Set<string>();
  for (const rel of dirs) {
    if (positives.some((re) => re.test(rel)) && !negatives.some((re) => re.test(rel))) {
      matched.add(rel);
    }
  }
  return [...matched].sort().map((rel) => path.resolve(root, rel));
}

/**
 * Match a package name against a simple glob where `*` matches any characters.
 * Used for `--only` / `--exclude` filters (names, not paths).
 */
export function matchName(pattern: string, name: string): boolean {
  const re = new RegExp(`^${escape(pattern).replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return re.test(name);
}
