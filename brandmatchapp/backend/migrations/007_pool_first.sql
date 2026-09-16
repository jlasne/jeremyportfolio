-- Pool first, crawl second. Apify bills about $0.0023 a profile on the detail
-- phase, and a handle already sitting in the database costs nothing to hand
-- out. So a campaign's daily quota is filled from what is free and unclaimed
-- before a single run is started, and only the shortfall is ever crawled.

/** How many leads this campaign has already been given today. */
create or replace function brandmatch.delivered_today(p_campaign uuid)
returns int language sql stable as $$
  select count(*)::int from brandmatch.discoveries
  where campaign_id = p_campaign
    and discovered_at >= date_trunc('day', now())
$$;

-- Same claim rule as 006, better order: a lead worth handing out is one that
-- still carries a live signal, then one with a contact, then reach.
create or replace function brandmatch.seed_from_pool(p_campaign uuid, p_limit int default 400)
returns int language plpgsql volatile as $$
declare
  v_brand uuid;
  v_filters jsonb;
  v_count int;
begin
  if p_limit <= 0 then return 0; end if;

  select brand_id, filters into v_brand, v_filters
    from brandmatch.campaigns where id = p_campaign;
  if v_brand is null then return 0; end if;

  with picked as (
    select cr.id,
           brandmatch.signal_level(cr.signals) as signal,
           brandmatch.selling_level(cr.sells, cr.signals) as selling
    from brandmatch.creators cr
    where cr.followers between coalesce((v_filters->>'followersMin')::int, 10000)
                           and coalesce((v_filters->>'followersMax')::int, 1000000)
      and coalesce(cr.median_reel_views, 0) >= coalesce((v_filters->>'reelViewsMin')::int, 0)
      and coalesce(cr.engagement_rate, 1) >= coalesce((v_filters->>'engagementMin')::numeric, 0)
      and (coalesce(v_filters->>'emailInBio','any') <> 'yes' or cr.email is not null)
      and (cr.last_post_at is null or cr.last_post_at >= now()
           - (coalesce((v_filters->>'lastPostWithin')::int, 90) || ' days')::interval)
      and coalesce(cr.posts_per_month, 999) >= coalesce((v_filters->>'postsPerMonthMin')::numeric, 0)
      -- Nobody else may hold it, and this brand must not hold it already.
      and not exists (
        select 1 from brandmatch.discoveries d
        where d.creator_id = cr.id
          and (d.brand_id = v_brand or d.discovered_at > now() - brandmatch.claim_window())
      )
    order by signal desc, selling desc, (cr.email is not null) desc,
             cr.median_reel_views desc nulls last
    limit p_limit
  )
  insert into brandmatch.discoveries (creator_id, campaign_id, brand_id, fresh)
  select p.id, p_campaign, v_brand, false from picked p
  on conflict (campaign_id, creator_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

/**
 * What one agent should crawl tonight.
 *
 * Fills the campaign's remaining quota from the free pool first and returns
 * how many profiles are still missing after that. Zero means the day is
 * covered and no Apify run needs to start at all.
 */
create or replace function brandmatch.shortfall(p_agent uuid)
returns int language plpgsql volatile as $$
declare
  v_campaign uuid;
  v_quota int;
  v_done int;
  v_want int;
  v_filled int;
begin
  select a.campaign_id, a.leads_per_day into v_campaign, v_quota
    from brandmatch.agents a where a.id = p_agent;
  if v_campaign is null then return 0; end if;

  v_done := brandmatch.delivered_today(v_campaign);
  v_want := greatest(v_quota - v_done, 0);
  if v_want = 0 then return 0; end if;

  v_filled := brandmatch.seed_from_pool(v_campaign, v_want);
  return greatest(v_want - v_filled, 0);
end
$$;

revoke all on function brandmatch.delivered_today(uuid) from anon, authenticated;
revoke all on function brandmatch.shortfall(uuid) from anon, authenticated;
revoke all on function brandmatch.seed_from_pool(uuid, int) from anon, authenticated;
grant execute on all functions in schema brandmatch to service_role;
