begin;

select plan(1);

-- Two anonymous accounts, both idle for 31 days. One holds an entitlement;
-- the purge must delete only the other.
insert into auth.users (
  id,
  aud,
  role,
  is_anonymous,
  encrypted_password,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000951',
    'authenticated',
    'authenticated',
    true,
    '',
    now() - interval '40 days',
    now() - interval '40 days'
  ),
  (
    '00000000-0000-0000-0000-000000000952',
    'authenticated',
    'authenticated',
    true,
    '',
    now() - interval '40 days',
    now() - interval '40 days'
  );

update public.user_profiles
set last_seen_at = now() - interval '31 days'
where id in (
  '00000000-0000-0000-0000-000000000951',
  '00000000-0000-0000-0000-000000000952'
);

insert into public.entitlements (user_id, entitlement, source)
values (
  '00000000-0000-0000-0000-000000000951',
  'membership',
  'app_store'
);

select public.cleanup_stale_anonymous_users();

do $$
begin
  if not exists (
    select 1 from auth.users
    where id = '00000000-0000-0000-0000-000000000951'
  ) then
    raise exception 'Entitled anonymous user was purged';
  end if;

  if exists (
    select 1 from auth.users
    where id = '00000000-0000-0000-0000-000000000952'
  ) then
    raise exception 'Unentitled stale anonymous user survived the purge';
  end if;
end;
$$;

select ok(true, 'cleanup_stale_anonymous_users spares entitlement holders');

select finish();

rollback;
