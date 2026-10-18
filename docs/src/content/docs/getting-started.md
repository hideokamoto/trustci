---
title: Getting started
description: Requirements and first run of trustci.
---

## Requirements

- **npm** 11.15.0 or later (for `npm trust` with `--allow-publish` / `--allow-stage-publish`)
- **Node** 22.14.0 or later

trustci checks both versions before doing anything else. On a real run an older
version is an error; with `--dry-run` it is only a warning, because npm is not
invoked.

## Usage

```bash
# Preview the commands without running anything (recommended first step)
npx trustci --dry-run --provider github --repo me/repo --file release.yml --allow-publish

# Actually register (asks for confirmation unless -y)
npx trustci --provider github --repo me/repo --file release.yml --allow-publish

# List current trusted publishers for every public package
npx trustci list
```

Run trustci from the repository root: workspace detection starts from the current
directory.

`trust` is an optional leading subcommand: `trustci --provider …` and
`trustci trust --provider …` are equivalent.

At least one of `--allow-publish` / `--allow-stage-publish` is required.

## What a run does

1. Finds the workspace packages and drops private ones and those filtered out by
   `--only` / `--exclude` (see [Workspace detection](/reference/workspace-detection/)).
2. With `--dry-run`, prints one `npm trust <provider> <package> …` command per
   package and stops. The registry is not checked and nothing is executed. The
   last line is the `trustci` command for the real run: the flags you passed,
   without `--dry-run`, plus `-y`. Values trustci resolved itself (CircleCI UUIDs,
   `--vcs-origin`) are left out and resolved again, and `--circle-token` is
   dropped so the token is never printed.
3. Otherwise, checks each package with `npm view <package> version`. Packages that
   are not published yet (registry 404) are skipped with a warning. Any other
   registry error stops the run.
4. Lists the packages it will register and asks `Proceed? [y/N]`. Pass `-y` to
   skip the prompt; it is required when stdin is not a terminal (for example in CI).
5. Runs `npm trust` for each package. The exit code is non-zero if any package failed.

## `trustci list`

```bash
npx trustci list            # every public workspace package
npx trustci list my-package # one package
npx trustci list --dry-run  # print the npm trust list commands only
```

Runs `npm trust list <package>` for each target.

## Agent skill

The repository ships an [Agent Skill](https://agentskills.io/) at
[`skills/trustci/SKILL.md`](https://github.com/hideokamoto/trustci/blob/main/skills/trustci/SKILL.md)
that teaches coding agents (Claude Code, Codex, Cursor, …) to run trustci safely:
dry-run first, then a real run only after you confirm. Install it with the
[`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add hideokamoto/trustci
```

This site also serves it over HTTP at [`/skill.md`](/skill.md), listed in the
[Agent Skills discovery index](/.well-known/agent-skills/index.json), and an
[`llms.txt`](/llms.txt) for the whole documentation.

## Next steps

- Provider-specific flags: [GitHub Actions](/providers/github/),
  [GitLab CI/CD](/providers/gitlab/), [CircleCI](/providers/circleci/)
- [All options](/reference/options/)
- [How packages are found](/reference/workspace-detection/)
