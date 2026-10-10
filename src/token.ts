import { join } from "node:path";

const DEFAULT_HOST = "https://circleci.com";
const LEGACY_CLI_YML = "~/.circleci/cli.yml";

/**
 * Environment variables checked for a CircleCI token, in order:
 * circleci CLI v1 and chunk (CIRCLE_TOKEN), chunk (CIRCLECI_TOKEN),
 * circleci CLI v1 legacy alias (CIRCLE_CLI_TOKEN), circleci CLI v0.1 (CIRCLECI_CLI_TOKEN).
 */
export const TOKEN_ENV_VARS = ["CIRCLE_TOKEN", "CIRCLECI_TOKEN", "CIRCLE_CLI_TOKEN", "CIRCLECI_CLI_TOKEN"] as const;

/** Every place a token is looked up, for error messages. */
export const TOKEN_SOURCES = ["--circle-token", ...TOKEN_ENV_VARS, LEGACY_CLI_YML] as const;

export interface TokenLookupInput {
  flag?: string;
  env: Record<string, string | undefined>;
  homedir: string;
  /** Returns the file contents, or null when it does not exist or cannot be read. */
  readFile: (path: string) => string | null;
}

export type TokenLookupResult =
  | { token: string; source: string; notes: string[] }
  | { token: undefined; notes: string[] };

/**
 * Read the top-level `token` and `host` keys from a circleci CLI v0.1 config
 * (~/.circleci/cli.yml). Only plain single-line scalars are understood; this
 * avoids a YAML dependency for the two keys trustci needs.
 */
export function parseLegacyCliYml(content: string): { token?: string; host?: string } {
  const out: { token?: string; host?: string } = {};
  for (const raw of content.split(/\r?\n/)) {
    const m = /^(token|host):(.*)$/.exec(raw);
    if (!m) continue;
    const value = parseScalar(m[2]!.trim());
    if (value) out[m[1] as "token" | "host"] = value;
  }
  return out;
}

function parseScalar(v: string): string {
  const quoted = /^(["'])(.*)\1(\s+#.*)?$/.exec(v);
  if (quoted) return quoted[2]!;
  return v.replace(/\s+#.*$/, "").trim();
}

/** Find a CircleCI API token, reporting where it came from. */
export function resolveCircleToken(input: TokenLookupInput): TokenLookupResult {
  if (input.flag) return { token: input.flag, source: "--circle-token", notes: [] };
  for (const name of TOKEN_ENV_VARS) {
    const value = input.env[name];
    if (value) return { token: value, source: name, notes: [] };
  }

  const content = input.readFile(join(input.homedir, ".circleci", "cli.yml"));
  if (content === null) return { token: undefined, notes: [] };
  const { token, host } = parseLegacyCliYml(content);
  if (!token) return { token: undefined, notes: [] };
  if (token === "|" || token === ">" || /^[|>][-+0-9]*$/.test(token)) {
    return { token: undefined, notes: [`skipped ${LEGACY_CLI_YML}: its token is not a single-line value trustci can read`] };
  }
  if (host && host.replace(/\/+$/, "") !== DEFAULT_HOST) {
    return { token: undefined, notes: [`skipped ${LEGACY_CLI_YML}: its token is for ${host}, not ${DEFAULT_HOST}`] };
  }
  return { token, source: LEGACY_CLI_YML, notes: [] };
}
