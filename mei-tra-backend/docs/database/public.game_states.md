# public.game_states

## Description

ルームごとのバージョン付きゲーム状態スナップショット。詳細な進行状態は state_data JSONB に保持する。

## Columns

| Name               | Type                     | Default                                                               | Nullable | Children                                      | Parents                         |
| ------------------ | ------------------------ | --------------------------------------------------------------------- | -------- | --------------------------------------------- | ------------------------------- |
| created_at         | timestamp with time zone | now()                                                                 | true     |                                               |                                 |
| current_player_id  | text                     |                                                                       | true     |                                               |                                 |
| game_phase         | game_phase               |                                                                       | true     |                                               |                                 |
| id                 | uuid                     | uuid_generate_v4()                                                    | false    | [public.game_history](public.game_history.md) |                                 |
| points_to_win      | integer                  | 10                                                                    | true     |                                               |                                 |
| room_id            | uuid                     |                                                                       | true     |                                               | [public.rooms](public.rooms.md) |
| round_number       | integer                  | 1                                                                     | true     |                                               |                                 |
| state_data         | jsonb                    | '{}'::jsonb                                                           | false    |                                               |                                 |
| team_score_records | jsonb                    | '{"0": [], "1": []}'::jsonb                                           | true     |                                               |                                 |
| team_scores        | jsonb                    | '{"0": {"play": 0, "total": 0}, "1": {"play": 0, "total": 0}}'::jsonb | true     |                                               |                                 |
| updated_at         | timestamp with time zone | now()                                                                 | true     |                                               |                                 |
| version            | bigint                   | 0                                                                     | false    |                                               |                                 |

## Viewpoints

| Name                                | Definition                                     |
| ----------------------------------- | ---------------------------------------------- |
| [ゲーム進行](viewpoint-gameplay.md)      | ルーム、座席、ゲーム状態、リプレイ履歴の関係。                        |

## Constraints

| Name                     | Type        | Definition                                                   |
| ------------------------ | ----------- | ------------------------------------------------------------ |
| game_states_pkey         | PRIMARY KEY | PRIMARY KEY (id)                                             |
| game_states_room_id_fkey | FOREIGN KEY | FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE |
| game_states_room_id_key  | UNIQUE      | UNIQUE (room_id)                                             |

## Indexes

| Name                    | Definition                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| game_states_pkey        | CREATE UNIQUE INDEX game_states_pkey ON public.game_states USING btree (id)             |
| game_states_room_id_key | CREATE UNIQUE INDEX game_states_room_id_key ON public.game_states USING btree (room_id) |
| idx_game_states_room_id | CREATE INDEX idx_game_states_room_id ON public.game_states USING btree (room_id)        |

## Triggers

| Name                          | Definition                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| update_game_states_updated_at | CREATE TRIGGER update_game_states_updated_at BEFORE UPDATE ON public.game_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |

## Relations

![er](public.game_states.svg)

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
