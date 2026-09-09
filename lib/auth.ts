import {cookies} from 'next/headers';
import {seal,unseal} from './session-crypto';
import {AppError,db,must,supabase} from './server';
export type Member={id:string;email:string;display_name:string;status:'pending'|'approved'|'blocked';role:'viewer'|'editor'|'admin';created_at:string;updated_at:string};
export type Session={access_token:string;refresh_token:string;expires_at:number};
export type Access={token:string;user:{id:string;email:string};member:Member};
export const COOKIE='nexus_session';
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
export async function storeSession(s:Session){const encrypted=seal(s);if(encrypted.length>3800)throw new AppError('เซสชันมีขนาดเกินกำหนด กรุณาติดต่อผู้ดูแล',502);(await cookies()).set(COOKIE,encrypted,{...cookieOptions,maxAge:604800});}
export async function clearSession(){(await cookies()).set(COOKIE,'',{...cookieOptions,maxAge:0});}
export async function readSession(){return unseal<Session>((await cookies()).get(COOKIE)?.value||'');}
export async function identity(refresh=false){let s=await readSession();if(!s?.access_token||!s.refresh_token)throw new AppError('กรุณาเข้าสู่ระบบด้วย Google',401,'LOGIN_REQUIRED');
 if(s.expires_at<=Math.floor(Date.now()/1000)+90){if(!refresh)throw new AppError('กรุณาต่ออายุเซสชัน',401,'SESSION_EXPIRED');const r=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok){await clearSession();throw new AppError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',401,'LOGIN_REQUIRED');}const d=await r.json();s={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+d.expires_in};await storeSession(s);}
 const r=await supabase('/auth/v1/user',{},s.access_token);if(!r.ok)throw new AppError('กรุณาเข้าสู่ระบบใหม่',401,'LOGIN_REQUIRED');const u=await r.json();
 if(!u.id||!u.email||!u.app_metadata?.providers?.includes('google'))throw new AppError('ต้องใช้บัญชี Google เพื่อเข้าใช้งาน',403,'GOOGLE_REQUIRED');
 return {session:s,user:u};
}
export async function currentAccess(refresh=false,register=false):Promise<Access>{const {session,user}=await identity(refresh);
 const path='nexus_members?select=*&id=eq.'+encodeURIComponent(user.id);let rows=await (await must(await db(path,{},session.access_token),'membership.read')).json();
 if(!rows.length&&register){const r=await db('nexus_members',{method:'POST',body:JSON.stringify({id:user.id,email:user.email,display_name:String(user.user_metadata?.full_name||user.email).slice(0,120),status:'pending',role:'viewer'})},session.access_token);if(!r.ok&&r.status!==409)await must(r,'membership.request');rows=await (await must(await db(path,{},session.access_token),'membership.read')).json();}
 if(!rows.length)throw new AppError('เซสชันถูกยกเลิกหรือยังไม่มีคำขอสิทธิ์ กรุณาเข้าสู่ระบบใหม่',401,'LOGIN_REQUIRED');return {token:session.access_token,user:{id:user.id,email:user.email},member:rows[0]};
}
export async function requireAccess(role:'viewer'|'editor'|'admin'='viewer'){const a=await currentAccess();if(a.member.status!=='approved')throw new AppError(a.member.status==='blocked'?'บัญชีนี้ถูกระงับสิทธิ์':'บัญชีนี้กำลังรอผู้ดูแลอนุมัติ',403,'ACCESS_'+a.member.status.toUpperCase());const rank={viewer:0,editor:1,admin:2};if(rank[a.member.role]<rank[role])throw new AppError('บัญชีนี้ไม่มีสิทธิ์ดำเนินการ',403,'ROLE_REQUIRED');return a;}
