---
name: refactor-meitra
description: Meitra（明専トランプ / old-maid）の既存設計に沿って、安全にコードをリファクタリング・設計レビューする。frontend、NestJS backend、Socket.IO、Supabase、COM自動進行、再接続、room/player同期、ゲーム状態、互換migration、アクセシビリティUIを変更するときに使う。ゲームルール、座席とプレイヤーidentity、scale-to-zero復帰、原子的永続化、transport契約、段階移行を壊さず、責務を適切な層へ移すためのSkill。
---

# Refactor Meitra

## 基本方針

Meitraでは全体を重いClean Architectureへ寄せず、壊れたときの影響が大きい境界だけを厚く守る。

- ゲームルール、phase遷移、再接続、COM置換、room/player同期、永続化を強く分離する。
- 通常の画面、route、controller、DI wiringはNext.js / NestJS標準へ近づける。
- ファイルを短くすることではなく、正しさのsource of truthを一つにする。
- 抽象化は実在する重複、競合、復元失敗、変更理由に対してのみ追加する。

詳細な現行構成、不変条件、検証表が必要なら `references/meitra-architecture.md` を読む。

## 1. 現状を固定する

1. repo rootの `AGENTS.md`、`README.md`、対象コードを先に読む。
2. 対象に合う `docs/developer-guide/` の章だけを読む。
3. `git status --short --branch` と対象diffを確認し、既存変更を保護する。
4. docsとコードが違う場合はコードを正とし、必要なdocsだけを更新する。
5. 入出力、state遷移、emit、DB更新、timerを端から端まで追う。

古いarchiveや推測だけで責務を移動しない。

## 2. 不変条件を書く

変更前に、今回守る条件をtest名へ落とせる粒度で列挙する。

- 4人2チーム、座席順、turn順、team所属を保つ。
- 人間、COM、空席の置換で同じseat identityを保つ。
- `playerId`、`userId`、`socketId`を混同しない。
- blow、play、field completion、round endを一度だけ進める。
- process再起動後にDBから必要状態を復元する。
- 同じplayer情報を複数箇所へ非原子的に書かない。
- 旧data / event / migrationへの互換性を明示する。
- 文字倍率、狭い画面、modal、カード配置を壊さない。

## 3. 責務を配置する

| 置き場所 | 持たせる責務 | 持たせない責務 |
| --- | --- | --- |
| Gateway / Controller | auth、parse、room参加、UseCase呼び出し、event dispatch | ゲーム判定、復旧loop、DB merge |
| UseCase | 1操作の検証、service協調、結果event | transport詳細、汎用CRUD |
| Domain service | card、blow、play、score、chombo、phase | Socket emit、Supabase query |
| Application / session service | reconnect、COM、timer、room lifecycle、復旧 | UI表示加工 |
| Gateway effects | 送信先とevent列の組み立て | ruleの再計算 |
| Repository / adapter | query、RPC、JSONB変換、dual-read/write | gameplay workflow |
| `contracts/` | REST DTO、Socket payload | UI state、DB row、domain object |
| frontend hook / context | socket lifecycle、UI state投影、action送信 | server権威のrule判定 |
| React component | 表示、入力、アクセシビリティ | 再接続や永続化の調整 |

同じdataを使うかではなく、どの変更理由で一緒に変わるかで分ける。

## 4. 薄い境界へ直す

1. Gatewayやcomponentのworkflowを既存UseCase / serviceへ委譲する。
2. 共有ruleはゲーム用語で読めるpure helperまたはdomain serviceへ一つだけ置く。
3. I/O、timer、state mutationを便利helperへ隠さない。
4. 既存interface tokenとDI wiringを維持し、必要な境界だけ追加する。
5. transport / domain / persistence / UI間の変換をadapterへ集める。
6. callbackを使う場合もtransport固有処理だけをGateway側に残す。

Gatewayを薄くするとは行数を減らすことではない。接続と送信を残し、retry、phase復旧、COM連続処理、永続化整合性をapplication serviceへ移す。

## 5. 永続化と再接続を守る

- process memoryと`socketId`を唯一のsource of truthにしない。
- identity / seat / team / ready / hostはroster、handやpass状態はgame snapshotに置く。
- `playerOrder`を安定した座席順、`playerStates`を`playerId`単位のgameplay stateとして扱う。
- relationとJSONBを跨ぐ更新はRPC / transactionで原子的に行う。
- versionで古いsnapshotの上書きを拒否し、同一roomの保存を直列化する。
- persistence failureを成功扱いせず、空stateをcacheしない。
- reconnectはDBから再構成できることを基準にする。
- COM turn、完了field、pending revealなどの中断処理を再入可能かつ冪等にする。
- timerは進行のsource of truthではなく、persisted pending stateを再開するためのhintにする。

互換移行は次の3段階に分ける。

1. 新schema / JSON / dual-readを追加する。
2. atomic RPCと新write pathへ切り替える。
3. 本番観測とrollback期間後に旧field / column / fallbackを削除する。

## 6. frontendを守る

- backend eventをcomponentへ散らさず、hook / contextでUI stateへ投影する。
- `room-sync`を主系統とし、互換eventを増やす前に既存fallbackを確認する。
- `sessionStorage.roomId`などのreconnect inputをUI convenienceとして削除しない。
- 文字倍率ではcard、meter、control、modal、viewportも一緒に検証する。
- 固定heightで情報を切らず、wrap、overflow、可変gridを使う。
- modal / navigation / chatで局所的な`z-index`競争を作らない。
- disabled操作はclick、keyboard、route遷移を実際に止める。

スクリーンショット起点の変更は該当倍率とviewportで視覚確認する。

## 7. 隣接scenarioを監査する

- join / leave / reconnect / auth更新
- COM placeholder / 人間置換 / 切断後COM化
- 満室復帰 / vacant seat / team shuffle
- blow / pass / broken reveal / COM autoplay
- card play / field completion / round / game over
- cold start / scale-to-zero / timer消失後の再開
- spectator / chat / profileなど重なるUI

`0`が有効値のIDやteamではtruthy fallbackを使わない。

## 8. 検証と報告

1. 対象service / UseCase / adapterのunit test
2. reconnect、COM、phase、競合の回帰test
3. backend test、build、lint
4. frontend test、lint、build
5. Supabase RPC、rollback、concurrency、backfill test
6. 複数session、倍率別UI、可能なら実際のcold start

実行していないproduction、Fly scale-to-zero、実端末確認を完了扱いにしない。最後に、移した責務、守った不変条件、通った検証、未検証項目、残るcompatibility debtを分けて報告する。
