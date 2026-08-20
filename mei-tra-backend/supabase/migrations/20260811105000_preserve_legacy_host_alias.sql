create or replace function public.sync_room_host_seat_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  resolved_seat_id uuid;
begin
  if new.host_seat_id is null and new.host_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.host_seat_id is not null then
    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.host_seat_id is distinct from old.host_seat_id then
    if old.host_seat_id is null
      and new.host_seat_id is not null
      and new.host_id is not distinct from old.host_id then
      return new;
    end if;

    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  if new.host_id is not null then
    resolved_seat_id := meitra_private.resolve_room_seat_id(
      new.id,
      new.host_id,
      null
    );
  end if;

  if resolved_seat_id is not null then
    new.host_seat_id := resolved_seat_id;
    new.host_id := resolved_seat_id::text;
    return new;
  end if;

  if new.host_seat_id is not null and new.host_id is null then
    new.host_id := new.host_seat_id::text;
    return new;
  end if;

  return new;
end;
$function$;
