## Summary

<!-- What does this PR change and why? -->

## Release impact

<!--
semantic-release derives the version bump from every commit merged into main
(not only the PR title), so each commit on this branch MUST be a Conventional Commit:

  fix: / perf:    -> patch release
  feat:           -> minor release
  feat!: / fix!:  -> major release (breaking)
  chore:, docs:, ci:, test:, refactor:, style:, build:, revert:
                  -> no release

Local commits are validated by commitlint via the husky commit-msg hook, and the
CircleCI test job re-checks the branch's commits.
-->

- [ ] Every commit on this branch is a Conventional Commit (`feat:`, `fix:`, `chore:`, ...)
- [ ] `bun run typecheck`, `bun test`, and `bun run build` pass locally
