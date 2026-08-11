# public.game_history

## Description

リプレイと戦績表示に使うイベント履歴。actor_seat_id と表示用 snapshot を保持する。

## Columns

| Name               | Type                     | Default            | Nullable | Parents                                                                       | Comment                                                                    |
| ------------------ | ------------------------ | ------------------ | -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| action_data        | jsonb                    | '{}'::jsonb        | true     |                                                                               |                                                                            |
| action_type        | varchar(100)             |                    | false    |                                                                               |                                                                            |
| actor_key_snapshot | text                     |                    | true     |                                                                               | Immutable legacy actor key retained for unresolved and historical records. |
| actor_seat_id      | uuid                     |                    | true     | [public.room_players](public.room_players.md)                                 | Canonical actor seat UUID when the source row can be resolved.             |
| game_state_id      | uuid                     |                    | true     | [public.game_states](public.game_states.md)                                   |                                                                            |
| id                 | uuid                     | uuid_generate_v4() | false    |                                                                               |                                                                            |
| player_id          | varchar(255)             |                    | true     |                                                                               |                                                                            |
| room_id            | uuid                     |                    | true     | [public.rooms](public.rooms.md) [public.room_players](public.room_players.md) |                                                                            |
| timestamp          | timestamp with time zone | now()              | true     |                                                                               |                                                                            |

## Viewpoints

| Name                                | Definition                                               |
| ----------------------------------- | -------------------------------------------------------- |
| [ゲーム進行](viewpoint-gameplay.md)      | ルーム、canonical seat、ゲーム状態、リプレイ履歴の関係。                      |

## Constraints

| Name                                   | Type        | Definition                                                                                                                                 |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| game_history_actor_seat_same_room_fkey | FOREIGN KEY | FOREIGN KEY (room_id, actor_seat_id) REFERENCES room_players(room_id, id) ON DELETE SET NULL (actor_seat_id) DEFERRABLE INITIALLY DEFERRED |
| game_history_game_state_id_fkey        | FOREIGN KEY | FOREIGN KEY (game_state_id) REFERENCES game_states(id) ON DELETE CASCADE                                                                   |
| game_history_pkey                      | PRIMARY KEY | PRIMARY KEY (id)                                                                                                                           |
| game_history_room_id_fkey              | FOREIGN KEY | FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE                                                                               |

## Indexes

| Name                           | Definition                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| game_history_actor_seat_id_idx | CREATE INDEX game_history_actor_seat_id_idx ON public.game_history USING btree (actor_seat_id) WHERE (actor_seat_id IS NOT NULL) |
| game_history_pkey              | CREATE UNIQUE INDEX game_history_pkey ON public.game_history USING btree (id)                                                    |
| idx_game_history_room_id       | CREATE INDEX idx_game_history_room_id ON public.game_history USING btree (room_id)                                               |
| idx_game_history_timestamp     | CREATE INDEX idx_game_history_timestamp ON public.game_history USING btree ("timestamp")                                         |

## Triggers

| Name                         | Definition                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sync_game_history_actor_seat | CREATE TRIGGER sync_game_history_actor_seat BEFORE INSERT OR UPDATE OF room_id, player_id, actor_seat_id ON public.game_history FOR EACH ROW EXECUTE FUNCTION sync_game_history_actor_seat() |

## Relations

![er](public.game_history.svg)

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
