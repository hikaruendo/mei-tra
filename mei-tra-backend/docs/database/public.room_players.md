# public.room_players

## Description

ルーム内の座席、チーム、COM 状態、参加者識別子を保持するロスター。

## Columns

| Name       | Type                     | Default            | Nullable | Parents                                         |
| ---------- | ------------------------ | ------------------ | -------- | ----------------------------------------------- |
| id         | uuid                     | uuid_generate_v4() | false    |                                                 |
| is_com     | boolean                  | false              | false    |                                                 |
| is_host    | boolean                  | false              | true     |                                                 |
| is_ready   | boolean                  | false              | true     |                                                 |
| joined_at  | timestamp with time zone | now()              | true     |                                                 |
| name       | varchar(255)             |                    | false    |                                                 |
| player_id  | varchar(255)             |                    | false    |                                                 |
| room_id    | uuid                     |                    | true     | [public.rooms](public.rooms.md)                 |
| seat_index | integer                  |                    | false    |                                                 |
| socket_id  | varchar(255)             |                    | true     |                                                 |
| team       | integer                  | 0                  | false    |                                                 |
| user_id    | uuid                     |                    | true     | [public.user_profiles](public.user_profiles.md) |

## Viewpoints

| Name                                | Definition                                     |
| ----------------------------------- | ---------------------------------------------- |
| [ゲーム進行](viewpoint-gameplay.md)      | ルーム、座席、ゲーム状態、リプレイ履歴の関係。                        |

## Constraints

| Name                                | Type        | Definition                                                           |
| ----------------------------------- | ----------- | -------------------------------------------------------------------- |
| room_players_pkey                   | PRIMARY KEY | PRIMARY KEY (id)                                                     |
| room_players_room_id_fkey           | FOREIGN KEY | FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE         |
| room_players_room_id_player_id_key  | UNIQUE      | UNIQUE (room_id, player_id)                                          |
| room_players_room_id_seat_index_key | UNIQUE      | UNIQUE (room_id, seat_index) DEFERRABLE INITIALLY DEFERRED           |
| room_players_user_id_fkey           | FOREIGN KEY | FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE |

## Indexes

| Name                                | Definition                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| idx_room_players_player_id          | CREATE INDEX idx_room_players_player_id ON public.room_players USING btree (player_id)                                           |
| idx_room_players_room_id            | CREATE INDEX idx_room_players_room_id ON public.room_players USING btree (room_id)                                               |
| idx_room_players_socket_id          | CREATE INDEX idx_room_players_socket_id ON public.room_players USING btree (socket_id)                                           |
| idx_room_players_user_id            | CREATE INDEX idx_room_players_user_id ON public.room_players USING btree (user_id)                                               |
| room_players_pkey                   | CREATE UNIQUE INDEX room_players_pkey ON public.room_players USING btree (id)                                                    |
| room_players_room_id_player_id_key  | CREATE UNIQUE INDEX room_players_room_id_player_id_key ON public.room_players USING btree (room_id, player_id)                   |
| room_players_room_id_seat_index_key | CREATE UNIQUE INDEX room_players_room_id_seat_index_key ON public.room_players USING btree (room_id, seat_index)                 |
| room_players_room_user_key          | CREATE UNIQUE INDEX room_players_room_user_key ON public.room_players USING btree (room_id, user_id) WHERE (user_id IS NOT NULL) |

## Triggers

| Name                             | Definition                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reject_deleting_room_player_user | CREATE TRIGGER reject_deleting_room_player_user BEFORE INSERT OR UPDATE OF user_id ON public.room_players FOR EACH ROW EXECUTE FUNCTION reject_deleting_room_player_user() |

## Relations

![er](public.room_players.svg)

---

> Generated by [tbls](https://github.com/k1LoW/tbls)
