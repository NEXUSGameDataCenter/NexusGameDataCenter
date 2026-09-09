import {createHash,timingSafeEqual} from 'node:crypto';
export const configured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY);
export const adminReady=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&(process.env.ADMIN_ACCESS_KEY?.length||0)>=24);
export function authorized(req:Request){
 if(!adminReady()) return false;
 const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(supplied.length>512)return false;
 const hash=(s:string)=>createHash('sha256').update(s).digest();
 return timingSafeEqual(hash(supplied),hash(process.env.ADMIN_ACCESS_KEY!));
}
export async function db(path:string,init:RequestInit={},admin=false){
 const key=admin?process.env.SUPABASE_SECRET_KEY:process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!key||!process.env.SUPABASE_URL)throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล');
 const headers=new Headers(init.headers);headers.set('apikey',key);headers.set('Content-Type','application/json');
 if(key.startsWith('eyJ'))headers.set('Authorization','Bearer '+key);
 return fetch(new URL('/rest/v1/'+path,process.env.SUPABASE_URL),{...init,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
}
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
