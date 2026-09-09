-- SECURITY CUTOVER. Run AFTER prepare-v1.3.sql, Google setup, deployment, and bootstrap.
-- This disables anonymous access to game data; earlier public versions stop reading.
begin;
do $$ begin
 if not exists(select 1 from public.nexus_members where status='approved' and role='admin') then
 raise exception 'Sign in with Google and run bootstrap-admin.sql first'; end if;
end $$;
alter table public.games enable row level security;
alter table public.game_entries enable row level security;
revoke all on public.games,public.game_entries from public,anon,authenticated;
grant select,insert,update on public.games,public.game_entries to authenticated;
grant all on public.games,public.game_entries to service_role;
-- Replace old permissive policies on these two Nexus-owned tables only.
do $$ declare p record; begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('games','game_entries') loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
create policy nexus_games_read on public.games for select to authenticated using ((select nexus_private.member_role()) is not null);
create policy nexus_games_insert on public.games for insert to authenticated with check ((select nexus_private.member_role()) in ('editor','admin'));
create policy nexus_games_update on public.games for update to authenticated using ((select nexus_private.member_role()) in ('editor','admin')) with check ((select nexus_private.member_role()) in ('editor','admin'));
create policy nexus_entries_read on public.game_entries for select to authenticated using (published and (select nexus_private.member_role()) is not null);
create policy nexus_entries_insert on public.game_entries for insert to authenticated with check ((select nexus_private.member_role()) in ('editor','admin'));
create policy nexus_entries_update on public.game_entries for update to authenticated using ((select nexus_private.member_role()) in ('editor','admin')) with check ((select nexus_private.member_role()) in ('editor','admin'));
create or replace function public.nexus_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'games',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'color',g.color,'image_path',g.image_path,'count',(select count(*) from public.game_entries e where e.game=g.id and e.published)) order by g.created_at,g.id) from public.games g),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(to_jsonb(t) order by t.topic) from (select game,topic,count(*) as count from public.game_entries where published group by game,topic) t),'[]'::jsonb),
 'total',(select count(*) from public.game_entries where published)
); $$;
revoke all on function public.nexus_catalog() from public,anon;
grant execute on function public.nexus_catalog() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
