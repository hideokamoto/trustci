---
title: Workspace detection
description: How trustci finds the packages to register.
---

Patterns are read from the first of:

1. `pnpm-workspace.yaml` (`packages:`)
2. `package.json` (`workspaces`)
3. `lerna.json` (`packages`)

If no workspace config is found, the root `package.json` is used as a
single-package fallback.

Packages marked `"private": true` are always excluded. On a real (non-dry) run,
packages not yet published to the registry are skipped with a warning.
