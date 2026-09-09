import {readSession,clearSession} from '@/lib/auth';
import {sameOrigin,supabase,reply,fail} from '@/lib/server';
export async function POST(req:Request){try{sameOrigin(req);const s=await readSession();let revoked=true;try{if(s?.access_token){const r=await supabase('/auth/v1/logout?scope=local',{method:'POST'},s.access_token);revoked=r.ok;}}catch{revoked=false;}await clearSession();return reply({ok:true,revoked});}catch(e){return fail(e);}}
