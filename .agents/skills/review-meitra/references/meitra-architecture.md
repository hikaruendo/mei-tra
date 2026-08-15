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

query、RPC、row / JSONB mappingを担当する。

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
| Seat / roster | `room_players` | `id = seatId`、occupant、team、ready、COM |
| Gameplay state | `game_states` | deck、phase、`current_seat_id`、scores、`playerStates[seatId]` |
| Connection | process memory | `socketId`、接続中フラグ、timerは再生成可能にする |
| Audit / replay | `game_history` | snapshotの代替ではなくaction log |
| Transport shape | `contracts/` | DB rowやdomain typeを置かない |

- `seatId`: `room_players.id` と同値の canonical seat UUID。部屋削除まで変更しない。
- `userId`: Supabase Auth account。guestやCOMには存在しない場合がある。
- `socketId`: 接続ごとに変わる一時identity。永続化やseat復旧のkeyにしない。
- `seat_index`: `room_players`に保存するseat / turn順の正本。
- `playerStates[seatId]`: hand、pass、broken flagsなどgameplay stateを保持する。

## 必須の不変条件

### Roster

- player数は最大4人で、`seatId`と`seat_index`が重複しない。
- COM placeholder IDが衝突しない。
- team値`0`をfalse扱いしない。
- partnerが対面になるseat orderを保つ。
- `rooms.host_seat_id`が同じroomの`room_players.id`を参照する。
- host表示は`host_seat_id`から導出し、重複したhost flagを保存しない。

### Replacement / reconnection

- 人間とCOMの置換で`seatId`を変更せず、hand、turn、team、宣言参照を失わない。
- occupant変更を理由にturn、field、blow、winnerのseat参照をremapしない。
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

## Migration rules

- 適用済みmigrationは編集せず、新しいversioned migrationを追加する。
- schema変更とrepository writeを同じPRで揃える。
- backfill件数、concurrency、rollback、roster置換を検証する。
- production反映はdeployとdatabase migrationを分けて確認する。

## Refactoring smells

| smell | 優先する対応 |
| --- | --- |
| Gatewayにretry map / timer / loopが増える | application/session serviceへ抽出する |
| UseCaseごとにrule判定が違う | ゲーム用語のpure helperへ統合する |
| rosterとJSON playerを別々に更新する | atomic roster RPCへ統合する |
| `socketId`でDB playerを復元する | stable identityを使う |
| 同じidentityを複数serviceでremapする | canonicalな`seatId`を維持し、変換処理を削除する |
| 既存型・helperと同義のものを別の階層へ追加する | canonical ownerを決め、既存の型配置・依存方向へ統合する |
| 修正のたびにmapper、fallback、object再構築が増える | 横断して同じ根因を探し、source of truthを一本化してrepair pathを削除する |
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
| Persistence | create/load、partial update、version conflict、rollback |
| Gateway | auth、room membership、event recipient、duplicate trigger |
| Frontend socket | reconnect、room sync、incremental event、listener cleanup |
| Accessibility UI | 1.0x / 1.5x / 2.0x、mobile / desktop、keyboard、modal、card overlap |
| Scale-to-zero | cold start、room reload、COM turn、失われたtimer再構築 |

未検証のproduction behaviorは未検証と報告する。
