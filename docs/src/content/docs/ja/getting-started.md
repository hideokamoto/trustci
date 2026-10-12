---
title: はじめに
description: trustci の動作要件と最初の実行方法。
---

## 動作要件

- **npm** 11.15.0 以上（`--allow-publish` / `--allow-stage-publish` 付きの `npm trust` を使うため）
- **Node** 22.14.0 以上

trustci は最初に両方のバージョンを確認します。本番実行では古いバージョンはエラーになり、
`--dry-run` では npm を呼び出さないため警告にとどまります。

## 使い方

```bash
# 何も実行せずにコマンドをプレビューする（最初はこれを推奨）
npx trustci --dry-run --provider github --repo me/repo --file release.yml --allow-publish

# 実際に登録する（-y を付けない限り確認を求める）
npx trustci --provider github --repo me/repo --file release.yml --allow-publish

# すべての公開パッケージについて、現在の Trusted Publisher を一覧表示する
npx trustci list
```

trustci はリポジトリのルートで実行してください。ワークスペースの検出はカレントディレクトリから始まります。

`trust` は省略可能な先頭のサブコマンドです。`trustci --provider …` と
`trustci trust --provider …` は同じ意味です。

`--allow-publish` と `--allow-stage-publish` の少なくとも一方が必須です。

## 実行時の動作

1. ワークスペースのパッケージを見つけ、private なパッケージと `--only` / `--exclude`
   で除外されたパッケージを取り除きます（[ワークスペースの検出](/ja/reference/workspace-detection/)を参照）。
2. `--dry-run` の場合は、パッケージごとに `npm trust <provider> <package> …` を 1 行ずつ
   表示して終了します。レジストリの確認もコマンドの実行も行いません。
3. それ以外の場合は、各パッケージを `npm view <package> version` で確認します。まだ公開されて
   いないパッケージ（レジストリが 404 を返すもの）は警告を出してスキップします。404 以外の
   レジストリエラーが起きた場合は実行を中止します。
4. 登録対象のパッケージを一覧表示し、`Proceed? [y/N]` と確認します。`-y` を付けると確認を
   省略できます。標準入力が端末でない場合（CI など）は `-y` が必須です。
5. 各パッケージに対して `npm trust` を実行します。1 つでも失敗すると終了コードは 0 以外になります。

## `trustci list`

```bash
npx trustci list            # すべての公開ワークスペースパッケージ
npx trustci list my-package # 1 つのパッケージ
npx trustci list --dry-run  # npm trust list コマンドを表示するだけ
```

対象ごとに `npm trust list <package>` を実行します。

## エージェントスキル

リポジトリには [Agent Skill](https://agentskills.io/) を
[`skills/trustci/SKILL.md`](https://github.com/hideokamoto/trustci/blob/main/skills/trustci/SKILL.md)
として同梱しています。コーディングエージェント（Claude Code、Codex、Cursor など）に、
まず `--dry-run` で確認し、利用者の承認後にだけ本実行するという trustci の使い方を教えるものです。
[`skills`](https://github.com/vercel-labs/skills) CLI でインストールできます。

```bash
npx skills add hideokamoto/trustci
```

## 次のステップ

- プロバイダーごとのフラグ: [GitHub Actions](/ja/providers/github/)、
  [GitLab CI/CD](/ja/providers/gitlab/)、[CircleCI](/ja/providers/circleci/)
- [すべてのオプション](/ja/reference/options/)
- [パッケージの見つけ方](/ja/reference/workspace-detection/)
