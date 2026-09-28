-- Solo para PostgreSQL local temporal, emula identidad y roles de Supabase.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
create function auth.role() returns text language sql stable as $$ select current_user::text; $$;
grant usage on schema auth,public to authenticated,anon;
grant execute on all functions in schema auth to authenticated,anon;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
create publication supabase_realtime;
