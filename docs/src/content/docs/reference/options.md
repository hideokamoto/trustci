---
title: Options
description: Command-line options common to all providers.
---

## Permissions

At least one is required.

| Flag | Description |
| --- | --- |
| `--allow-publish` | Allow `npm publish`. |
| `--allow-stage-publish` | Allow `npm stage publish`. |

## Common options

| Flag | Description |
| --- | --- |
| `--dry-run` | Print the `npm trust` commands without executing. |
| `--only <name-glob>` | Only include packages matching (repeatable). |
| `--exclude <name-glob>` | Exclude packages matching (repeatable). |
| `-y`, `--yes` | Skip the confirmation prompt (and npm's). |
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show version. |

Provider-specific flags are listed on each provider page.
