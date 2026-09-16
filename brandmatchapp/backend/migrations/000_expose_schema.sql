-- PostgREST only answers for schemas it is told about. The grants below keep
-- the schema reachable by the service role alone, which is what the api
-- function holds. anon stays locked out, so no key in a browser bundle can
-- reach a lead, a brand api key or a waitlist address.

alter role authenticator set pgrst.db_schemas = 'public, graphql_public, brandmatch';

grant usage on schema brandmatch to service_role;
grant all on all tables in schema brandmatch to service_role;
grant all on all sequences in schema brandmatch to service_role;
grant execute on all functions in schema brandmatch to service_role;
alter default privileges in schema brandmatch grant all on tables to service_role;
alter default privileges in schema brandmatch grant execute on functions to service_role;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
