# X posting workflow

This repository intentionally requires human approval before publishing to X.

## One-time setup

Run the **Initialize X Posting Labels** workflow once from the Actions tab. It creates these labels:

- `x:share` — a user-visible release worth an individual post.
- `x:devlog` — a smaller change suitable for the weekly devlog.
- `x:review` — created drafts waiting for editorial review.
- `x:posted` — drafts that have already been published.

In **Settings → Secrets and variables → Actions**, add these repository secrets from the X Developer Console. The OAuth 2.0 token must have `tweet.write` and `offline.access` scopes; no DM scope is needed.

- `X_CLIENT_ID` — OAuth 2.0 Client ID.
- `X_CLIENT_SECRET` — OAuth 2.0 Client Secret for the confidential client.
- `X_REFRESH_TOKEN` — OAuth 2.0 Refresh Token.

The workflow exchanges the refresh token for a short-lived user access token immediately before it calls the X post endpoint. Do not store tokens in the repository, PRs, issues, or workflow variables. Keep `X_POSTING_ENABLED` unset until the first draft and approval flow have been tested. Set the repository variable to `true` only when publishing is intended.

If X rejects a refresh request, generate a new OAuth 2.0 token pair in the Developer Console and replace `X_REFRESH_TOKEN`. Do not paste either token into an issue or a workflow comment.

## Individual release post

1. Add `x:share` to a PR that has a player-visible improvement.
2. Merge it into `main`. The workflow creates an issue labeled `x:review`.
3. Edit the text between `<!-- x-post:start -->` and `<!-- x-post:end -->`. This workflow publishes text only. For a screenshot or video post, publish the approved copy manually from X instead.
4. Comment exactly `/post-x` on the issue.

## Weekly devlog

PRs labeled `x:devlog` are collected every Monday at 09:00 JST. The workflow makes one review issue from up to three PRs merged in the previous seven days. The same `/post-x` approval is required.

Do not label refactors, dependency updates, security fixes, or work containing unannounced information. The approval issue is the editorial checkpoint for tone, factual accuracy, timing, and whether a screenshot or short video should accompany the post.
