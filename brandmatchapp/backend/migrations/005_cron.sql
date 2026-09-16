-- Every hour, hand the crawl function whatever agent has not run in 20 hours.
-- The hour is the granularity: the function itself decides who is due, so a
-- brand in Sydney and a brand in Paris both get their batch before their 7am
-- without a job per timezone.
--
-- The secret lives in the vault. Set the same value as CRAWL_SECRET in the
-- edge function secrets, so both ends of the call match.

create or replace function brandmatch.kick_crawl()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_id bigint;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'brandmatch_crawl_secret';
  if v_secret is null then
    raise warning 'brandmatch: no crawl secret in the vault, nothing started';
    return null;
  end if;

  select net.http_post(
    url     := 'https://decuztcvbfwgkudnbljk.supabase.co/functions/v1/crawl',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-crawl-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) into v_id;
  return v_id;
end
$$;

revoke all on function brandmatch.kick_crawl() from public, anon, authenticated;

select cron.schedule('brandmatch_hourly_crawl', '17 * * * *', $$select brandmatch.kick_crawl()$$);
