-- Rooms always seat players at random and let the host rearrange them while
-- waiting, so the team assignment setting no longer exists. Existing rows may
-- still carry the key inside settings; the backend ignores it.
alter table public.rooms
  alter column settings set default '{
    "maxPlayers": 4,
    "isPrivate": false,
    "password": null,
    "pointsToWin": 10,
    "allowSpectators": true
  }'::jsonb;

drop type if exists public.team_assignment_method;
