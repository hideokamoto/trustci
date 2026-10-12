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
      // English stays at the root so existing URLs keep working; Japanese lives under /ja/.
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語", lang: "ja" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/hideokamoto/trustci" },
      ],
      editLink: {
        baseUrl: "https://github.com/hideokamoto/trustci/edit/main/docs/",
      },
      sidebar: [
        {
          label: "Getting started",
          translations: { ja: "はじめに" },
          slug: "getting-started",
        },
        {
          label: "Providers",
          translations: { ja: "プロバイダー" },
          items: [
            { label: "GitHub Actions", slug: "providers/github" },
            { label: "GitLab CI/CD", slug: "providers/gitlab" },
            { label: "CircleCI", slug: "providers/circleci" },
          ],
        },
        {
          label: "Reference",
          translations: { ja: "リファレンス" },
          items: [
            { label: "Options", translations: { ja: "オプション" }, slug: "reference/options" },
            {
              label: "Workspace detection",
              translations: { ja: "ワークスペースの検出" },
              slug: "reference/workspace-detection",
            },
          ],
        },
      ],
    }),
  ],
});
