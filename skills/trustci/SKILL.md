---
name: trustci
description: Register npm Trusted Publishers (npm trust) for every public package in a repository or monorepo with the trustci CLI, for GitHub Actions, GitLab CI/CD or CircleCI. Use when the user wants to set up npm trusted publishing / OIDC publishing, run or preview `npm trust github|gitlab|circleci` across workspace packages, list the current trusted publishers, or mentions trustci.
license: MIT
compatibility: Requires npm 11.15.0+ and Node 22.14.0+, network access to the npm registry, and an npm account with 2FA and write access to the packages.
---

# trustci

trustci finds every public package in the workspace and runs
`npm trust <provider> <package> …` for each. Full docs: https://trustci.hidetaka.dev

## Ground rules

- Registering a trusted publisher changes the package's settings on the npm
  registry. Always run `--dry-run` first, show the printed commands to the user,
  and run the real command only after they confirm.
- Run trustci from the repository root; workspace detection starts from the
  current directory.
- A real run asks `Proceed? [y/N]` and stops when stdin is not a terminal, so in
  an agent shell it needs `-y`. `-y` is also passed to `npm trust`. Only add it
  after the user has confirmed the dry-run output.
- npm itself requires 2FA on the account and write access to each package. The
  first `npm trust` call requires 2FA, which the user has to complete. Tokens with "bypass 2FA" and username/password logins do not work.
- At least one of `--allow-publish` / `--allow-stage-publish` is required. Use
  `--allow-publish` unless the user asks for staged publishing.

## Steps

1. Check `npm --version` (11.15.0 or later) and `node --version` (22.14.0 or later).
   With `--dry-run` an older version is only a warning.
2. Identify the CI provider and the publishing workflow from the repository:
   - `.github/workflows/*.yml` → `github`; `--file` is the workflow file name
     (e.g. `release.yml`), `--repo` is `owner/repo`.
   - `.gitlab-ci.yml` → `gitlab`; `--project` is `group/project`, `--file` is the
     CI file path.
   - `.circleci/config.yml`, or a CircleCI config sourced from another repository
     → `circleci` (see below).
   - If the job publishes from a protected environment, pass it with `--env`
     (github / gitlab only).
   Ask the user when the provider or workflow is ambiguous; do not guess.
3. Preview:

   ```bash
   npx trustci --dry-run --provider github --repo owner/repo --file release.yml --allow-publish
   ```

   Narrow the targets with `--only '<glob>'` / `--exclude '<glob>'` (repeatable,
   matched against the whole package name, `*` also matches `/`; quote them).
4. After the user confirms, run the command printed on the last line of the dry-run
   output (`# To register, run …`), or hand it to the user when they have to run it
   (e.g. for 2FA). It is the flags you passed, without `--dry-run`, plus `-y`. Do
   not copy UUIDs or `--vcs-origin` from the `npm trust` lines into it: trustci
   resolves them again. `--circle-token` is left out; never add the token back.
   Packages not yet published to the registry are skipped with a warning (npm can
   only configure packages that already exist); report them to the user.
5. Verify with `npx trustci list` (every public package) or
   `npx trustci list <package>`.

## CircleCI

`npm trust circleci` needs `--org-id`, `--project-id`, `--pipeline-definition-id`
and `--vcs-origin`. trustci fills in missing ones:

- `--vcs-origin` (`host/owner/repo`) comes from the root `package.json`
  `repository`, then `git remote get-url origin`.
- Missing UUIDs are fetched from the CircleCI API v2 (read-only, also under
  `--dry-run`). The token comes from `--circle-token`, `CIRCLE_TOKEN`,
  `CIRCLECI_TOKEN`, `CIRCLE_CLI_TOKEN`, `CIRCLECI_CLI_TOKEN`, or
  `~/.circleci/cli.yml`, in that order. The OS keychain is not read. Never print
  or echo the token.
- When the project has several pipeline definitions, trustci stops and lists
  them. Re-run with `--file <config path or definition name>` chosen from that
  list. `--file` is not passed to `npm trust`.
- `--context-id <uuid>` (repeatable) is passed through: the trusted publisher
  then also has to match those CircleCI context IDs.

```bash
npx trustci --dry-run --provider circleci --allow-publish
npx trustci --dry-run --provider circleci --allow-publish --file .circleci/config.yml
```

## Workspace detection

Packages come from the first of `pnpm-workspace.yaml`, `package.json`
`workspaces`, or `lerna.json`; with none of them, the root `package.json` is
treated as a single package. `"private": true` packages are always excluded.

Run `npx trustci --help` for the full flag list.
