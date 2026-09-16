-- brandmatch core schema.
--
-- The model in one line: one creator is crawled once and belongs to everyone.
-- What a brand pays for is a FRESH crawl, not a read of the pool.
--
--   creators        the shared pool, one row per handle, no owner
--   discoveries     who found whom, and whether that find was fresh or a pool hit
--   creator_scores  the per brand read of a pooled creator, written by the model
--
-- Everything a brand types stays private to it: notes, tags, rejections, done.

create schema if not exists brandmatch;

-- Brands ------------------------------------------------------------------

create table brandmatch.brands (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  website     text,
  timezone    text not null default 'Europe/Paris',
  -- One credit buys one fresh profile crawl. Pool reads cost nothing.
  credits     integer not null default 500,
  api_key     text unique not null default encode(gen_random_bytes(24), 'hex'),
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Campaigns and their agents ----------------------------------------------

create table brandmatch.campaigns (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brandmatch.brands(id) on delete cascade,
  name          text not null,
  website       text,
  brief         jsonb not null default '{}'::jsonb,
  filters       jsonb not null default '{}'::jsonb,
  leads_per_day integer not null default 250,
  run_at        text not null default '07:00',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on brandmatch.campaigns (brand_id);
create index on brandmatch.campaigns (active) where active;

create table brandmatch.agents (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references brandmatch.campaigns(id) on delete cascade,
  name          text not null,
  focus         text not null default '',
  -- What this agent types into Instagram search. Written by the model from the brief.
  keywords      text[] not null default '{}',
  hashtags      text[] not null default '{}',
  leads_per_day integer not null default 80,
  active        boolean not null default true,
  last_run_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on brandmatch.agents (campaign_id);

-- The shared pool ---------------------------------------------------------

create table brandmatch.creators (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null default 'instagram',
  handle            text not null,
  name              text not null default '',
  bio               text not null default '',
  avatar            text,
  followers         integer not null default 0,
  -- 0.034 means 3.4%. Computed from posts we crawled, never from an aggregator field.
  engagement_rate   numeric(6,4),
  median_reel_views integer,
  posts_per_month   numeric(6,2),
  last_post_at      timestamptz,
  country           text,
  language          text,
  email             text,
  external_links    text[] not null default '{}',
  link_type         text,
  -- What the creator sells today, in plain words. Drives the Selling star.
  sells             text not null default '',
  -- [{type,label,strength,date}], newest first. Drives the Signal star.
  signals           jsonb not null default '[]'::jsonb,
  raw               jsonb,
  first_seen_at     timestamptz not null default now(),
  last_crawl_at     timestamptz not null default now(),
  unique (platform, handle)
);
create index on brandmatch.creators (followers);
create index on brandmatch.creators (last_post_at desc nulls last);
create index on brandmatch.creators (last_crawl_at);
create index on brandmatch.creators using gin (to_tsvector('simple', bio || ' ' || name));

create table brandmatch.creator_posts (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references brandmatch.creators(id) on delete cascade,
  kind        text not null default 'reel',
  url         text,
  thumbnail   text,
  caption     text,
  views       integer not null default 0,
  likes       integer not null default 0,
  comments    integer not null default 0,
  posted_at   timestamptz,
  unique (creator_id, url)
);
create index on brandmatch.creator_posts (creator_id, posted_at desc);

-- Who found whom ----------------------------------------------------------
-- One row per (campaign, creator). `fresh` marks the crawl that first put this
-- creator in the pool, which is the one the brand paid a credit for.

create table brandmatch.discoveries (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references brandmatch.creators(id) on delete cascade,
  campaign_id  uuid not null references brandmatch.campaigns(id) on delete cascade,
  agent_id     uuid references brandmatch.agents(id) on delete set null,
  brand_id     uuid not null references brandmatch.brands(id) on delete cascade,
  fresh        boolean not null default false,
  discovered_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index on brandmatch.discoveries (brand_id, discovered_at desc);
create index on brandmatch.discoveries (campaign_id, discovered_at desc);

-- The per brand read of a pooled creator ----------------------------------

create table brandmatch.creator_scores (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references brandmatch.creators(id) on delete cascade,
  campaign_id uuid not null references brandmatch.campaigns(id) on delete cascade,
  brand_id    uuid not null references brandmatch.brands(id) on delete cascade,
  -- 0, 0.5 or 1, the Niche star. The other two stars are read off the pool.
  niche       numeric(2,1) not null default 0,
  niche_why   text not null default '',
  -- Cached sum at write time so the feed can sort in the database.
  stars       numeric(2,1) not null default 0,
  model       text,
  scored_at   timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index on brandmatch.creator_scores (campaign_id, stars desc);

-- What the brand types ----------------------------------------------------

create table brandmatch.notes (
  brand_id   uuid not null references brandmatch.brands(id) on delete cascade,
  creator_id uuid not null references brandmatch.creators(id) on delete cascade,
  text       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);

create table brandmatch.creator_tags (
  brand_id   uuid not null references brandmatch.brands(id) on delete cascade,
  creator_id uuid not null references brandmatch.creators(id) on delete cascade,
  tag        text not null,
  primary key (brand_id, creator_id, tag)
);

create table brandmatch.rejections (
  brand_id   uuid not null references brandmatch.brands(id) on delete cascade,
  creator_id uuid not null references brandmatch.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);

create table brandmatch.done (
  brand_id   uuid not null references brandmatch.brands(id) on delete cascade,
  creator_id uuid not null references brandmatch.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);

-- Runs, stats, money ------------------------------------------------------

create table brandmatch.apify_runs (
  id          uuid primary key default gen_random_uuid(),
  run_id      text unique,
  actor       text not null default 'apify/instagram-scraper',
  phase       text not null default 'search',
  campaign_id uuid references brandmatch.campaigns(id) on delete set null,
  agent_id    uuid references brandmatch.agents(id) on delete set null,
  status      text not null default 'RUNNING',
  input       jsonb,
  items       integer not null default 0,
  fresh       integer not null default 0,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index on brandmatch.apify_runs (status, started_at desc);

create table brandmatch.daily_stats (
  date        date not null,
  campaign_id uuid not null references brandmatch.campaigns(id) on delete cascade,
  agent_id    uuid references brandmatch.agents(id) on delete cascade,
  gathered    integer not null default 0,
  leads       integer not null default 0,
  qualified   integer not null default 0,
  primary key (date, campaign_id, agent_id)
);

create table brandmatch.credits_ledger (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brandmatch.brands(id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  campaign_id uuid references brandmatch.campaigns(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on brandmatch.credits_ledger (brand_id, created_at desc);

create table brandmatch.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  website    text,
  source     text not null default 'landing',
  created_at timestamptz not null default now()
);

-- Nothing here is reachable with the project's anon key. Every read and write
-- goes through the api edge function, which holds the service role.
alter table brandmatch.brands           enable row level security;
alter table brandmatch.campaigns        enable row level security;
alter table brandmatch.agents           enable row level security;
alter table brandmatch.creators         enable row level security;
alter table brandmatch.creator_posts    enable row level security;
alter table brandmatch.discoveries      enable row level security;
alter table brandmatch.creator_scores   enable row level security;
alter table brandmatch.notes            enable row level security;
alter table brandmatch.creator_tags     enable row level security;
alter table brandmatch.rejections       enable row level security;
alter table brandmatch.done             enable row level security;
alter table brandmatch.apify_runs       enable row level security;
alter table brandmatch.daily_stats      enable row level security;
alter table brandmatch.credits_ledger   enable row level security;
alter table brandmatch.waitlist         enable row level security;

revoke all on all tables in schema brandmatch from anon, authenticated;
revoke all on schema brandmatch from anon, authenticated;
