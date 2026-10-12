---
title: Workspace detection
description: How trustci finds the packages to register.
---

Patterns are read from the first of these that yields at least one pattern:

1. `pnpm-workspace.yaml` (`packages:`)
2. `package.json` (`workspaces`, either an array or `workspaces.packages`)
3. `lerna.json` (`packages`; `["packages/*"]` when the field is missing)

If none of them yields a pattern, the root `package.json` is used as a
single-package fallback.

## Pattern syntax

Patterns are relative to the repository root.

- `*` matches within one directory level, `?` matches one character.
- `**` matches any number of directory levels; `apps/**` also matches `apps` itself.
- A leading `!` removes directories matched by the other patterns.

`node_modules`, `.git`, `dist`, `build`, `coverage` and `.turbo` are never
searched.

A matched directory counts as a package when its `package.json` has a non-empty
`name`. If two directories have the same package name, the first one (in path
order) is used.

## Which packages are registered

Packages marked `"private": true` are always excluded, then `--only` / `--exclude`
are applied (see [Options](/reference/options/)). On a real (non-dry) run,
packages not yet published to the registry are skipped with a warning.
