# X posting workflow

This repository intentionally requires human approval before publishing to X.

## One-time setup

Run the **Initialize X Posting Labels** workflow once from the Actions tab. It creates these labels:

- `x:share` — a user-visible release worth an individual post.
- `x:devlog` — a smaller change suitable for the weekly devlog.
- `x:review` — created drafts waiting for editorial review.
- `x:posted` — drafts that have already been published.

Add the `X_USER_ACCESS_TOKEN` repository secret. It must be an X API user-context token with permission to create posts. Keep `X_POSTING_ENABLED` unset until the first draft and approval flow have been tested. Set the repository variable to `true` only when publishing is intended.

## Individual release post

1. Add `x:share` to a PR that has a player-visible improvement.
2. Merge it into `main`. The workflow creates an issue labeled `x:review`.
3. Edit the text between `<!-- x-post:start -->` and `<!-- x-post:end -->`. This workflow publishes text only. For a screenshot or video post, publish the approved copy manually from X instead.
4. Comment exactly `/post-x` on the issue.

## Weekly devlog

PRs labeled `x:devlog` are collected every Monday at 09:00 JST. The workflow makes one review issue from up to three PRs merged in the previous seven days. The same `/post-x` approval is required.

Do not label refactors, dependency updates, security fixes, or work containing unannounced information. The approval issue is the editorial checkpoint for tone, factual accuracy, timing, and whether a screenshot or short video should accompany the post.
