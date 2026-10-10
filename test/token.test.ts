import { describe, expect, test } from "bun:test";
import { parseLegacyCliYml, resolveCircleToken, type TokenLookupInput } from "../src/token.ts";

const HOME = "/home/u";
const CLI_YML = "/home/u/.circleci/cli.yml";

function input(over: Partial<TokenLookupInput> = {}, files: Record<string, string> = {}): TokenLookupInput {
  return { env: {}, homedir: HOME, readFile: (p) => files[p] ?? null, ...over };
}

describe("parseLegacyCliYml", () => {
  test.each([
    ["host: https://circleci.com\ntoken: abc\n", { host: "https://circleci.com", token: "abc" }],
    ['token: "abc"\n', { token: "abc" }],
    ["token: 'abc' # comment\n", { token: "abc" }],
    ["token: abc # comment\n", { token: "abc" }],
    ["token:\n", {}],
    ["token: \"\"\n", {}],
    ["  token: nested\n", {}],
    ["endpoint: graphql-unstable\ntoken: abc\nrest_endpoint: api/v2\n", { token: "abc" }],
    ["token: abc\r\n", { token: "abc" }],
  ] as const)("%j", (content, expected) => {
    expect(parseLegacyCliYml(content)).toEqual(expected);
  });
});

describe("resolveCircleToken precedence", () => {
  const allEnv = {
    CIRCLE_TOKEN: "env-circle",
    CIRCLECI_TOKEN: "env-circleci",
    CIRCLE_CLI_TOKEN: "env-circle-cli",
    CIRCLECI_CLI_TOKEN: "env-circleci-cli",
  };
  const file = { [CLI_YML]: "token: file\n" };

  test.each([
    // [flag, env keys present, file present, expected token, expected source]
    ["flag", Object.keys(allEnv), true, "flag", "--circle-token"],
    [undefined, ["CIRCLE_TOKEN", "CIRCLECI_TOKEN", "CIRCLE_CLI_TOKEN", "CIRCLECI_CLI_TOKEN"], true, "env-circle", "CIRCLE_TOKEN"],
    [undefined, ["CIRCLECI_TOKEN", "CIRCLE_CLI_TOKEN", "CIRCLECI_CLI_TOKEN"], true, "env-circleci", "CIRCLECI_TOKEN"],
    [undefined, ["CIRCLE_CLI_TOKEN", "CIRCLECI_CLI_TOKEN"], true, "env-circle-cli", "CIRCLE_CLI_TOKEN"],
    [undefined, ["CIRCLECI_CLI_TOKEN"], true, "env-circleci-cli", "CIRCLECI_CLI_TOKEN"],
    [undefined, [], true, "file", "~/.circleci/cli.yml"],
  ] as const)("flag=%p env=%p file=%p -> %p", (flag, keys, withFile, token, source) => {
    const env = Object.fromEntries(keys.map((k) => [k, allEnv[k as keyof typeof allEnv]]));
    const r = resolveCircleToken(input({ flag, env }, withFile ? file : {}));
    expect(r).toMatchObject({ token, source });
  });

  test("empty env values are ignored", () => {
    const r = resolveCircleToken(input({ env: { CIRCLE_TOKEN: "", CIRCLECI_CLI_TOKEN: "x" } }));
    expect(r).toMatchObject({ token: "x", source: "CIRCLECI_CLI_TOKEN" });
  });

  test("nothing found", () => {
    const r = resolveCircleToken(input());
    expect(r.token).toBeUndefined();
    expect(r.notes).toEqual([]);
  });

  test("does not read the file when an earlier source wins", () => {
    let reads = 0;
    resolveCircleToken({ env: { CIRCLE_TOKEN: "t" }, homedir: HOME, readFile: () => (reads++, null) });
    expect(reads).toBe(0);
  });
});

describe("resolveCircleToken ~/.circleci/cli.yml host check", () => {
  test.each([
    ["token: t\n", "t"],
    ["host: https://circleci.com\ntoken: t\n", "t"],
    ["host: https://circleci.com/\ntoken: t\n", "t"],
    ['host: ""\ntoken: t\n', "t"],
  ] as const)("accepts %j", (content, token) => {
    expect(resolveCircleToken(input({}, { [CLI_YML]: content }))).toMatchObject({ token });
  });

  test("skips a token for another host and says why", () => {
    const r = resolveCircleToken(input({}, { [CLI_YML]: "host: https://circleci.example.com\ntoken: t\n" }));
    expect(r.token).toBeUndefined();
    expect(r.notes.join("\n")).toContain("https://circleci.example.com");
  });

  test("skips a block-scalar token it cannot read and says why", () => {
    const r = resolveCircleToken(input({}, { [CLI_YML]: "token: |\n  abc\n" }));
    expect(r.token).toBeUndefined();
    expect(r.notes.join("\n")).toContain("~/.circleci/cli.yml");
  });
});
