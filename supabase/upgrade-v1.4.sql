-- Run after the existing 1.3 activation. Adds delete permissions; does not delete data.
begin;
grant delete on public.games,public.game_entries to authenticated;
drop policy if exists nexus_games_delete on public.games;
create policy nexus_games_delete on public.games for delete to authenticated using ((select nexus_private.member_role()) in ('editor','admin'));
drop policy if exists nexus_entries_delete on public.game_entries;
create policy nexus_entries_delete on public.game_entries for delete to authenticated using ((select nexus_private.member_role()) in ('editor','admin'));
-- Editors must also see unpublished rows when confirming and deleting a whole game.
drop policy if exists nexus_entries_editor_read on public.game_entries;
create policy nexus_entries_editor_read on public.game_entries for select to authenticated using ((select nexus_private.member_role()) in ('editor','admin'));
create or replace function public.nexus_delete_game(p_id text,p_confirm text,p_delete_entries boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.games; n bigint; removed bigint;
begin
 if coalesce(nexus_private.member_role(),'') not in ('editor','admin') then raise insufficient_privilege; end if;
 select * into g from public.games where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='Game not found'; end if;
 if p_confirm is distinct from g.name then raise exception using errcode='22023',message='Game name confirmation does not match'; end if;
 select count(*) into n from public.game_entries where game=p_id;
 if n>0 and not p_delete_entries then raise exception using errcode='23503',message='Game contains entries'; end if;
 delete from public.game_entries where game=p_id;
 get diagnostics removed=row_count;
 delete from public.games where id=p_id;
 if not found then raise insufficient_privilege; end if;
 return jsonb_build_object('id',p_id,'deleted_entries',removed,'image_path',g.image_path);
end $$;
revoke all on function public.nexus_delete_game(text,text,boolean) from public,anon;
grant execute on function public.nexus_delete_game(text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
