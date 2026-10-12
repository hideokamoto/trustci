---
title: GitHub Actions
description: GitHub Actions のワークフローを Trusted Publisher として登録します。
---

| 必須フラグ | 任意 |
| --- | --- |
| `--repo <owner/repo>` `--file <workflow>` | `--env <name>` |

```bash
npx trustci --provider github --repo me/repo --file release.yml --allow-publish
```

各フラグは次のように `npm trust github` に渡されます。

| trustci | `npm trust github` |
| --- | --- |
| `--repo` | `--repository` |
| `--file` | `--file` |
| `--env` | `--environment` |
