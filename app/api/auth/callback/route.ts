import {cookies} from 'next/headers';
import {timingSafeEqual} from 'node:crypto';
import {unseal} from '@/lib/session-crypto';
import {storeSession,cookieOptions} from '@/lib/auth';
import {origin,supabase} from '@/lib/server';
export const runtime='nodejs';
export async function GET(req:Request){let reason='callback';try{const jar=await cookies();const flow=unseal<{verifier:string;state:string;expires:number}>(jar.get('nexus_pkce')?.value||'');jar.set('nexus_pkce','',{...cookieOptions,maxAge:0});const url=new URL(req.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code');
 if(url.searchParams.has('error')){reason='google';throw Error();}
 if(!flow||flow.expires<Date.now()||!code||state.length!==flow.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(flow.state)))throw Error();
 const r=await supabase('/auth/v1/token?grant_type=pkce',{method:'POST',body:JSON.stringify({auth_code:code,code_verifier:flow.verifier})});if(!r.ok)throw Error();const d=await r.json();if(!d.access_token||!d.refresh_token)throw Error();await storeSession({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+d.expires_in});
 return new Response(null,{status:303,headers:{Location:origin()+'/', 'Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:303,headers:{Location:origin()+'/?auth_error='+reason,'Cache-Control':'no-store'}});}}
