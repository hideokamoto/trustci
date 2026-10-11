---
title: CircleCI
description: Register a CircleCI pipeline as the trusted publisher.
---

| Required | Optional |
| --- | --- |
| Either all of `--org-id` `--project-id` `--pipeline-definition-id`, or a CircleCI token | `--vcs-origin <host/owner/repo>`, `--circle-token`, `--file`, `--context-id` (repeatable) |

```bash
# vcs-origin is host/owner/repo; a leading https:// is stripped automatically
npx trustci --provider circleci \
  --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> \
  --vcs-origin github.com/me/repo \
  --context-id <uuid> \
  --allow-publish

# With a token, missing IDs are resolved through the CircleCI API v2
CIRCLE_TOKEN=... npx trustci --provider circleci --allow-publish
```

## `--vcs-origin`

When `--vcs-origin` is omitted, trustci takes it from the root `package.json`
`repository` field (URL, `git+https://…`, `git@host:owner/repo`, or the
`github:` / `gitlab:` / `bitbucket:` / `owner/repo` shorthands), then from
`git remote get-url origin`. It prints which one it used, and warns when the two
disagree (`package.json` wins, since it is committed rather than clone-specific).

## Token lookup

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
Explicit UUIDs override auto-resolution; when all three are given, no token is looked up.
