---
title: GitLab CI/CD
description: Register a GitLab CI/CD pipeline as the trusted publisher.
---

| Required flags | Optional |
| --- | --- |
| `--project <group/project>` (or `--repo`) `--file <workflow>` | `--env <name>` |

`--repo` is accepted as an alias for `--project`.

```bash
npx trustci --provider gitlab --project me/repo --file .gitlab-ci.yml --allow-publish -y
```

Each flag is passed to `npm trust gitlab` as follows:

| trustci | `npm trust gitlab` |
| --- | --- |
| `--project` / `--repo` | `--project` |
| `--file` | `--file` |
| `--env` | `--environment` |
