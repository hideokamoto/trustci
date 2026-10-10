const BASE_URL = "https://circleci.com/api/v2";

function vcsTypeFromUrl(url: string): string {
  const { hostname } = new URL(url);
  if (hostname === "github.com" || hostname.endsWith(".github.com")) return "github";
  if (hostname === "gitlab.com" || hostname.endsWith(".gitlab.com")) return "gitlab";
  if (hostname === "bitbucket.org" || hostname.endsWith(".bitbucket.org")) return "bitbucket";
  throw new Error(`Cannot determine VCS type from URL: ${url}`);
}

/**
 * Normalize a vcs-origin to the scheme-less form `npm trust circleci` requires
 * (e.g. "https://github.com/owner/repo/" -> "github.com/owner/repo").
 * Both the scheme-less and the URL form are accepted as input.
 */
export function normalizeVcsOrigin(value: string): string {
  const v = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
  const parts = v.split("/");
  if (parts.length < 3 || parts.some((p) => !p)) {
    throw new Error(`vcs-origin must be in the form host/owner/repo, e.g. github.com/org/repo (got "${value}").`);
  }
  return v;
}

/** Convert a vcs-origin (with or without scheme) to a CircleCI project slug (e.g. "github/owner/repo"). */
export function projectSlugFromVcsOrigin(origin: string): string {
  const url = origin.includes("://") ? origin : `https://${origin}`;
  const vcsType = vcsTypeFromUrl(url);
  const { pathname } = new URL(url);
  const parts = pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Cannot extract org/repo from URL: ${url}`);
  }
  return `${vcsType}/${parts[0]}/${parts[1]}`;
}

/** A non-2xx response from the CircleCI API. */
export class CircleApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`CircleCI API error (${status}) for ${path}: ${body}`);
  }
}

async function circleGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Circle-Token": token, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new CircleApiError(response.status, path, await response.text());
  }
  return response.json() as Promise<T>;
}

/** Resolve org-id and project-id from a CircleCI API token and vcs-origin URL. */
export async function resolveOrgAndProjectId(
  token: string,
  vcsOrigin: string,
): Promise<{ orgId: string; projectId: string }> {
  const slug = projectSlugFromVcsOrigin(vcsOrigin);
  const project = await circleGet<{ id: string; organization_id: string }>(token, `/project/${slug}`);
  return { orgId: project.organization_id, projectId: project.id };
}

interface PipelineDef {
  id: string;
  config_file_path?: string;
  name?: string;
}

/**
 * Resolve pipeline-definition-id for a given project.
 * If `file` is provided, selects the definition whose config_file_path or name matches.
 * If only one definition exists and no file is specified, returns it directly.
 */
export async function resolvePipelineDefinitionId(
  token: string,
  projectId: string,
  file?: string,
): Promise<string> {
  const data = await circleGet<{ items: PipelineDef[] }>(
    token,
    `/pipeline-definitions?project_id=${encodeURIComponent(projectId)}`,
  );
  if (data.items.length === 0) {
    throw new Error(`No pipeline definitions found for project "${projectId}".`);
  }
  if (file) {
    const match = data.items.find((d) => d.config_file_path === file || d.name === file);
    if (!match) {
      const available = data.items.map((d) => d.config_file_path ?? d.name ?? d.id).join(", ");
      throw new Error(`No pipeline definition found matching "${file}". Available: ${available}`);
    }
    return match.id;
  }
  if (data.items.length === 1) {
    return data.items[0].id;
  }
  const available = data.items.map((d) => d.config_file_path ?? d.name ?? d.id).join(", ");
  throw new Error(
    `Multiple pipeline definitions found for project "${projectId}". Specify --file to select one: ${available}`,
  );
}
