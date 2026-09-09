-- Upgrade the existing Nexus database. Safe to re-run.
create table if not exists public.games (
 id text primary key check (id ~ '^[A-Za-z0-9_-]{1,48}$'),
 name text not null check (length(trim(name)) between 1 and 80),
 description text not null default '' check (length(description)<=240),
 color text not null default 'teal' check(color in ('teal','blue','violet','orange','rose')),
 created_at timestamptz not null default now()
);
alter table public.games enable row level security;
revoke all on public.games from anon,authenticated;
grant select on public.games to anon,authenticated;
grant all on public.games to service_role;
drop policy if exists "Read game catalog" on public.games;
create policy "Read game catalog" on public.games for select to anon,authenticated using (true);
insert into public.games (id,name,color)
select distinct game,game,case when game='Zone4' then 'orange' else 'teal' end from public.game_entries on conflict(id) do nothing;
insert into public.games(id,name,color) values ('Zone4','Zone4','orange') on conflict(id) do nothing;
alter table public.game_entries drop constraint if exists game_entries_game_check;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='game_entries_game_fkey' and conrelid='public.game_entries'::regclass) then
 alter table public.game_entries add constraint game_entries_game_fkey foreign key(game) references public.games(id) on update cascade on delete restrict;
 end if;
end $$;
alter table public.game_entries add column if not exists topic text generated always as (coalesce(nullif(source_category,''),category)) stored;
create index if not exists game_entries_game_topic on public.game_entries(game,topic);
create or replace function public.nexus_catalog() returns jsonb
language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
 'games',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'description',g.description,'color',g.color,'count',(select count(*) from public.game_entries e where e.game=g.id and e.published)) order by g.created_at,g.id) from public.games g),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(to_jsonb(t) order by t.topic) from (select game,topic,count(*) as count from public.game_entries where published group by game,topic) t),'[]'::jsonb),
 'total',(select count(*) from public.game_entries where published)
); $$;
revoke all on function public.nexus_catalog() from public;
grant execute on function public.nexus_catalog() to anon,authenticated,service_role;
