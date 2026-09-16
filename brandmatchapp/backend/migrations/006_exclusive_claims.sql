-- A lead belongs to one brand at a time.
--
-- Handing a creator to a brand claims it. The claim holds for 14 days, and
-- for those 14 days no other brand can be given the same handle. After that
-- the creator is free again, by which time its Signal star has long expired
-- (strong at 4 days, gone at 10), so whoever gets it next gets it re-crawled.
--
-- Reads were already private: the feed joins on the brand. What was missing
-- was the write side, where two campaigns could be handed the same row.

create or replace function brandmatch.claim_window()
returns interval language sql immutable as $$ select interval '14 days' $$;

create index if not exists discoveries_creator_recent
  on brandmatch.discoveries (creator_id, discovered_at desc);

/** True when no other brand holds this creator inside the window. */
create or replace function brandmatch.is_free(p_creator uuid, p_brand uuid)
returns boolean language sql stable as $$
  select not exists (
    select 1 from brandmatch.discoveries d
    where d.creator_id = p_creator
      and d.brand_id <> p_brand
      and d.discovered_at > now() - brandmatch.claim_window()
  )
$$;

/**
 * Claims a creator for a campaign, or returns false when another brand holds
 * it. The crawl calls this for every profile it brings back, so a handle one
 * brand already owns never lands in another brand's list.
 */
create or replace function brandmatch.claim(
  p_creator uuid, p_campaign uuid, p_agent uuid, p_brand uuid, p_fresh boolean
)
returns boolean language plpgsql volatile as $$
begin
  if not brandmatch.is_free(p_creator, p_brand) then
    return false;
  end if;
  insert into brandmatch.discoveries (creator_id, campaign_id, agent_id, brand_id, fresh)
  values (p_creator, p_campaign, p_agent, p_brand, p_fresh)
  on conflict (campaign_id, creator_id) do nothing;
  return true;
end
$$;

/** How much of the pool one brand could still be given today. */
create or replace function brandmatch.free_pool(p_brand uuid)
returns bigint language sql stable as $$
  select count(*) from brandmatch.creators cr
  where not exists (
    select 1 from brandmatch.discoveries d
    where d.creator_id = cr.id
      and (d.brand_id = p_brand or d.discovered_at > now() - brandmatch.claim_window())
  )
$$;

revoke all on function brandmatch.claim_window() from anon, authenticated;
revoke all on function brandmatch.is_free(uuid, uuid) from anon, authenticated;
revoke all on function brandmatch.claim(uuid, uuid, uuid, uuid, boolean) from anon, authenticated;
revoke all on function brandmatch.free_pool(uuid) from anon, authenticated;
grant execute on all functions in schema brandmatch to service_role;
