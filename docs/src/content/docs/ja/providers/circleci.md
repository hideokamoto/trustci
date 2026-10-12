---
title: CircleCI
description: CircleCI のパイプラインを Trusted Publisher として登録します。
---

`npm trust circleci` には `--org-id`、`--project-id`、`--pipeline-definition-id`、
`--vcs-origin` の 4 つの値が必要です。trustci は、指定されなかった値を補完します。

| 必須 | 任意 |
| --- | --- |
| `--org-id` `--project-id` `--pipeline-definition-id` の 3 つすべて、または CircleCI のトークン | `--vcs-origin <host/owner/repo>`（推定される）、`--circle-token`、`--file`、`--context-id`（複数指定可） |

```bash
# 最小構成: UUID は API で解決され、--vcs-origin は推定されるので、
# 追加で必要なのはトークン（ここでは環境変数）だけ
CIRCLE_TOKEN=... npx trustci --provider circleci --allow-publish

# すべて明示する構成: トークン不要で API も呼ばない
# （vcs-origin は host/owner/repo 形式。先頭の https:// は自動で取り除かれる）
npx trustci --provider circleci \
  --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> \
  --vcs-origin github.com/me/repo \
  --context-id <uuid> \
  --allow-publish
```

指定されていない UUID は `--dry-run` でも読み取り専用の API 呼び出しで解決されるため、
表示されるコマンドには実際の ID が入ります。

## `--vcs-origin`

`--vcs-origin` を省略すると、trustci はルートの `package.json` の `repository` フィールド
（URL、`git+https://…`、`git@host:owner/repo`、または `github:` / `gitlab:` / `bitbucket:` /
`owner/repo` の短縮形）から取得し、なければ `git remote get-url origin` から取得します。
どちらを使ったかを表示し、両者が食い違う場合は警告します（`package.json` はコミットされて
おりクローンごとに変わらないため、`package.json` が優先されます）。

## ID の解決方法

- `--org-id` と `--project-id` は `GET /api/v2/project/{slug}` から取得します。slug は
  `--vcs-origin` から作られます。slug に変換できるのは github.com、gitlab.com、
  bitbucket.org（とそのサブドメイン）だけです。
- `--pipeline-definition-id` は `GET /api/v2/projects/{project-id}/pipeline-definitions`
  から取得します。

## パイプライン定義と `--file`

プロジェクトのパイプライン定義が 1 つだけなら、それが自動的に使われます。複数ある場合
（例: `.circleci/config.yml` とは別に、他のリポジトリの config を参照している場合）は、
定義の config ファイルパスまたは名前を `--file` で指定してください。指定しないと trustci は
停止し、候補を一覧表示します。

```bash
npx trustci --provider circleci --allow-publish \
  --file workflows/publish/npm-polyrepo-bun-semantic-release.yaml
```

`--file` はこの検索にだけ使われます。`npm trust` には渡されず、`--pipeline-definition-id`
を明示した場合は効果がありません。

## トークンの検索順

3 つの UUID のいずれかが指定されていない場合、trustci には CircleCI API トークンが必要です。
次のうち最初に設定されているものを使い、どれを使ったかを表示します（トークンそのものは表示しません）。

1. `--circle-token`
2. `CIRCLE_TOKEN`（circleci CLI v1、chunk）
3. `CIRCLECI_TOKEN`（chunk）
4. `CIRCLE_CLI_TOKEN`（circleci CLI v1 の旧エイリアス）
5. `CIRCLECI_CLI_TOKEN`（circleci CLI v0.1）
6. `~/.circleci/cli.yml` の `token`（circleci CLI v0.1 の `circleci setup` が書き込むもの）。
   `host` が `https://circleci.com` でない場合や、トークンが 1 行の値でない場合は無視されます。

circleci CLI v1 と chunk がデフォルトでトークンを保存する OS のキーチェーンは読みません。
明示した UUID は自動解決より優先され、3 つすべてを指定した場合はトークンを探しません。

CircleCI が 401 または 403 を返した場合、trustci はどのトークンの取得元が拒否されたかを表示します。
