# 明専トランプ 開発者向けガイド

このディレクトリは、現行 `main` ブランチの実装を前提にした開発者向けドキュメントシリーズです。目的は、初見の開発者がコードを読む前に「このプロジェクトは何で構成され、どこに何があり、どの順番で理解するとよいか」を把握できるようにすることです。

2025-06 の Zenn 記事アーカイブ `../archive/2025-06-zenn-meitra-project-memo.md` は、初期構成を広く紹介する単一記事としては有用ですが、現行実装の説明書としては不足があります。特に次の点は、現在の `main` を理解するうえで重要です。

- Supabase Auth を前提にした認証フローが入っている
- `next-intl` による日本語 / 英語のローカライズがある
- ランディングページ、プロフィール編集、ルールページ、チャット UI が追加されている
- backend は Gateway 直書きではなく、UseCase / Service / Repository に責務を分解している
- 運用面では Fly.io の待機 / 起動制御、`/api/health`、auto-scale workflow、Supabase の runbook が整備されている

このシリーズは、そうした「今の repo の実態」に合わせて、入口を作り直したものです。

## 読者と前提

想定する主読者は、この repo に新しく参加する開発者です。TypeScript、React、Next.js、NestJS、Supabase を完全に知らなくても読めるようにしていますが、フレームワークの一般論よりも「このプロジェクトではどう使っているか」を優先します。

AI agent は、このシリーズを全章まとめて読む前提にしないでください。実装作業では `README.md`、`AGENTS.md`、実際のコードを優先し、このシリーズは必要な章だけを開く補助資料として扱います。特に `docs/archive/2025-06-zenn-meitra-project-memo.md` は設計史であり、現行実装の判断材料として常用しません。

向いている読み方は次の通りです。

- 初参加で全体像を知りたい: `README` → `01` → `02` → `03`
- UI 改修や画面追加から入る: `README` → `01` → `02` → `04`
- ゲームロジックや Socket イベントを触る: `README` → `01` → `03` → `04`
- 認証、Supabase、プロフィール、チャットを触る: `README` → `01` → `05`
- ローカル起動、テスト、デプロイ、運用を知りたい: `README` → `06`

## 各章の役割

| ファイル | 役割 | こんなときに読む |
| --- | --- | --- |
| `01-system-overview.md` | プロダクト、repo 構成、実行環境、旧構成との差分をまとめる入口 | まず全体像を掴みたい |
| `02-frontend-architecture.md` | Next.js App Router、i18n、認証、状態管理、UI 構成 | 画面や hooks を追いたい |
| `03-backend-architecture.md` | NestJS module graph、Gateway / UseCase / Service / Repository の分担 | サーバー側の責務を整理したい |
| `04-realtime-game-flow.md` | ルーム作成からゲーム終了までのイベント駆動フロー | Socket イベントや同期フローを理解したい |
| `05-data-auth-persistence.md` | Supabase Auth / DB / Storage、型、永続化境界、migration | 認証やデータ保存を触りたい |
| `06-dev-ops-and-quality.md` | 起動手順、テスト、CI/CD、Fly.io、health、運用 runbook | 開発環境や運用フローを把握したい |
| `../architecture/game-core-design-and-realtime-scaling.md` | 外側は framework 標準、ゲームルール周辺だけを domain層として厚く守る設計方針と realtime スケーリング判断ライン | 設計方針や将来の拡張基準を確認したい |

## 実装との対応

このシリーズは概説ではなく、現行のコード配置に直接対応しています。

| テーマ | 主に見るディレクトリ / ファイル |
| --- | --- |
| frontend 本体 | `mei-tra-frontend/app/`, `mei-tra-frontend/components/`, `mei-tra-frontend/hooks/`, `mei-tra-frontend/contexts/` |
| frontend 型 / ローカライズ | `mei-tra-frontend/types/`, `mei-tra-frontend/i18n/`, `mei-tra-frontend/messages/` |
| backend 本体 | `mei-tra-backend/src/` |
| backend のユースケース分解 | `mei-tra-backend/src/use-cases/`, `mei-tra-backend/src/services/`, `mei-tra-backend/src/repositories/` |
| Supabase schema / migration | `mei-tra-backend/supabase/migrations/` |
| 運用用スクリプト | `mei-tra-backend/scripts/` |
| CI/CD | `.github/workflows/` |

このシリーズで説明する内容は、できる限り上記の現行コードから引いています。説明とコードに差がある場合は、コードを正とし、ドキュメントを更新してください。

## 既存ドキュメントとの関係

既存ドキュメントは削除せず補助資料として残します。ただし、読む順番はこのディレクトリを優先してください。

| 既存ドキュメント | 位置づけ |
| --- | --- |
| `../archive/2025-06-zenn-meitra-project-memo.md` | 2025-06 に公開した Zenn 記事のアーカイブ。当時のプロジェクト説明・備忘録としては有用だが、現行実装の一次資料ではない |
| `ARCHITECTURE.md` | 大きな依存方向と構造を掴む補助資料。内容は今も有効だが、細部はこのシリーズの方が新しい |
| `docs/architecture/game-module-layering.md` | backend の layering を短く要約した資料。`03` の補助として読む |
| `docs/architecture/game-core-design-and-realtime-scaling.md` | domain層を中心にゲームルール周辺を厚く守る境界設計、保護すべき箇所、realtime 接続数の判断ラインをまとめた補助資料 |
| `mei-tra-backend/DEPLOYMENT.md` | Fly.io 運用手順の runbook |
| `mei-tra-backend/SUPABASE_OPERATIONS.md` | Supabase 日常運用の runbook |
| `mei-tra-backend/SUPABASE_MIGRATION.md` | migration と移行時の runbook |

## このシリーズで扱う範囲

このシリーズの中心は、現在実際に動いている Web 版の frontend / backend / Supabase / 運用です。

扱うもの:

- Next.js frontend
- NestJS backend
- Socket.IO によるゲーム同期とソーシャルチャット
- Supabase Auth / Database / Storage
- Fly.io / Vercel / GitHub Actions を使った運用
- ローカル開発、テスト、起動順序

深く扱わないもの:

- `mei-tra-mobile/`
- `mei-tra-cloudflare/`
- ルールの完全な入門解説

`mei-tra-mobile/` と `mei-tra-cloudflare/` は repo に存在しますが、現時点では主実装ではありません。必要になった段階で appendix を追加するのが自然です。

## 読み進めるときのおすすめ

このシリーズは、章ごとに役割を厳密に分けています。1 章の中で何でも説明するのではなく、「どの層の責務か」で切っています。そのため、次のように使うと読みやすくなります。

1. `01` で repo とシステムの全景を把握する
2. 触る場所が frontend なら `02`、backend なら `03` を読む
3. 通信やゲーム進行で迷ったら `04` に戻る
4. 認証や永続化で迷ったら `05` に戻る
5. 起動や deploy の話になったら `06` を参照する

## 更新方針

このシリーズは、仕様書というより「現行実装の説明書」です。そのため、次の変更が入ったら関連章も更新してください。

- 画面遷移や provider 構成を変えた
- WebSocket イベント名や payload を変えた
- 新しい UseCase / Service / Repository を追加した
- Supabase schema や migration の扱いが変わった
- deploy 先、health check、起動手順、workflow が変わった

逆に、表現の細部よりも、責務境界や開発者の導線が保たれているかを優先してください。

## 次に読む

- [01-system-overview.md](./01-system-overview.md)
- [02-frontend-architecture.md](./02-frontend-architecture.md)
- [03-backend-architecture.md](./03-backend-architecture.md)
- [04-realtime-game-flow.md](./04-realtime-game-flow.md)
- [05-data-auth-persistence.md](./05-data-auth-persistence.md)
- [06-dev-ops-and-quality.md](./06-dev-ops-and-quality.md)
