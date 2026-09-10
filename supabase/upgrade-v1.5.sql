begin;
create table if not exists public.nexus_drafts (
 id uuid primary key default gen_random_uuid(),
 game text not null references public.games(id) on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object' and jsonb_typeof(payload->'title')='string' and jsonb_typeof(payload->'content')='string' and length(btrim(payload->>'title')) between 1 and 300 and length(btrim(payload->>'content')) between 1 and 20000 and payload ?& array['title','content','topic']),
 source_kind text not null check(source_kind in ('url','file')),
 source_url text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','duplicate')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 batch_id uuid not null default gen_random_uuid(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 entry_id uuid references public.game_entries(id) on delete set null,
 review_note text not null default '',
 fingerprint text generated always as (md5(lower(btrim(payload->>'title'))||E'\n'||lower(btrim(payload->>'content')))) stored,
 unique(game,fingerprint)
);
alter table public.nexus_drafts enable row level security;
create index if not exists nexus_drafts_queue on public.nexus_drafts(game,status,created_at desc,id);
revoke all on public.nexus_drafts from public,anon,authenticated;
grant select on public.nexus_drafts to authenticated;
grant insert(game,payload,source_kind,source_url,batch_id,created_by) on public.nexus_drafts to authenticated;
grant update(payload,status,reviewed_by,reviewed_at,entry_id,review_note) on public.nexus_drafts to authenticated;
drop policy if exists nexus_drafts_read on public.nexus_drafts;
create policy nexus_drafts_read on public.nexus_drafts for select to authenticated using ((select nexus_private.member_role()) in ('editor','admin'));
drop policy if exists nexus_drafts_create on public.nexus_drafts;
create policy nexus_drafts_create on public.nexus_drafts for insert to authenticated with check ((select nexus_private.member_role()) in ('editor','admin') and created_by=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null and entry_id is null);
drop policy if exists nexus_drafts_review on public.nexus_drafts;
create policy nexus_drafts_review on public.nexus_drafts for update to authenticated using ((select nexus_private.member_role())='admin') with check ((select nexus_private.member_role())='admin');
create or replace function public.nexus_enqueue(p_game text,p_rows jsonb,p_kind text,p_source text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; added int:=0; skipped int:=0; n int; batch uuid:=gen_random_uuid();
begin
 if coalesce(nexus_private.member_role(),'') not in ('editor','admin') then raise insufficient_privilege; end if;
 if p_rows is null or p_kind is null or p_kind not in ('file','url') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 5000 then raise exception using errcode='22023',message='Invalid import'; end if;
 perform id from public.games where id=p_game for update;
 if not found then raise exception using errcode='P0002',message='Game not found'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r)<>'object' or coalesce(length(btrim(r->>'title')),0) not between 1 and 300 or coalesce(length(btrim(r->>'content')),0) not between 1 and 20000 or coalesce(length(btrim(r->>'topic')),0) not between 1 and 80 then raise exception using errcode='22023',message='Invalid row'; end if;
  if exists(select 1 from public.game_entries e where e.game=p_game and (md5(lower(btrim(e.title))||E'\n'||lower(btrim(e.content)))=md5(lower(btrim(r->>'title'))||E'\n'||lower(btrim(r->>'content'))) or (nullif(r->>'source_id','') is not null and e.source_id=r->>'source_id'))) or exists(select 1 from public.nexus_drafts d where d.game=p_game and nullif(r->>'source_id','') is not null and d.payload->>'source_id'=r->>'source_id') then skipped:=skipped+1; continue; end if;
  insert into public.nexus_drafts(game,payload,source_kind,source_url,batch_id,created_by) values(p_game,r,p_kind,p_source,batch,auth.uid()) on conflict(game,fingerprint) do nothing;
  get diagnostics n=row_count;added:=added+n;skipped:=skipped+1-n;
 end loop;
 return jsonb_build_object('added',added,'skipped',skipped,'batch_id',batch);
end $$;
create or replace function public.nexus_review(p_id uuid,p_action text,p_payload jsonb default null,p_note text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.nexus_drafts; gid text; r jsonb; eid uuid; taglist text[];
begin
 if coalesce(nexus_private.member_role(),'')<>'admin' then raise insufficient_privilege; end if;
 select game into gid from public.nexus_drafts where id=p_id;
 perform id from public.games where id=gid for update;
 if not found then raise exception using errcode='P0002',message='Draft or game not found'; end if;
 select * into d from public.nexus_drafts where id=p_id for update;
 if d.status<>'pending' then return jsonb_build_object('status',d.status,'entry_id',d.entry_id,'already_reviewed',true); end if;
 if p_action='reject' then
  update public.nexus_drafts set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),1000) where id=p_id;
  return jsonb_build_object('status','rejected');
 end if;
 if p_action is distinct from 'approve' then raise exception using errcode='22023',message='Invalid review action'; end if;
 r=coalesce(p_payload,d.payload);
 if coalesce(length(btrim(r->>'title')),0) not between 1 and 300 or coalesce(length(btrim(r->>'content')),0) not between 1 and 20000 or coalesce(length(btrim(r->>'topic')),0) not between 1 and 80 then raise exception using errcode='22023',message='Invalid reviewed content'; end if;
 if exists(select 1 from public.game_entries e where e.game=gid and (md5(lower(btrim(e.title))||E'\n'||lower(btrim(e.content)))=md5(lower(btrim(r->>'title'))||E'\n'||lower(btrim(r->>'content'))) or (nullif(r->>'source_id','') is not null and e.source_id=r->>'source_id'))) then
  update public.nexus_drafts set status='duplicate',reviewed_by=auth.uid(),reviewed_at=now(),review_note='Existing entry detected at approval' where id=p_id;
  return jsonb_build_object('status','duplicate');
 end if;
 select coalesce(array_agg(value),'{}'::text[]) into taglist from jsonb_array_elements_text(case when jsonb_typeof(r->'tags')='array' then r->'tags' else '[]'::jsonb end);
 insert into public.game_entries(game,title,content,summary,category,source_category,tags,source_url,source_id,published,updated_at)
 values(gid,btrim(r->>'title'),btrim(r->>'content'),left(coalesce(nullif(r->>'summary',''),r->>'content'),500),case when r->>'category' in ('ไอเทม','ตัวละคร','คู่มือ') then r->>'category' else 'คู่มือ' end,r->>'topic',taglist,nullif(r->>'source_url',''),nullif(r->>'source_id',''),true,now()) returning id into eid;
 -- Keep the original payload for audit; the approved entry contains the edited version.
 update public.nexus_drafts set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),entry_id=eid,review_note=left(coalesce(p_note,''),1000) where id=p_id;
 return jsonb_build_object('status','approved','entry_id',eid);
end $$;
revoke all on function public.nexus_enqueue(text,jsonb,text,text),public.nexus_review(uuid,text,jsonb,text) from public,anon;
grant execute on function public.nexus_enqueue(text,jsonb,text,text),public.nexus_review(uuid,text,jsonb,text) to authenticated;
create or replace function public.nexus_delete_game(p_id text,p_confirm text,p_delete_entries boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.games; n bigint; removed bigint; drafts bigint;
begin
 if coalesce(nexus_private.member_role(),'') not in ('editor','admin') then raise insufficient_privilege; end if;
 select * into g from public.games where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='Game not found'; end if;
 if p_confirm is distinct from g.name then raise exception using errcode='22023',message='Game name confirmation does not match'; end if;
 select count(*) into n from public.game_entries where game=p_id;
 select count(*) into drafts from public.nexus_drafts where game=p_id;
 if (n>0 or drafts>0) and not p_delete_entries then raise exception using errcode='23503',message='Game contains entries'; end if;
 delete from public.game_entries where game=p_id;
 get diagnostics removed=row_count;
 delete from public.games where id=p_id;
 if not found then raise insufficient_privilege; end if;
 return jsonb_build_object('id',p_id,'deleted_entries',removed,'image_path',g.image_path,'deleted_drafts',drafts);
end $$;
revoke all on function public.nexus_delete_game(text,text,boolean) from public,anon;
grant execute on function public.nexus_delete_game(text,text,boolean) to authenticated;

do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.nexus_drafts'::regclass and conname='nexus_drafts_topic_text') then
 alter table public.nexus_drafts add constraint nexus_drafts_topic_text check(jsonb_typeof(payload->'topic')='string' and coalesce(length(btrim(payload->>'topic')),0) between 1 and 80 and pg_column_size(payload)<=100000);
 end if;
end $$;
notify pgrst,'reload schema';
commit;
