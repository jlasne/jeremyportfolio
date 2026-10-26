-- Grid Tycoon multiplayer schema (DESIGN.md section 8).
--
-- Clients (anon / authenticated) can READ rooms and players, through PostgREST and Realtime, and
-- nothing else. Every write goes through the grid-tycoon edge function with the service role,
-- which bypasses RLS. Seat token hashes and locked decisions are invisible to clients.
-- Old rooms are deleted lazily by the function when a new room is created (no cron needed).

-- ---------------------------------------------------------------------------------------------
-- Tables

create table if not exists public.gt_rooms (
  code        text        primary key check (code ~ '^[A-HJ-NP-Z]{6}$'),
  seed        bigint      not null default 0,
  status      text        not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  host_seat   smallint    not null default 0 check (host_seat between 0 and 5),
  -- 0 in the lobby, then the engine round being decided (1..40, 41 once finished).
  round       integer     not null default 0 check (round >= 0),
  deadline    timestamptz,
  seats       smallint    not null check (seats between 2 and 6),
  fill_bots   boolean     not null default true,
  -- The full engine GameState (null in the lobby).
  state       jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.gt_players (
  room_code     text        not null references public.gt_rooms (code) on delete cascade,
  seat          smallint    not null check (seat between 0 and 5),
  company_id    text        not null check (char_length(company_id) between 1 and 32),
  name          text        not null check (char_length(name) between 1 and 20),
  is_bot        boolean     not null default false,
  -- Last round this seat locked a decision for; equal to gt_rooms.round = locked in now.
  locked_round  integer     not null default 0 check (locked_round >= 0),
  last_seen     timestamptz not null default now(),
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (room_code, seat)
);

create table if not exists public.gt_secrets (
  room_code   text        not null,
  seat        smallint    not null,
  -- SHA-256 (hex) of the seat token; the token itself is never stored.
  token_hash  text        not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (room_code, seat),
  foreign key (room_code, seat) references public.gt_players (room_code, seat) on delete cascade
);

create table if not exists public.gt_decisions (
  room_code   text        not null,
  round       integer     not null check (round >= 1),
  seat        smallint    not null,
  decision    jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (room_code, round, seat),
  foreign key (room_code, seat) references public.gt_players (room_code, seat) on delete cascade
);

-- ---------------------------------------------------------------------------------------------
-- Indexes (primary keys already cover lookups by room, seat and round)

create index if not exists gt_rooms_updated_at_idx on public.gt_rooms (updated_at);
create unique index if not exists gt_secrets_token_idx on public.gt_secrets (room_code, token_hash);

-- ---------------------------------------------------------------------------------------------
-- updated_at trigger

create or replace function public.gt_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gt_rooms_touch on public.gt_rooms;
create trigger gt_rooms_touch before update on public.gt_rooms
  for each row execute function public.gt_touch_updated_at();

drop trigger if exists gt_players_touch on public.gt_players;
create trigger gt_players_touch before update on public.gt_players
  for each row execute function public.gt_touch_updated_at();

drop trigger if exists gt_secrets_touch on public.gt_secrets;
create trigger gt_secrets_touch before update on public.gt_secrets
  for each row execute function public.gt_touch_updated_at();

drop trigger if exists gt_decisions_touch on public.gt_decisions;
create trigger gt_decisions_touch before update on public.gt_decisions
  for each row execute function public.gt_touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Row level security: read-only rooms and players, nothing else

alter table public.gt_rooms     enable row level security;
alter table public.gt_players   enable row level security;
alter table public.gt_secrets   enable row level security;
alter table public.gt_decisions enable row level security;

drop policy if exists "gt_rooms are readable" on public.gt_rooms;
create policy "gt_rooms are readable" on public.gt_rooms
  for select to anon, authenticated using (true);

drop policy if exists "gt_players are readable" on public.gt_players;
create policy "gt_players are readable" on public.gt_players
  for select to anon, authenticated using (true);

-- No insert / update / delete policies anywhere, and no policies at all on gt_secrets and
-- gt_decisions. Revoking the grants as well means a future permissive policy cannot open them
-- by accident.
revoke insert, update, delete, truncate on public.gt_rooms, public.gt_players from anon, authenticated;
revoke all on public.gt_secrets, public.gt_decisions from anon, authenticated;
grant select on public.gt_rooms, public.gt_players to anon, authenticated;
revoke execute on function public.gt_touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: clients follow their room's row and its players

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gt_rooms'
  ) then
    alter publication supabase_realtime add table public.gt_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gt_players'
  ) then
    alter publication supabase_realtime add table public.gt_players;
  end if;
end;
$$;
