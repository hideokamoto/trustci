---
title: GitHub Actions
description: Register a GitHub Actions workflow as the trusted publisher.
---

| Required flags | Optional |
| --- | --- |
| `--repo <owner/repo>` `--file <workflow>` | `--env <name>` |

```bash
npx trustci --provider github --repo me/repo --file release.yml --allow-publish
```

Each flag is passed to `npm trust github` as follows:

| trustci | `npm trust github` |
| --- | --- |
| `--repo` | `--repository` |
| `--file` | `--file` |
| `--env` | `--environment` |
