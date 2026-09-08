-- For a NEW Supabase project only. The existing Nexus project is already configured.
create table public.game_entries (
 id uuid primary key default gen_random_uuid(),
 game text not null check (game in ('TOSM','Zone4')),
 category text not null check (category in ('ไอเทม','ตัวละคร','คู่มือ')),
 title text not null check (length(trim(title)) > 0),
 summary text not null default '',
 content text not null,
 tags text[] not null default '{}',
 source_url text,
 published boolean not null default false,
 updated_at timestamptz not null default now(),
 source_id text, source_file text, source_row integer,
 source_category text, source_status text
);
alter table public.game_entries enable row level security;
grant select on public.game_entries to anon;
revoke insert, update, delete, truncate, references, trigger on public.game_entries from anon, authenticated;
create policy "Read published game knowledge" on public.game_entries for select to anon using (published = true);
create index game_entries_game_category on public.game_entries(game,category);
create unique index game_entries_game_source_id on public.game_entries(game,source_id);
