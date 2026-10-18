---
title: Options
description: Command-line options common to all providers.
---

## Commands

| Command | Description |
| --- | --- |
| `trustci [trust] --provider <github\|gitlab\|circleci> …` | Register trusted publishers. `trust` is optional. |
| `trustci list [package]` | Run `npm trust list` for one package, or for every public workspace package. |

## Permissions

At least one is required. Both are passed through to `npm trust`.

| Flag | Description |
| --- | --- |
| `--allow-publish` | Allow `npm publish`. |
| `--allow-stage-publish` | Allow `npm stage publish`. |

## Common options

| Flag | Description |
| --- | --- |
| `--dry-run` | Print the `npm trust` commands without executing, then the `trustci` command for the real run (the flags you passed, without `--dry-run`, plus `-y`; `trust` only). Also works with `list`. |
| `--only <name-glob>` | Only include packages whose name matches (repeatable). |
| `--exclude <name-glob>` | Exclude packages whose name matches (repeatable). |
| `-y`, `--yes` | Skip the confirmation prompt, and pass `-y` to `npm trust` to skip npm's. Required when stdin is not a terminal. |
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show version. |

`--only` and `--exclude` match the whole package name. `*` matches any characters
(including `/`) and `?` matches one character, so `--only '@scope/*'` selects every
package in a scope. When both are given, a package must match an `--only` pattern
and no `--exclude` pattern. Quote the patterns so the shell does not expand them.

Provider-specific flags are listed on each provider page.
