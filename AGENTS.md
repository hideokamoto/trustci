# AGENTS.md

## Commands

- `nix develop` — optional shell with the toolchain pinned by `flake.lock` (Node 24 for
  npm >= `MIN_NPM`, and Bun); keep `flake.nix`'s Bun in step with `package.json`
  `packageManager` and `@types/bun`. CI does not use it
- `bun install` — install dependencies (also enables the husky `commit-msg` hook)
- `bun run typecheck` — `tsc --noEmit`
- `bun test` — unit tests
- `bun run build` — bundle `src/cli.ts` to `dist/cli.js`
- `cd docs && bun install && bun run dev` — documentation site (Astro Starlight), a separate
  package with its own `bun.lock`; `bun run build` there writes `docs/dist`

## Documentation site

`docs/` is deployed to GitHub Pages at https://trustci.hidetaka.dev by
`.github/workflows/deploy-docs.yml` on pushes to `main` that touch `docs/` or `skills/`. This is the
only GitHub Actions workflow; tests and releases stay on CircleCI. The custom domain is
configured in the repository's Settings → Pages (Source: GitHub Actions), with a DNS
CNAME `trustci` → `hideokamoto.github.io`. Use `docs:` commits for site changes so they
do not trigger an npm release.

## Agent skill

`skills/trustci/SKILL.md` (Agent Skills format, installed with
`npx skills add hideokamoto/trustci`) describes the CLI for coding agents. Update it
together with `--help`, `README.md` and `docs/` when flags or behavior change.
`test/skill.test.ts` checks that its npm/Node minimums match `src/npm.ts`.

The docs site serves the same file (read at build time, never copied) at `/skill.md`
and `/.well-known/agent-skills/trustci/SKILL.md`, with a discovery index at
`/.well-known/agent-skills/index.json` (`docs/src/pages/`, `docs/src/lib/skill.ts`).
`starlight-llms-txt` generates `/llms.txt`, `/llms-full.txt` and `/llms-small.txt`,
and every page links to `/llms.txt` with `<link rel="describedby">`.

## Releases (automated — do not release manually)

Every push to `main` triggers the CircleCI pipeline that uses
`hideokamoto/circleci-configurations` →
`workflows/publish/npm-polyrepo-bun-semantic-release.yaml` (no CircleCI YAML lives here).

- Flow: `test` job (typecheck, build, test) →
  `release` job on `main` runs semantic-release: decides the next version from
  Conventional Commits since the latest `v*` tag, verifies npm OIDC + git push access,
  pushes the `v*` tag, publishes via npm Trusted Publishing (OIDC), and creates the
  GitHub Release. No Release PR; nothing is committed back to `main`.
- Config: `.releaserc.json` (preset `conventionalcommits`, so `feat!:` is a major bump)

### Commit convention (required)

semantic-release reads **every commit** reachable since the last tag, including the
individual commits inside a merged PR branch (not just the merge subject).
`feat:` → minor, `fix:` / `perf:` → patch, `feat!:` or a `BREAKING CHANGE:` footer → major.
`chore:` / `docs:` / `ci:` / `test:` / `refactor:` / merge commits do not release.
Do not write `BREAKING CHANGE:` in a commit body unless you mean a major release.

Agents MUST write Conventional Commit messages and must never bypass the hook
(`--no-verify`). The husky `commit-msg` hook (`.husky/commit-msg`, `commitlint.config.js`)
is active only after `bun install`. CI does not re-check commit messages — the
hook is the only enforcement, so commits made without it (web merges, plumbing
commands, environments without `bun install`) reach main unverified.

### Do NOT

- Edit `package.json` `version` — the published version comes from the git tag and is
  written only inside the CI job
- Run `git tag`, `npm version`, `npm publish`, or `np`
- Delete or move `v*` tags — they are the source of truth for the last released version

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No publish after merge | Did the merged commits include `feat:`/`fix:`/`perf:`? Check the CircleCI `release` job log (`There are no relevant changes` = nothing to release) |
| `commitlint` rejects a commit message | Reword the commit (`git commit --amend` / interactive rebase); never use `--no-verify` |
| semantic-release `EGITNOPERMISSION` / GitHub 403 | `github` context `GITHUB_TOKEN` needs `contents:write` and this repo in scope |
| Tag pushed but npm publish failed | Delete that `v*` tag (and its GitHub Release if created), then rerun the pipeline |
| `ENEEDAUTH` on publish | npm Trusted Publisher (CircleCI) registration: Org/Project/Pipeline-definition IDs and Context IDs (`npm-publish-guard`) |

## Setup reference (for re-provisioning)

- CircleCI project: `gh/hideokamoto/trustci`
- Contexts: `github` (`GITHUB_TOKEN`), `npm-publish-guard` (restricted context, no secrets)
- Verify trusted publisher: `npm trust list trustci`
