import { parseArgs } from "node:util";
import { PROVIDERS, type CommonOptions, type ParsedArgs, type Provider, type ProviderOptions } from "./types.ts";

/** Thrown for user-facing argument errors; caught by the CLI to print usage. */
export class ArgError extends Error {}

const options = {
  provider: { type: "string" },
  // github / gitlab
  repo: { type: "string" },
  project: { type: "string" },
  env: { type: "string" },
  file: { type: "string" },
  // circleci
  "org-id": { type: "string" },
  "project-id": { type: "string" },
  "pipeline-definition-id": { type: "string" },
  "vcs-origin": { type: "string" },
  "context-id": { type: "string", multiple: true },
  // common
  "allow-publish": { type: "boolean" },
  "allow-stage-publish": { type: "boolean" },
  "dry-run": { type: "boolean" },
  only: { type: "string", multiple: true },
  exclude: { type: "string", multiple: true },
  yes: { type: "boolean", short: "y" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

function require_(value: string | undefined, flag: string, provider: string): string {
  if (!value) throw new ArgError(`--${flag} is required for --provider ${provider}.`);
  return value;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  let values: Record<string, unknown>;
  let positionals: string[];
  try {
    const parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
    values = parsed.values as Record<string, unknown>;
    positionals = parsed.positionals;
  } catch (err) {
    throw new ArgError((err as Error).message);
  }

  if (values.help) return { kind: "help" };
  if (values.version) return { kind: "version" };

  const dryRun = values["dry-run"] === true;
  const sub = positionals[0];

  if (sub === "list") {
    return { kind: "list", pkg: positionals[1], dryRun };
  }
  if (sub !== undefined) {
    throw new ArgError(`Unknown command "${sub}". Did you mean "list", or did you forget --provider?`);
  }

  const provider = values.provider as string | undefined;
  if (!provider) throw new ArgError("--provider is required (github | gitlab | circleci).");
  if (!PROVIDERS.includes(provider as Provider)) {
    throw new ArgError(`Unknown provider "${provider}". Must be one of: ${PROVIDERS.join(", ")}.`);
  }

  const common: CommonOptions = {
    allowPublish: values["allow-publish"] === true,
    allowStagePublish: values["allow-stage-publish"] === true,
    yes: values.yes === true,
  };
  if (!common.allowPublish && !common.allowStagePublish) {
    throw new ArgError("At least one of --allow-publish or --allow-stage-publish is required.");
  }

  let providerOptions: ProviderOptions;
  switch (provider as Provider) {
    case "github":
      providerOptions = {
        provider: "github",
        repo: require_(values.repo as string | undefined, "repo", "github"),
        file: require_(values.file as string | undefined, "file", "github"),
        env: values.env as string | undefined,
        ...common,
      };
      break;
    case "gitlab": {
      const project = (values.project as string | undefined) ?? (values.repo as string | undefined);
      providerOptions = {
        provider: "gitlab",
        project: require_(project, "project", "gitlab"),
        file: require_(values.file as string | undefined, "file", "gitlab"),
        env: values.env as string | undefined,
        ...common,
      };
      break;
    }
    case "circleci": {
      const vcsOrigin = require_(values["vcs-origin"] as string | undefined, "vcs-origin", "circleci");
      if (!vcsOrigin.includes("://")) {
        throw new ArgError(`--vcs-origin must include a protocol, e.g. https://github.com/org/repo (got "${vcsOrigin}").`);
      }
      providerOptions = {
        provider: "circleci",
        orgId: require_(values["org-id"] as string | undefined, "org-id", "circleci"),
        projectId: require_(values["project-id"] as string | undefined, "project-id", "circleci"),
        pipelineDefinitionId: require_(
          values["pipeline-definition-id"] as string | undefined,
          "pipeline-definition-id",
          "circleci",
        ),
        vcsOrigin,
        contextIds: (values["context-id"] as string[] | undefined) ?? [],
        ...common,
      };
      break;
    }
  }

  return {
    kind: "trust",
    options: providerOptions,
    dryRun,
    only: (values.only as string[] | undefined) ?? [],
    exclude: (values.exclude as string[] | undefined) ?? [],
  };
}
