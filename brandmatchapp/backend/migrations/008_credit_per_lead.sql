-- One credit, one lead.
--
-- A lead costs a credit wherever it came from. A handle out of the pool costs
-- us nothing to hand over and earns the same credit as one we crawled, which
-- is where the margin lives: the bigger the pool, the fewer crawls a credit
-- has to pay for.
--
-- The charge sits on the discoveries table itself, so neither the pool path
-- nor the crawl path can deliver a lead without paying for it.

create or replace function brandmatch.charge_for_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update brandmatch.brands
     set credits = greatest(credits - 1, 0)
   where id = new.brand_id;

  insert into brandmatch.credits_ledger (brand_id, delta, reason, campaign_id)
  values (new.brand_id, -1,
          case when new.fresh then 'lead, crawled fresh' else 'lead, from the pool' end,
          new.campaign_id);
  return new;
end
$$;

drop trigger if exists discoveries_charge on brandmatch.discoveries;
create trigger discoveries_charge
  after insert on brandmatch.discoveries
  for each row execute function brandmatch.charge_for_lead();

/** What this brand can still be given today, in credits. */
create or replace function brandmatch.credits_left(p_brand uuid)
returns int language sql stable as $$
  select coalesce(credits, 0) from brandmatch.brands where id = p_brand
$$;

-- The pool hands over no more than the brand can pay for.
create or replace function brandmatch.seed_from_pool(p_campaign uuid, p_limit int default 400)
returns int language plpgsql volatile as $$
declare
  v_brand uuid;
  v_filters jsonb;
  v_budget int;
  v_count int;
begin
  if p_limit <= 0 then return 0; end if;

  select brand_id, filters into v_brand, v_filters
    from brandmatch.campaigns where id = p_campaign;
  if v_brand is null then return 0; end if;

  v_budget := least(p_limit, brandmatch.credits_left(v_brand));
  if v_budget <= 0 then return 0; end if;

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
      and not exists (
        select 1 from brandmatch.discoveries d
        where d.creator_id = cr.id
          and (d.brand_id = v_brand or d.discovered_at > now() - brandmatch.claim_window())
      )
    order by signal desc, selling desc, (cr.email is not null) desc,
             cr.median_reel_views desc nulls last
    limit v_budget
  )
  insert into brandmatch.discoveries (creator_id, campaign_id, brand_id, fresh)
  select p.id, p_campaign, v_brand, false from picked p
  on conflict (campaign_id, creator_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- No credit, no claim. The profile still refreshes in the pool.
create or replace function brandmatch.claim(
  p_creator uuid, p_campaign uuid, p_agent uuid, p_brand uuid, p_fresh boolean
)
returns boolean language plpgsql volatile as $$
begin
  if brandmatch.credits_left(p_brand) <= 0 then return false; end if;
  if not brandmatch.is_free(p_creator, p_brand) then return false; end if;

  insert into brandmatch.discoveries (creator_id, campaign_id, agent_id, brand_id, fresh)
  values (p_creator, p_campaign, p_agent, p_brand, p_fresh)
  on conflict (campaign_id, creator_id) do nothing;
  return true;
end
$$;

-- The crawl never asks for more than the brand can pay for either.
create or replace function brandmatch.shortfall(p_agent uuid)
returns int language plpgsql volatile as $$
declare
  v_campaign uuid;
  v_brand uuid;
  v_quota int;
  v_done int;
  v_want int;
  v_filled int;
begin
  select a.campaign_id, a.leads_per_day, c.brand_id
    into v_campaign, v_quota, v_brand
    from brandmatch.agents a
    join brandmatch.campaigns c on c.id = a.campaign_id
   where a.id = p_agent;
  if v_campaign is null then return 0; end if;

  v_done := brandmatch.delivered_today(v_campaign);
  v_want := least(greatest(v_quota - v_done, 0), brandmatch.credits_left(v_brand));
  if v_want <= 0 then return 0; end if;

  v_filled := brandmatch.seed_from_pool(v_campaign, v_want);
  return greatest(v_want - v_filled, 0);
end
$$;

-- An agent the model wrote waits for a human before it spends anything.
alter table brandmatch.agents
  add column if not exists status text not null default 'proposed',
  add column if not exists proposed_why text;

update brandmatch.agents set status = case when active then 'active' else 'paused' end;

alter table brandmatch.agents
  add constraint agents_status_known check (status in ('proposed', 'active', 'paused'));

create index if not exists agents_status on brandmatch.agents (status) where status = 'active';

revoke all on function brandmatch.credits_left(uuid) from anon, authenticated;
revoke all on function brandmatch.charge_for_lead() from public, anon, authenticated;
grant execute on all functions in schema brandmatch to service_role;
