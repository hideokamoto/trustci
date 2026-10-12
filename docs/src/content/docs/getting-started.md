---
title: Getting started
description: Requirements and first run of trustci.
---

## Requirements

- **npm** 11.5.1 or later (for `npm trust`)
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
   package and stops. The registry is not checked and nothing is executed.
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

## Next steps

- Provider-specific flags: [GitHub Actions](/providers/github/),
  [GitLab CI/CD](/providers/gitlab/), [CircleCI](/providers/circleci/)
- [All options](/reference/options/)
- [How packages are found](/reference/workspace-detection/)
