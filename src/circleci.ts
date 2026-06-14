const BASE_URL = "https://circleci.com/api/v2";

function vcsTypeFromUrl(url: string): string {
  const { hostname } = new URL(url);
  if (hostname === "github.com" || hostname.endsWith(".github.com")) return "github";
  if (hostname === "gitlab.com" || hostname.endsWith(".gitlab.com")) return "gitlab";
  if (hostname === "bitbucket.org" || hostname.endsWith(".bitbucket.org")) return "bitbucket";
  throw new Error(`Cannot determine VCS type from URL: ${url}`);
}

/** Convert a vcs-origin URL to a CircleCI project slug (e.g. "github/owner/repo"). */
export function projectSlugFromVcsOrigin(url: string): string {
  const vcsType = vcsTypeFromUrl(url);
  const { pathname } = new URL(url);
  const parts = pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Cannot extract org/repo from URL: ${url}`);
  }
  return `${vcsType}/${parts[0]}/${parts[1]}`;
}

async function circleGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Circle-Token": token, Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CircleCI API error (${response.status}) for ${path}: ${body}`);
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
