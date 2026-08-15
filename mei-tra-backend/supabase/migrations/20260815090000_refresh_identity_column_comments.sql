comment on column public.rooms.host_seat_id is
  'Host seat UUID.';

comment on column public.game_history.actor_key_snapshot is
  'Immutable actor key snapshot retained when an actor seat is unavailable.';

comment on column public.game_history.actor_seat_id is
  'Actor seat UUID when the action is tied to a room seat.';
