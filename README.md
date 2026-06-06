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
| `circleci` | `--org-id` `--project-id` `--pipeline-definition-id` `--vcs-origin <url>`                        | `--context-id` (repeatable) |

At least one of `--allow-publish` / `--allow-stage-publish` is required.

```bash
# GitLab
npx trustci --provider gitlab --project me/repo --file .gitlab-ci.yml --allow-publish -y

# CircleCI (vcs-origin must include the protocol)
npx trustci --provider circleci \
  --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> \
  --vcs-origin https://github.com/me/repo \
  --context-id <uuid> \
  --allow-publish
```

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
bun run build   # -> dist/cli.js (npx entry point), via `bun build --target node`
```

## License

MIT
