-- A credit buys one fresh profile. Reading the pool is free, so the balance
-- only ever moves on a crawl that found something nobody had crawled before.
create or replace function brandmatch.spend_credits(p_brand uuid, p_amount int)
returns int language sql volatile as $$
  update brandmatch.brands
     set credits = greatest(credits - p_amount, 0)
   where id = p_brand
  returning credits
$$;

-- What this campaign has found but never read against its brief.
create or replace function brandmatch.unscored_for_campaign(p_campaign uuid, p_limit int default 120)
returns table (
  id uuid, handle text, name text, bio text, followers int,
  country text, sells text, signals jsonb,
  median_reel_views int, engagement_rate numeric
)
language sql stable as $$
  select cr.id, cr.handle, cr.name, cr.bio, cr.followers,
         cr.country, cr.sells, cr.signals, cr.median_reel_views, cr.engagement_rate
  from brandmatch.discoveries d
  join brandmatch.creators cr on cr.id = d.creator_id
  left join brandmatch.creator_scores s on s.creator_id = cr.id and s.campaign_id = d.campaign_id
  where d.campaign_id = p_campaign and s.id is null
  order by d.discovered_at desc
  limit p_limit
$$;

create or replace function brandmatch.bump_qualified(p_campaign uuid, p_date date, p_qualified int)
returns void language sql volatile as $$
  update brandmatch.daily_stats
     set qualified = qualified + p_qualified
   where campaign_id = p_campaign and date = p_date
$$;

-- Seeding a campaign from the pool. A brand that signs up today reads what
-- every campaign before it already crawled, at no credit cost, and only pays
-- once its own agents go looking for what is not in there yet.
create or replace function brandmatch.seed_from_pool(p_campaign uuid, p_limit int default 400)
returns int language plpgsql volatile as $$
declare
  v_brand uuid;
  v_filters jsonb;
  v_count int;
begin
  select brand_id, filters into v_brand, v_filters
    from brandmatch.campaigns where id = p_campaign;
  if v_brand is null then return 0; end if;

  with picked as (
    select cr.id
    from brandmatch.creators cr
    where cr.followers between coalesce((v_filters->>'followersMin')::int, 10000)
                           and coalesce((v_filters->>'followersMax')::int, 1000000)
      and coalesce(cr.median_reel_views, 0) >= coalesce((v_filters->>'reelViewsMin')::int, 0)
      and (coalesce(v_filters->>'emailInBio','any') <> 'yes' or cr.email is not null)
      and (cr.last_post_at is null or cr.last_post_at >= now()
           - (coalesce((v_filters->>'lastPostWithin')::int, 90) || ' days')::interval)
    order by (cr.email is not null) desc, cr.median_reel_views desc nulls last
    limit p_limit
  )
  insert into brandmatch.discoveries (creator_id, campaign_id, brand_id, fresh)
  select p.id, p_campaign, v_brand, false from picked p
  on conflict (campaign_id, creator_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function brandmatch.spend_credits(uuid, int) from anon, authenticated;
revoke all on function brandmatch.unscored_for_campaign(uuid, int) from anon, authenticated;
revoke all on function brandmatch.bump_qualified(uuid, date, int) from anon, authenticated;
revoke all on function brandmatch.seed_from_pool(uuid, int) from anon, authenticated;
