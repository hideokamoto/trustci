---
title: Getting started
description: Requirements and first run of trustci.
---

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

`trust` is an optional leading subcommand: `trustci --provider …` and
`trustci trust --provider …` are equivalent. `trustci list [package]` lists the
current trusted publishers.

At least one of `--allow-publish` / `--allow-stage-publish` is required.

## Next steps

- Provider-specific flags: [GitHub Actions](/providers/github/),
  [GitLab CI/CD](/providers/gitlab/), [CircleCI](/providers/circleci/)
- [All options](/reference/options/)
- [How packages are found](/reference/workspace-detection/)
