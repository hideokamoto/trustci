import { describe, expect, test, mock, afterEach } from "bun:test";
import {
  projectSlugFromVcsOrigin,
  resolveOrgAndProjectId,
  resolvePipelineDefinitionId,
} from "../src/circleci.ts";

describe("projectSlugFromVcsOrigin", () => {
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
    globalThis.fetch = mock(() =>
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
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 })),
    );
    await expect(resolveOrgAndProjectId("bad-token", "https://github.com/owner/repo")).rejects.toThrow(
      /CircleCI API error \(401\)/,
    );
  });
});

describe("resolvePipelineDefinitionId", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns id when exactly one definition exists", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [{ id: "def-1", config_file_path: ".circleci/config.yml" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const id = await resolvePipelineDefinitionId("token", "proj-uuid");
    expect(id).toBe("def-1");
  });

  test("matches by config_file_path when file is provided", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              { id: "def-1", config_file_path: ".circleci/config.yml" },
              { id: "def-2", config_file_path: ".circleci/release.yml" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const id = await resolvePipelineDefinitionId("token", "proj-uuid", ".circleci/release.yml");
    expect(id).toBe("def-2");
  });

  test("matches by name when file is provided", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              { id: "def-1", name: "main" },
              { id: "def-2", name: "release" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const id = await resolvePipelineDefinitionId("token", "proj-uuid", "release");
    expect(id).toBe("def-2");
  });

  test("throws when file does not match any definition", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [{ id: "def-1", config_file_path: ".circleci/config.yml" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(
      resolvePipelineDefinitionId("token", "proj-uuid", ".circleci/other.yml"),
    ).rejects.toThrow(/No pipeline definition found matching/);
  });

  test("throws when multiple definitions and no file specified", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              { id: "def-1", config_file_path: ".circleci/config.yml" },
              { id: "def-2", config_file_path: ".circleci/release.yml" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(resolvePipelineDefinitionId("token", "proj-uuid")).rejects.toThrow(
      /Multiple pipeline definitions found/,
    );
  });

  test("throws when no definitions found", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(resolvePipelineDefinitionId("token", "proj-uuid")).rejects.toThrow(
      /No pipeline definitions found/,
    );
  });
});
