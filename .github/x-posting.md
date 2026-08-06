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

Every newly opened PR receives `x:share` automatically. GitHub does not reliably distinguish Codex, Claude, and a human when they use the same account, so this keeps the behavior consistent across agents. Remove the label before merging when the change is private, operational, or not worth announcing.

1. When opening the PR, fill in `User-facing change`, `User benefit`, and `X post wording` in the PR template. AI coding tools should complete these sections with concrete, verified language; the X wording should be Japanese, under 240 characters, and contain no URL or media reference.
2. Merge the labeled PR into `main`. The workflow uses `X post wording` first, then the two structured sections, and only then falls back to title/body keyword rules. It creates a text-only issue labeled `x:review`.
3. Edit the Japanese text between `<!-- x-post:start -->` and `<!-- x-post:end -->`. The generated post explains what changed and why it helps players, without including a URL.
4. Comment exactly `/post-x` on the issue. The approval workflow publishes the text to X without uploading any media.

## Weekly devlog

PRs labeled `x:devlog` are collected every Monday at 09:00 JST. The workflow makes one review issue from up to three PRs merged in the previous seven days. The same `/post-x` approval is required.

Do not label refactors, dependency updates, security fixes, or work containing unannounced information. The approval issue is the editorial checkpoint for tone, factual accuracy, and timing.
