import { describe, expect, test, mock, afterEach } from "bun:test";
import {
  projectSlugFromVcsOrigin,
  resolveOrgAndProjectId,
  resolvePipelineDefinitionId,
} from "../src/circleci.ts";

// bun's `typeof fetch` also requires `preconnect`, which a plain mock lacks.
const mockFetch = (impl: () => Promise<Response>) => mock(impl) as unknown as typeof fetch;

describe("projectSlugFromVcsOrigin", () => {
  test("scheme-less origin", () => {
    expect(projectSlugFromVcsOrigin("github.com/owner/repo")).toBe("github/owner/repo");
  });

  test("github URL", () => {
    expect(projectSlugFromVcsOrigin("https://github.com/owner/repo")).toBe("github/owner/repo");
  });

  test("github URL with .git suffix", () => {
    expect(projectSlugFromVcsOrigin("https://github.com/owner/repo.git")).toBe("github/owner/repo");
  });

  test("gitlab URL", () => {
    expect(projectSlugFromVcsOrigin("https://gitlab.com/group/project")).toBe("gitlab/group/project");
  });

  test("bitbucket URL", () => {
    expect(projectSlugFromVcsOrigin("https://bitbucket.org/team/repo")).toBe("bitbucket/team/repo");
  });

  test("unknown VCS throws", () => {
    expect(() => projectSlugFromVcsOrigin("https://example.com/org/repo")).toThrow(
      /Cannot determine VCS type/,
    );
  });

  test("hostname lookalike does not match (e.g. mygithub.com)", () => {
    expect(() => projectSlugFromVcsOrigin("https://mygithub.com/org/repo")).toThrow(
      /Cannot determine VCS type/,
    );
  });

  test("missing repo segment throws", () => {
    expect(() => projectSlugFromVcsOrigin("https://github.com/owner")).toThrow(
      /Cannot extract org\/repo/,
    );
  });
});

describe("resolveOrgAndProjectId", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns orgId and projectId from API response", async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ id: "proj-uuid", organization_id: "org-uuid" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await resolveOrgAndProjectId("token", "https://github.com/owner/repo");
    expect(result).toEqual({ orgId: "org-uuid", projectId: "proj-uuid" });
    expect(fetch).toHaveBeenCalledWith(
      "https://circleci.com/api/v2/project/github/owner/repo",
      expect.objectContaining({ headers: expect.objectContaining({ "Circle-Token": "token" }) }),
    );
  });

  test("throws on API error", async () => {
    globalThis.fetch = mockFetch(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 })),
    );
    await expect(resolveOrgAndProjectId("bad-token", "https://github.com/owner/repo")).rejects.toThrow(
      /CircleCI API error \(401\)/,
    );
  });
});

// Shape of GET /api/v2/projects/{project_id}/pipeline-definitions as documented at
// https://circleci.com/docs/api/v2/ ("List pipeline definitions") and as returned
// by the live API on 2026-10-10. The mock answers 404 for any other URL, like the
// real API does, so a wrong endpoint cannot pass.
function pipelineDef(id: string, name: string, filePath: string) {
  return {
    id,
    name,
    created_at: "2026-06-06T13:36:44.866854Z",
    config_source: {
      provider: "github_app",
      repo: { full_name: "me/configs", external_id: "1" },
      file_path: filePath,
    },
    checkout_source: { provider: "github_app", repo: { full_name: "me/repo", external_id: "2" } },
  };
}

function mockPipelineDefinitions(items: unknown[]) {
  const expected = "https://circleci.com/api/v2/projects/proj-uuid/pipeline-definitions";
  const fetchMock = mock((url: string | URL | Request) =>
    Promise.resolve(
      String(url) === expected
        ? new Response(JSON.stringify({ items }), { status: 200, headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("resolvePipelineDefinitionId", () => {
  afterEach(() => {
    mock.restore();
  });

  test("calls the documented endpoint and returns the only definition", async () => {
    const fetchMock = mockPipelineDefinitions([pipelineDef("def-1", "main", ".circleci/config.yml")]);
    expect(await resolvePipelineDefinitionId("token", "proj-uuid")).toBe("def-1");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://circleci.com/api/v2/projects/proj-uuid/pipeline-definitions",
    );
  });

  test("matches --file against config_source.file_path", async () => {
    mockPipelineDefinitions([
      pipelineDef("def-1", "main", ".circleci/config.yml"),
      pipelineDef("def-2", "publish", "workflows/publish.yml"),
    ]);
    expect(await resolvePipelineDefinitionId("token", "proj-uuid", "workflows/publish.yml")).toBe("def-2");
  });

  test("matches --file against the definition name", async () => {
    mockPipelineDefinitions([
      pipelineDef("def-1", "main", ".circleci/config.yml"),
      pipelineDef("def-2", "release", ".circleci/release.yml"),
    ]);
    expect(await resolvePipelineDefinitionId("token", "proj-uuid", "release")).toBe("def-2");
  });

  test("throws listing file paths when --file matches nothing", async () => {
    mockPipelineDefinitions([pipelineDef("def-1", "main", ".circleci/config.yml")]);
    await expect(resolvePipelineDefinitionId("token", "proj-uuid", ".circleci/other.yml")).rejects.toThrow(
      /No pipeline definition found matching ".circleci\/other.yml". Available: .circleci\/config.yml/,
    );
  });

  test("throws when multiple definitions and no file specified", async () => {
    mockPipelineDefinitions([
      pipelineDef("def-1", "main", ".circleci/config.yml"),
      pipelineDef("def-2", "release", ".circleci/release.yml"),
    ]);
    await expect(resolvePipelineDefinitionId("token", "proj-uuid")).rejects.toThrow(
      /Multiple pipeline definitions found/,
    );
  });

  test("throws when no definitions found", async () => {
    mockPipelineDefinitions([]);
    await expect(resolvePipelineDefinitionId("token", "proj-uuid")).rejects.toThrow(
      /No pipeline definitions found/,
    );
  });
});
