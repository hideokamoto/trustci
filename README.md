# trustci

Bulk-register [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)
across **all public packages in a monorepo** with a single command. Wraps
`npm trust` and supports **GitHub Actions**, **GitLab CI/CD**, and **CircleCI**.

Setting up trusted publishing one package at a time is tedious in a monorepo.
`trustci` detects your workspace, finds every public package, and runs the right
`npm trust <provider> …` for each.

## Requirements

- **npm** 11.5.1 or later (for `npm trust`)
- **Node** 22.14.0 or later

## Usage

```bash
# Preview the commands without running anything (recommended first step)
npx trustci --dry-run --provider github --repo me/repo --file release.yml --allow-publish

# Actually register (asks for confirmation unless -y)
npx trustci --provider github --repo me/repo --file release.yml --allow-publish

# List current trusted publishers for every public package
npx trustci list
```

### Providers

| Provider   | Required flags                                                                                  | Optional        |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------- |
| `github`   | `--repo <owner/repo>` `--file <workflow>`                                                       | `--env <name>`  |
| `gitlab`   | `--project <group/project>` (or `--repo`) `--file <workflow>`                                   | `--env <name>`  |
| `circleci` | Either all of `--org-id` `--project-id` `--pipeline-definition-id`, or a CircleCI token | `--vcs-origin <host/owner/repo>`, `--circle-token`, `--file`, `--context-id` (repeatable) |

At least one of `--allow-publish` / `--allow-stage-publish` is required.

```bash
# GitLab
npx trustci --provider gitlab --project me/repo --file .gitlab-ci.yml --allow-publish -y

# CircleCI (vcs-origin is host/owner/repo; a leading https:// is stripped automatically)
npx trustci --provider circleci \
  --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> \
  --vcs-origin github.com/me/repo \
  --context-id <uuid> \
  --allow-publish
```

#### CircleCI `--vcs-origin`

When `--vcs-origin` is omitted, trustci takes it from the root `package.json`
`repository` field (URL, `git+https://…`, `git@host:owner/repo`, or the
`github:` / `gitlab:` / `bitbucket:` / `owner/repo` shorthands), then from
`git remote get-url origin`. It prints which one it used, and warns when the two
disagree (`package.json` wins, since it is committed rather than clone-specific).

#### CircleCI token lookup

When any of the three UUIDs is missing, trustci resolves it through the CircleCI
API v2. The token is taken from the first of these that is set, and trustci
prints which one it used (never the token itself):

1. `--circle-token`
2. `CIRCLE_TOKEN` (circleci CLI v1, chunk)
3. `CIRCLECI_TOKEN` (chunk)
4. `CIRCLE_CLI_TOKEN` (circleci CLI v1, legacy alias)
5. `CIRCLECI_CLI_TOKEN` (circleci CLI v0.1)
6. `token` in `~/.circleci/cli.yml`, written by `circleci setup` in circleci CLI v0.1.
   It is ignored when its `host` is not `https://circleci.com`.

The OS keychain, where circleci CLI v1 and chunk store tokens by default, is not read.
When all three UUIDs are given, no token is looked up.

### Common options

| Flag                     | Description                                          |
| ------------------------ | --------------------------------------------------- |
| `--dry-run`              | Print the `npm trust` commands without executing.   |
| `--only <name-glob>`     | Only include packages matching (repeatable).        |
| `--exclude <name-glob>`  | Exclude packages matching (repeatable).             |
| `-y`, `--yes`            | Skip the confirmation prompt (and npm's).           |
| `-h`, `--help`           | Show help.                                          |
| `-v`, `--version`        | Show version.                                       |

## Workspace detection

Patterns are read from the first of:

1. `pnpm-workspace.yaml` (`packages:`)
2. `package.json` (`workspaces`)
3. `lerna.json` (`packages`)

Packages marked `"private": true` are always excluded. On a real (non-dry) run,
packages not yet published to the registry are skipped with a warning.

## Development

Built with [Bun](https://bun.sh), ships zero runtime dependencies, and the
published artifact is plain Node-compatible JS.

```bash
bun install
bun test
bun run typecheck
bun run build   # -> dist/cli.js (npx entry point), via `bun build --target node`
```

The documentation site lives in `docs/` ([Astro Starlight](https://starlight.astro.build/)):

```bash
cd docs
bun install
bun run dev     # local preview
bun run build   # -> docs/dist
```

`bun install` also enables a husky `commit-msg` hook that runs
[commitlint](https://commitlint.js.org/) with `@commitlint/config-conventional`,
so every commit must be a [Conventional Commit](https://www.conventionalcommits.org/).

## Releasing

Releases are automated: every merge to `main` runs the CircleCI config
`workflows/publish/npm-polyrepo-bun-semantic-release.yaml` from
[hideokamoto/circleci-configurations](https://github.com/hideokamoto/circleci-configurations).
[semantic-release](https://github.com/semantic-release/semantic-release) decides the
next version from the commits since the latest `v*` tag, pushes the tag, publishes
to npm via Trusted Publishing (OIDC), and creates the GitHub Release.

| Commit | Release |
| --- | --- |
| `fix:` / `perf:` | patch |
| `feat:` | minor |
| `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer | major |
| `chore:` / `docs:` / `ci:` / `test:` / `refactor:` … | none |

Do not bump `version` in `package.json`, create tags, or run `npm publish` manually.
Release notes are published on
[GitHub Releases](https://github.com/hideokamoto/trustci/releases).

## License

MIT
