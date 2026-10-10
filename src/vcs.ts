/** Hosts npm's repository shorthands (`github:o/r`, `gitlab:o/r`, `bitbucket:o/r`) refer to. */
const SHORTHAND_HOSTS: Record<string, string> = {
  github: "github.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
};

const PACKAGE_JSON = "package.json repository";
const GIT_REMOTE = "git remote origin";

/**
 * Convert a repository reference (package.json `repository` string, or a git
 * remote URL) to the scheme-less host/owner/repo form npm trust circleci
 * expects. Returns null for anything that does not name a hosted repository.
 */
export function parseRepositoryUrl(input: string): string | null {
  const s = input.trim();
  let host: string;
  let path: string;

  const shorthand = /^(github|gitlab|bitbucket):(.+)$/.exec(s);
  const scp = /^[^@/\s]+@([^:/\s]+):(.+)$/.exec(s);
  if (shorthand) {
    host = SHORTHAND_HOSTS[shorthand[1]!]!;
    path = shorthand[2]!;
  } else if (/^[^/:\s]+\/[^/:\s]+$/.test(s)) {
    // npm treats a bare "owner/repo" as GitHub.
    host = "github.com";
    path = s;
  } else if (scp) {
    host = scp[1]!;
    path = scp[2]!;
  } else {
    let url: URL;
    try {
      url = new URL(s.replace(/^git\+/, ""));
    } catch {
      return null;
    }
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol) || !url.hostname) return null;
    host = url.hostname;
    path = url.pathname;
  }

  const parts = path
    .replace(/#.*$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/, "")
    .split("/");
  if (parts.length < 2 || parts.some((p) => !p)) return null;
  return `${host}/${parts.join("/")}`;
}

/** Extract the URL/shorthand string from a package.json `repository` field. */
export function repositoryFromPackageJson(repository: unknown): string | undefined {
  if (typeof repository === "string") return repository;
  if (repository && typeof repository === "object" && "url" in repository) {
    const url = (repository as { url: unknown }).url;
    if (typeof url === "string") return url;
  }
  return undefined;
}

export interface VcsOriginInput {
  flag?: string;
  /** The root package.json `repository` string, if any. */
  pkgRepository: string | undefined;
  /** `git remote get-url origin`, or null when unavailable. */
  gitRemote: string | null;
}

export type VcsOriginResult =
  | { value: string; source: string; warnings: string[] }
  | { value: undefined; warnings: string[] };

/**
 * Pick the vcs-origin: --vcs-origin, then the root package.json `repository`
 * (shared, committed), then `git remote get-url origin` (local clone state).
 */
export function resolveVcsOrigin(input: VcsOriginInput): VcsOriginResult {
  if (input.flag) return { value: input.flag, source: "--vcs-origin", warnings: [] };

  const warnings: string[] = [];
  const fromGit = input.gitRemote ? parseRepositoryUrl(input.gitRemote) : null;
  if (input.pkgRepository !== undefined) {
    const fromPkg = parseRepositoryUrl(input.pkgRepository);
    if (fromPkg) {
      if (fromGit && fromGit !== fromPkg) {
        warnings.push(`${PACKAGE_JSON} (${fromPkg}) differs from ${GIT_REMOTE} (${fromGit}); using ${fromPkg}`);
      }
      return { value: fromPkg, source: PACKAGE_JSON, warnings };
    }
    warnings.push(`could not read a repository from ${PACKAGE_JSON} ("${input.pkgRepository}")`);
  }
  if (fromGit) return { value: fromGit, source: GIT_REMOTE, warnings };
  return { value: undefined, warnings };
}
