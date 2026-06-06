export type Provider = "github" | "gitlab" | "circleci";

export const PROVIDERS: readonly Provider[] = ["github", "gitlab", "circleci"];

/** A workspace package discovered on disk. */
export interface Pkg {
  /** The "name" field from package.json. */
  name: string;
  /** The "version" field from package.json, if any. */
  version?: string;
  /** Whether package.json marks this as private. */
  private: boolean;
  /** Absolute path to the package directory. */
  dir: string;
}

/** Permission/confirmation options shared by every provider. */
export interface CommonOptions {
  allowPublish: boolean;
  allowStagePublish: boolean;
  yes: boolean;
}

export interface GithubOptions extends CommonOptions {
  provider: "github";
  /** owner/repo */
  repo: string;
  /** Workflow file that performs publishing, e.g. release.yml */
  file: string;
  /** Optional environment name. */
  env?: string;
}

export interface GitlabOptions extends CommonOptions {
  provider: "gitlab";
  /** group/project */
  project: string;
  file: string;
  env?: string;
}

export interface CircleciOptions extends CommonOptions {
  provider: "circleci";
  orgId: string;
  projectId: string;
  pipelineDefinitionId: string;
  /** VCS origin URL including protocol, e.g. https://github.com/org/repo */
  vcsOrigin: string;
  /** Zero or more CircleCI context ids. */
  contextIds: string[];
}

export type ProviderOptions = GithubOptions | GitlabOptions | CircleciOptions;

/** Result of parsing argv. */
export type ParsedArgs =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "list"; pkg?: string; dryRun: boolean }
  | {
      kind: "trust";
      options: ProviderOptions;
      dryRun: boolean;
      only: string[];
      exclude: string[];
    };
