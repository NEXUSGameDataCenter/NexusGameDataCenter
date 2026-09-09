import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'node:crypto';
import {seal} from '@/lib/session-crypto';
import {cookieOptions} from '@/lib/auth';
import {configured,origin} from '@/lib/server';
export const runtime='nodejs';
export async function GET(){try{if(!configured())throw Error();const verifier=randomBytes(48).toString('base64url'),state=randomBytes(24).toString('hex');const callback=origin()+'/api/auth/callback?state='+state;
 (await cookies()).set('nexus_pkce',seal({verifier,state,expires:Date.now()+600000}),{...cookieOptions,maxAge:600});
 const url=new URL('/auth/v1/authorize',process.env.SUPABASE_URL!);url.searchParams.set('provider','google');url.searchParams.set('redirect_to',callback);url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','s256');url.searchParams.set('prompt','select_account');
 return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store'}});
 }catch{return new Response('กรุณาตั้งค่า SITE_URL, SESSION_SECRET, SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ให้ครบก่อนเปิด Google Login',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}}
