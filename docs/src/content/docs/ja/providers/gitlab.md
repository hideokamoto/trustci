---
title: GitLab CI/CD
description: GitLab CI/CD のパイプラインを Trusted Publisher として登録します。
---

| 必須フラグ | 任意 |
| --- | --- |
| `--project <group/project>`（または `--repo`）`--file <workflow>` | `--env <name>` |

`--repo` は `--project` の別名として使えます。

```bash
npx trustci --provider gitlab --project me/repo --file .gitlab-ci.yml --allow-publish -y
```

各フラグは次のように `npm trust gitlab` に渡されます。

| trustci | `npm trust gitlab` |
| --- | --- |
| `--project` / `--repo` | `--project` |
| `--file` | `--file` |
| `--env` | `--environment` |
