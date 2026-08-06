# X posting workflow

This repository creates review Issues for manual X posting. It does not publish automatically.

## One-time setup

Run the **Initialize X Posting Labels** workflow once from the Actions tab. It creates these labels:

- `x:share` — a user-visible release worth an individual post.
- `x:devlog` — a smaller change suitable for the weekly devlog.
- `x:review` — created drafts waiting for editorial review.
- `x:posted` — drafts that have already been published.

## Individual release post

Every newly opened PR receives `x:share` automatically. GitHub does not reliably distinguish Codex, Claude, and a human when they use the same account, so this keeps the behavior consistent across agents. Remove the label before merging when the change is private, operational, or not worth announcing.

1. When opening the PR, fill in `User-facing change` and `User benefit` in the PR template. AI coding tools should complete both sections with concrete, verified language; together they become the post text, under 240 characters, with no URL or media reference.
2. Merge the labeled PR into `main`. The workflow copies those two AI-written sections into a text-only issue labeled `x:review`. It does not infer copy from the PR title or general description; missing or invalid sections fail the workflow so the PR can be corrected before publishing.
3. Copy the text from the Issue and post it manually on X. The Issue contains only the source PR link and the post text.

## Weekly devlog

PRs labeled `x:devlog` are collected every Monday at 09:00 JST. The workflow makes one text-only Issue from up to three PRs merged in the previous seven days. Copy the draft and post it manually.

Do not label refactors, dependency updates, security fixes, or work containing unannounced information. The approval issue is the editorial checkpoint for tone, factual accuracy, and timing.
