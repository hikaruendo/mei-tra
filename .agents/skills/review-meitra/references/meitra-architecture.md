# Meitra Architecture Reference

現行コードは変化するため、必ずrepoの `README.md`、対象コード、該当する `docs/developer-guide/` を再確認する。

## 選択的に境界を厚くする

Meitraの複雑性はCRUDではなく、ゲームルールとrealtime例外の組み合わせにある。

厚く守る領域:

- rule evaluationとstate mutation
- phase transition
- reconnect / session recovery
- human / COM / vacant seat置換
- room/player sync契約
- atomic persistenceとversion conflict
- replay / audit log

framework標準へ近づける領域:

- NestJS module、controller、DI wiring
- Next.js page / route composition
- 通常のprofile、list、detail UI
- 単純なproxy routeとtransport adapter

## 現行の層

### Interface adapter

- `mei-tra-backend/src/game.gateway.ts`
- `mei-tra-backend/src/social.gateway.ts`
- `mei-tra-backend/src/controllers/`

socket handshake、auth、payload parse、room join/leave、UseCase呼び出し、event dispatchを担当する。

### Application / UseCase

- `mei-tra-backend/src/use-cases/`

1操作単位のworkflowを担当する。複数serviceを束ね、success / error / event / delayed effectを返す。

### Domain

- `CardService`
- `BlowService`
- `PlayService`
- `ScoreService`
- `ChomboService`
- `GamePhaseService`

ゲームルールとphaseの正しさを持つ。UI、Socket、Supabaseへ同じ判定を複製しない。

### Application / session service

- `RoomService`
- `RoomJoinService`
- `GameStateService`
- `GameStateManager`
- `PlayerConnectionManager`
- `SeatRestorationService`
- `ComSessionService`
- `ComAutoPlayService`
- `ComAutoPlayRecoveryService`
- `TurnMonitorService`

room lifecycle、reconnect、置換、timer、復旧、永続化調整を担当する。

### Infrastructure

- `mei-tra-backend/src/repositories/`
- `mei-tra-backend/src/database/`
- `mei-tra-backend/supabase/migrations/`

query、RPC、row / JSONB mapping、互換read/writeを担当する。

### Frontend

- `mei-tra-frontend/app/`: routeとpage composition
- `mei-tra-frontend/hooks/`: game / room / socket state coordinator
- `mei-tra-frontend/contexts/`: auth、social socket、cross-page state
- `mei-tra-frontend/components/`: feature単位の表示とinteraction
- `mei-tra-frontend/types/`: UI state / view model
- `contracts/`: frontend/backend共通のwire contract

## Identityとsource of truth

| 概念 | 主なsource of truth | 注意点 |
| --- | --- | --- |
| Auth account | Supabase Auth | `userId`は認証identity |
| Profile | `user_profiles` | 表示名、avatar、preferences、stats |
| Room | `rooms` | metadata、host参照、lifecycle |
| Seat / roster | `room_players` | `playerId`、seat、team、ready、host、COM |
| Gameplay state | `game_states` | deck、phase、turn、scores、`playerStates`、`playerOrder` |
| Connection | process memory | `socketId`、接続中フラグ、timerは再生成可能にする |
| Audit / replay | `game_history` | snapshotの代替ではなくaction log |
| Transport shape | `contracts/` | DB rowやdomain typeを置かない |

- `playerId`: room / game内でseatを指す安定identity。
- `userId`: Supabase Auth account。guestやCOMには存在しない場合がある。
- `socketId`: 接続ごとに変わる一時identity。永続化やseat復旧のkeyにしない。
- `playerOrder`: seat / turn順を保持する。
- `playerStates[playerId]`: hand、pass、broken flagsなどgameplay stateを保持する。

## 必須の不変条件

### Roster

- player数は最大4人で、seatと`playerId`が重複しない。
- COM placeholder IDが衝突しない。
- team値`0`をfalse扱いしない。
- partnerが対面になるseat orderを保つ。
- `rooms.host_id`とplayerのhost flagを一致させる。

### Replacement / reconnection

- 人間とCOMの置換でhand、turn、team、宣言参照を失わない。
- player ID変更時はturn、field、blow、winner、idle、timer参照を一括remapする。
- backend再起動後、DB snapshotとrosterからroomを再構成する。
- socket room membershipとtimerをreconnect時に再登録する。

### Phase

- phase transitionを複数経路から二重実行しない。
- blowの行動済み判定を共通helperで統一する。
- 4枚揃ったfield completionを冪等に再開する。
- delayed eventやtimer消失後もCOM turnを再triggerする。
- retryをroom単位で多重実行せず、backoff上限と取消手段を持つ。

### Persistence

- relationとJSONBのroster変更を同一transactionで保存する。
- version compare-and-swapで古いsnapshotを拒否する。
- room単位のwriteを直列化する。
- RPC途中失敗時に全更新をrollbackする。
- DB failureを成功responseや空stateへ変換しない。

## Migration playbook

### PR A: 読めるようにする

- 新column / JSON shapeとdual-readを追加する。
- old snapshotからnew shapeへ復元できるtestを追加する。
- backfillの件数と不変条件を検証する。

### PR B: 新経路へ書く

- atomic RPCとversion checkを追加する。
- repository writeを新経路へ切り替える。
- migration未適用環境だけ旧pathへfallbackする。
- concurrency、rollback、roster置換を検証する。

### PR C: 旧経路を消す

- productionで新read/writeとerror rateを観測する。
- rollback期間と古いdeployがないことを確認する。
- legacy field、column、dual-read/writeを削除する。

PR Cを日付だけで開始せず、観測証拠とrollback条件で開始する。

## Refactoring smells

| smell | 優先する対応 |
| --- | --- |
| Gatewayにretry map / timer / loopが増える | application/session serviceへ抽出する |
| UseCaseごとにrule判定が違う | ゲーム用語のpure helperへ統合する |
| rosterとJSON playerを別々に更新する | atomic roster RPCへ統合する |
| `socketId`でDB playerを復元する | stable identityを使う |
| Repositoryがgame phaseを判断する | domain / UseCaseへ移す |
| Componentがruleを再計算する | hookとserver authorityを使う |
| `team || 0`のfallback | `team ?? 0`またはvalidationを使う |
| catchして空stateを返す | recoverableとfatal errorを分ける |
| 全画面倍率でoverflowする | semantic scaleとlayout制約を分ける |
| 巨大な`z-index`を足す | 共通layer tokenを設計する |

## Validation matrix

| 変更領域 | 最低限の検証 |
| --- | --- |
| Game rule | 対象unit、phase前後、invalid action、COM経路 |
| Player identity | human↔COM、vacant seat、満室復帰、team shuffle |
| Reconnect | waiting、blow、play、field completion、game over |
| Persistence | create/load、partial update、version conflict、rollback、旧JSON復元 |
| Gateway | auth、room membership、event recipient、duplicate trigger |
| Frontend socket | reconnect、主eventと互換event、listener cleanup |
| Accessibility UI | 1.0x / 1.5x / 2.0x、mobile / desktop、keyboard、modal、card overlap |
| Scale-to-zero | cold start、room reload、COM turn、失われたtimer再構築 |

未検証のproduction behaviorは未検証と報告する。
