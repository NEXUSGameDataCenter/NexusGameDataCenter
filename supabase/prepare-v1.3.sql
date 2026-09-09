-- NEXUS 1.3: nonbreaking preparation for the existing Nexus schema.
-- Execute before deploying 1.3. This does NOT close the old anonymous reader.
begin;
alter table public.games add column if not exists image_path text;
create table if not exists public.nexus_members (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null check(length(email)<=320),
 display_name text not null default '' check(length(display_name)<=120),
 status text not null default 'pending' check(status in ('pending','approved','blocked')),
 role text not null default 'viewer' check(role in ('viewer','editor','admin')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.nexus_members enable row level security;
create index if not exists nexus_members_status_created on public.nexus_members(status,created_at desc);
revoke all on public.nexus_members from public,anon,authenticated;
grant select on public.nexus_members to authenticated;
grant insert(id,email,display_name,status,role) on public.nexus_members to authenticated;
grant update(status,role) on public.nexus_members to authenticated;
grant all on public.nexus_members to service_role;
create schema if not exists nexus_private;
revoke all on schema nexus_private from public,anon;
grant usage on schema nexus_private to authenticated;
-- These narrow internal lookups need definer rights for auth.sessions and to avoid
-- recursive membership RLS. Keep nexus_private OUT of the API exposed schemas.
create or replace function nexus_private.session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and coalesce((auth.jwt()->'app_metadata'->'providers') ? 'google',false)
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id');
$$;
create or replace function nexus_private.member_role() returns text
language sql stable security definer set search_path='' as $$
 select m.role from public.nexus_members m where m.id=auth.uid() and m.status='approved' and nexus_private.session_valid();
$$;
revoke all on function nexus_private.session_valid(),nexus_private.member_role() from public,anon;
grant execute on function nexus_private.session_valid(),nexus_private.member_role() to authenticated;
drop policy if exists nexus_members_read on public.nexus_members;
create policy nexus_members_read on public.nexus_members for select to authenticated
 using ((id=(select auth.uid()) and (select nexus_private.session_valid())) or (select nexus_private.member_role())='admin');
drop policy if exists nexus_members_request on public.nexus_members;
create policy nexus_members_request on public.nexus_members for insert to authenticated
 with check (id=(select auth.uid()) and email=(select auth.jwt()->>'email') and status='pending' and role='viewer' and (select nexus_private.session_valid()));
drop policy if exists nexus_members_admin_update on public.nexus_members;
create policy nexus_members_admin_update on public.nexus_members for update to authenticated
 using ((select nexus_private.member_role())='admin' and id<>(select auth.uid()))
 with check ((select nexus_private.member_role())='admin' and id<>(select auth.uid()));
create or replace function nexus_private.guard_member_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7131301);
 if TG_OP='UPDATE' then
   if auth.uid()=old.id then raise exception 'Cannot change own membership'; end if;
   if old.id<>new.id or old.email<>new.email or old.created_at<>new.created_at then raise exception 'Immutable membership identity'; end if;
   new.updated_at=now();
 end if;
 if old.status='approved' and old.role='admin' then
   if TG_OP='DELETE' or new.status<>'approved' or new.role<>'admin' then
     if not exists(select 1 from public.nexus_members where id<>old.id and status='approved' and role='admin') then raise exception 'Cannot remove last administrator'; end if;
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function nexus_private.guard_member_change() from public,anon,authenticated;
drop trigger if exists nexus_guard_members on public.nexus_members;
create trigger nexus_guard_members before update or delete on public.nexus_members for each row execute function nexus_private.guard_member_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('game-images','game-images',false,3145728,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive policy prevents unrelated permissive storage policies from opening this bucket.
drop policy if exists nexus_images_anon_guard on storage.objects;
create policy nexus_images_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'game-images') with check(bucket_id<>'game-images');
drop policy if exists nexus_images_guard on storage.objects;
create policy nexus_images_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'game-images' or (select nexus_private.member_role()) is not null)
 with check(bucket_id<>'game-images' or (select nexus_private.member_role()) in ('editor','admin'));
drop policy if exists nexus_images_read on storage.objects;
create policy nexus_images_read on storage.objects for select to authenticated
 using(bucket_id='game-images' and (select nexus_private.member_role()) is not null);
drop policy if exists nexus_images_insert on storage.objects;
create policy nexus_images_insert on storage.objects for insert to authenticated
 with check(bucket_id='game-images' and (select nexus_private.member_role()) in ('editor','admin') and (storage.foldername(name))[1] in (select id from public.games));
drop policy if exists nexus_images_update on storage.objects;
create policy nexus_images_update on storage.objects for update to authenticated
 using(bucket_id='game-images' and (select nexus_private.member_role()) in ('editor','admin'))
 with check(bucket_id='game-images' and (select nexus_private.member_role()) in ('editor','admin') and (storage.foldername(name))[1] in (select id from public.games));
drop policy if exists nexus_images_delete on storage.objects;
create policy nexus_images_delete on storage.objects for delete to authenticated
 using(bucket_id='game-images' and (select nexus_private.member_role()) in ('editor','admin'));
commit;
