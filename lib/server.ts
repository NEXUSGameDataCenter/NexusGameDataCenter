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
 const key=(admin?process.env.SUPABASE_SECRET_KEY:process.env.SUPABASE_PUBLISHABLE_KEY)?.trim();
 if(admin){const issue=adminKeyIssue();if(issue)throw new Error(issue);}
 if(!key||!process.env.SUPABASE_URL)throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล');
 const headers=new Headers(init.headers);headers.set('apikey',key);headers.set('Content-Type','application/json');
 if(key.startsWith('eyJ'))headers.set('Authorization','Bearer '+key);
 return fetch(new URL('/rest/v1/'+path,process.env.SUPABASE_URL),{...init,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
}
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export function adminKeyIssue():string|null{
 const key=process.env.SUPABASE_SECRET_KEY?.trim()||'';
 if(key.startsWith('sb_publishable_'))return 'SUPABASE_SECRET_KEY ตั้งเป็น Publishable key ซึ่งอ่านได้อย่างเดียว กรุณาเปลี่ยนเป็น Secret key ของโปรเจกต์นี้ แล้ว Redeploy';
 if(key.startsWith('sb_secret_'))return null;
 if(key.startsWith('eyJ')){try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(payload.role==='service_role')return null;}catch{}return 'Key แบบ JWT ต้องเป็น service_role ไม่ใช่ anon หรือโทเคนผู้ใช้';}
 return 'รูปแบบ SUPABASE_SECRET_KEY ไม่ถูกต้อง ให้คัดลอก Secret key ที่ขึ้นต้น sb_secret_ โดยไม่ใส่เครื่องหมายคำพูด แล้ว Redeploy';
}
export async function databaseFailure(r:Response,action:string){
 const reference=crypto.randomUUID();let code='UNKNOWN';
 try{const body=await r.json();if(typeof body.code==='string'&&/^[A-Za-z0-9_]{1,40}$/.test(body.code))code=body.code;}catch{}
 let error='ฐานข้อมูลปฏิเสธคำขอ กรุณาส่งรหัสอ้างอิงนี้ให้ผู้ดูแล';
 if(r.status===401||code==='PGRST301')error='Supabase ไม่ยอมรับ Secret key: ตรวจว่า Key ยังใช้งานได้และมาจากโปรเจกต์เดียวกับ SUPABASE_URL แล้ว Redeploy';
 else if(r.status===403||code==='42501')error='Key ที่ใช้ไม่มีสิทธิ์เขียนข้อมูล หรือถูก RLS ปฏิเสธ กรุณาตรวจ SUPABASE_SECRET_KEY และสิทธิ์ตาราง';
 else if(code==='23503')error='ไม่พบรหัสเกมที่อ้างอิง กรุณาโหลดหน้าใหม่แล้วเลือกเกมอีกครั้ง';
 else if(code==='23505')error='รหัสนี้มีอยู่ในฐานข้อมูลแล้ว กรุณาใช้รหัสอื่น';
 else if(code==='23514'||code==='23502')error='ข้อมูลไม่ตรงตามข้อกำหนดของตาราง กรุณาตรวจช่องที่จำเป็นและโครงสร้างฐานข้อมูล';
 else if(code==='PGRST204'||code==='42P01'||code==='42703'||code==='PGRST205')error='ตารางหรือคอลัมน์ยังไม่ตรงกับแอป กรุณาตรวจว่าใช้โปรเจกต์ที่อัปเกรดเวอร์ชัน 2 แล้ว';
 console.error(JSON.stringify({event:'nexus_database_error',action,status:r.status,code,reference}));
 return reply({error:error+' (HTTP '+r.status+' / '+code+' / อ้างอิง '+reference+')',code,reference},502);
}
