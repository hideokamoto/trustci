---
title: CircleCI
description: Register a CircleCI pipeline as the trusted publisher.
---

`npm trust circleci` needs four values: `--org-id`, `--project-id`,
`--pipeline-definition-id` and `--vcs-origin`. trustci fills in any of them you
leave out.

| Required | Optional |
| --- | --- |
| Either all of `--org-id` `--project-id` `--pipeline-definition-id`, or a CircleCI token | `--vcs-origin <host/owner/repo>` (inferred), `--circle-token`, `--file`, `--context-id` (repeatable) |

```bash
# Minimal form: UUIDs are resolved via the API and --vcs-origin is inferred,
# so a token (here via the environment) is all you need to add
CIRCLE_TOKEN=... npx trustci --provider circleci --allow-publish

# Fully explicit form: no token and no API call
# (vcs-origin is host/owner/repo; a leading https:// is stripped automatically)
npx trustci --provider circleci \
  --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> \
  --vcs-origin github.com/me/repo \
  --context-id <uuid> \
  --allow-publish
```

Missing UUIDs are resolved with read-only API calls even under `--dry-run`, so the
printed commands contain real IDs.

## `--vcs-origin`

When `--vcs-origin` is omitted, trustci takes it from the root `package.json`
`repository` field (URL, `git+https://…`, `git@host:owner/repo`, or the
`github:` / `gitlab:` / `bitbucket:` / `owner/repo` shorthands), then from
`git remote get-url origin`. It prints which one it used, and warns when the two
disagree (`package.json` wins, since it is committed rather than clone-specific).

## Resolving the IDs

- `--org-id` and `--project-id` come from `GET /api/v2/project/{slug}`, where the
  slug is derived from `--vcs-origin`. Only github.com, gitlab.com and bitbucket.org
  (and their subdomains) can be converted to a slug.
- `--pipeline-definition-id` comes from
  `GET /api/v2/projects/{project-id}/pipeline-definitions`.

## Pipeline definitions and `--file`

When the project has exactly one pipeline definition, it is used automatically.
When it has several — e.g. a config sourced from another repository alongside
`.circleci/config.yml` — pass `--file` with either the definition's config file path
or its name; without it trustci stops and lists the candidates:

```bash
npx trustci --provider circleci --allow-publish \
  --file workflows/publish/npm-polyrepo-bun-semantic-release.yaml
```

`--file` is only used for this lookup — it is not passed to `npm trust`, and it has
no effect when `--pipeline-definition-id` is given explicitly.

## Token lookup

When any of the three UUIDs is missing, trustci needs a CircleCI API token. It is
taken from the first of these that is set, and trustci prints which one it used
(never the token itself):

1. `--circle-token`
2. `CIRCLE_TOKEN` (circleci CLI v1, chunk)
3. `CIRCLECI_TOKEN` (chunk)
4. `CIRCLE_CLI_TOKEN` (circleci CLI v1, legacy alias)
5. `CIRCLECI_CLI_TOKEN` (circleci CLI v0.1)
6. `token` in `~/.circleci/cli.yml`, written by `circleci setup` in circleci CLI v0.1.
   It is ignored when its `host` is not `https://circleci.com`, or when the token
   is not a single-line value.

The OS keychain, where circleci CLI v1 and chunk store tokens by default, is not read.
Explicit UUIDs override auto-resolution; when all three are given, no token is looked up.

If CircleCI answers 401 or 403, trustci reports which token source was rejected.
