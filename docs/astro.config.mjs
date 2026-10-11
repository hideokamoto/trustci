// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Served from a custom domain on GitHub Pages, so no `base` is set.
export default defineConfig({
  site: "https://trustci.hidetaka.dev",
  integrations: [
    starlight({
      title: "trustci",
      description:
        "Bulk-register npm Trusted Publishers across all public packages in a monorepo.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/hideokamoto/trustci" },
      ],
      editLink: {
        baseUrl: "https://github.com/hideokamoto/trustci/edit/main/docs/",
      },
      sidebar: [
        { label: "Getting started", slug: "getting-started" },
        {
          label: "Providers",
          items: [
            { label: "GitHub Actions", slug: "providers/github" },
            { label: "GitLab CI/CD", slug: "providers/gitlab" },
            { label: "CircleCI", slug: "providers/circleci" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Options", slug: "reference/options" },
            { label: "Workspace detection", slug: "reference/workspace-detection" },
          ],
        },
      ],
    }),
  ],
});
