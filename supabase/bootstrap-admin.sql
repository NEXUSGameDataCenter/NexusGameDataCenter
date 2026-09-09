-- Run in Supabase SQL Editor AFTER the owner signs in with Google on v1.3.
-- Replace the exact email below. Never auto-promote the first visitor.
do $$ declare owner_email text := 'REPLACE_WITH_YOUR_GOOGLE_EMAIL'; affected integer; begin
 if owner_email='REPLACE_WITH_YOUR_GOOGLE_EMAIL' then raise exception 'Replace owner_email with your Google account email'; end if;
 update public.nexus_members set status='approved',role='admin' where lower(email)=lower(owner_email);
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Expected one membership request, found %. Sign in on v1.3 first.',affected; end if;
end $$;
