-- The three criteria are independent. A creator that sells and fired a signal
-- scores 2 whether or not the model has read it against a brief yet, so the
-- feed computes those two itself instead of waiting on a score row.

drop function if exists brandmatch.feed_counts(uuid, uuid);
drop function if exists brandmatch.feed(uuid, uuid, int, int, text);

create or replace function brandmatch.selling_level(p_sells text, p_signals jsonb)
returns numeric language sql immutable as $$
  select case
    when coalesce(p_sells,'') ~* '(program|coaching|app|membership|shop)' then 1
    when coalesce(p_sells,'') ~* '(ebook|merch|affiliate|link hub|own site)'
      or jsonb_array_length(coalesce(p_signals,'[]'::jsonb)) > 0 then 0.5
    else 0
  end
$$;

create or replace function brandmatch.signal_level(p_signals jsonb)
returns numeric language sql stable as $$
  select coalesce(max(case
    when (now()::date - (s->>'date')::date) <= 4  then 1
    when (now()::date - (s->>'date')::date) <= 10 then 0.5
    else 0
  end), 0)
  from jsonb_array_elements(coalesce(p_signals,'[]'::jsonb)) s
  where s->>'date' is not null
$$;

create function brandmatch.feed(
  p_brand uuid, p_campaign uuid default null,
  p_limit int default 60, p_offset int default 0, p_scope text default 'all'
)
returns table (
  id uuid, handle text, name text, bio text, avatar text, followers int,
  engagement_rate numeric, median_reel_views int, posts_per_month numeric,
  last_post_at timestamptz, country text, language text, email text,
  external_links text[], sells text, signals jsonb,
  niche numeric, niche_why text, selling numeric, signal numeric, stars numeric,
  campaign_id uuid, campaign_name text, agent_id uuid,
  discovered_at timestamptz, fresh boolean,
  note text, tags text[], rejected boolean, done boolean
)
language sql stable as $$
  with f as (
    select c.id as campaign_id, c.name as campaign_name, c.filters
    from brandmatch.campaigns c
    where c.brand_id = p_brand and (p_campaign is null or c.id = p_campaign)
  )
  select
    cr.id, cr.handle, cr.name, cr.bio, cr.avatar, cr.followers,
    cr.engagement_rate, cr.median_reel_views, cr.posts_per_month,
    cr.last_post_at, cr.country, cr.language, cr.email,
    cr.external_links, cr.sells, cr.signals,
    coalesce(s.niche, 0) as niche,
    coalesce(s.niche_why, '') as niche_why,
    brandmatch.selling_level(cr.sells, cr.signals) as selling,
    brandmatch.signal_level(cr.signals) as signal,
    coalesce(s.niche, 0)
      + brandmatch.selling_level(cr.sells, cr.signals)
      + brandmatch.signal_level(cr.signals) as stars,
    f.campaign_id, f.campaign_name, d.agent_id, d.discovered_at, d.fresh,
    n.text, coalesce(t.tags, '{}'), (rj.creator_id is not null), (dn.creator_id is not null)
  from brandmatch.discoveries d
  join f on f.campaign_id = d.campaign_id
  join brandmatch.creators cr on cr.id = d.creator_id
  left join brandmatch.creator_scores s on s.creator_id = cr.id and s.campaign_id = d.campaign_id
  left join brandmatch.notes n       on n.creator_id = cr.id and n.brand_id = p_brand
  left join brandmatch.rejections rj on rj.creator_id = cr.id and rj.brand_id = p_brand
  left join brandmatch.done dn       on dn.creator_id = cr.id and dn.brand_id = p_brand
  left join lateral (
    select array_agg(ct.tag) tags from brandmatch.creator_tags ct
    where ct.creator_id = cr.id and ct.brand_id = p_brand
  ) t on true
  where d.brand_id = p_brand
    and (p_scope <> 'rejected' or rj.creator_id is not null)
    and (p_scope <> 'open'     or (rj.creator_id is null and dn.creator_id is null))
    and (p_scope = 'rejected'  or rj.creator_id is null)
    and cr.followers between coalesce((f.filters->>'followersMin')::int, 0)
                         and coalesce((f.filters->>'followersMax')::int, 2147483647)
    and coalesce(cr.engagement_rate, 1) >= coalesce((f.filters->>'engagementMin')::numeric, 0)
    and coalesce(cr.median_reel_views, 2147483647) >= coalesce((f.filters->>'reelViewsMin')::int, 0)
    and (coalesce(f.filters->>'emailInBio', 'any') <> 'yes' or cr.email is not null)
    and (cr.last_post_at is null
         or cr.last_post_at >= now() - (coalesce((f.filters->>'lastPostWithin')::int, 90) || ' days')::interval)
    and coalesce(cr.posts_per_month, 999) >= coalesce((f.filters->>'postsPerMonthMin')::numeric, 0)
  order by stars desc, d.discovered_at desc, cr.followers desc
  limit p_limit offset p_offset
$$;

create function brandmatch.feed_counts(p_brand uuid, p_campaign uuid default null)
returns table (total bigint, today bigint, qualified bigint)
language sql stable as $$
  select count(*),
         count(*) filter (where f.discovered_at >= date_trunc('day', now())),
         count(*) filter (where f.stars >= 1)
  from brandmatch.feed(p_brand, p_campaign, 100000, 0) f
$$;

revoke all on function brandmatch.feed(uuid, uuid, int, int, text) from anon, authenticated;
revoke all on function brandmatch.feed_counts(uuid, uuid) from anon, authenticated;
revoke all on function brandmatch.selling_level(text, jsonb) from anon, authenticated;
revoke all on function brandmatch.signal_level(jsonb) from anon, authenticated;
grant execute on all functions in schema brandmatch to service_role;
