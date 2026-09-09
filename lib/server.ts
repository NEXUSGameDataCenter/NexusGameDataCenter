export const configured=()=>Boolean(process.env.SUPABASE_URL?.trim()&&process.env.SUPABASE_PUBLISHABLE_KEY?.trim());
export class AppError extends Error{constructor(message:string,public status=500,public code='APP_ERROR'){super(message);}}
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function fail(e:unknown){return reply({error:e instanceof AppError?e.message:'บริการยังไม่พร้อม กรุณาลองใหม่',code:e instanceof AppError?e.code:'SERVICE_ERROR'},e instanceof AppError?e.status:502);}
export function origin(){const value=process.env.SITE_URL?.trim();if(!value)throw new AppError('กรุณาตั้งค่า SITE_URL ใน Vercel',503,'SETUP_REQUIRED');const u=new URL(value);if(u.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&u.hostname==='localhost'))throw new AppError('SITE_URL ต้องใช้ HTTPS',503);return u.origin;}
export function sameOrigin(req:Request){if(req.headers.get('origin')!==origin())throw new AppError('คำขอไม่ได้มาจากเว็บไซต์นี้ กรุณารีเฟรชหน้า',403,'BAD_ORIGIN');}
export async function supabase(path:string,init:RequestInit={},token?:string){
 if(!configured())throw new AppError('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase',503,'SETUP_REQUIRED');
 const headers=new Headers(init.headers);headers.set('apikey',process.env.SUPABASE_PUBLISHABLE_KEY!.trim());
 if(token)headers.set('Authorization','Bearer '+token);
 if(typeof init.body==='string'&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 try{return await fetch(new URL(path,process.env.SUPABASE_URL!.trim()),{...init,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new AppError('ติดต่อ Supabase ไม่สำเร็จ กรุณาลองอีกครั้ง',502,'DATABASE_UNAVAILABLE');}
}
export const db=(path:string,init:RequestInit={},token?:string)=>supabase('/rest/v1/'+path,init,token);
export async function must(r:Response,action:string){if(r.ok)return r;let code='UNKNOWN';try{const b=await r.json();if(typeof b.code==='string'&&/^[A-Za-z0-9_]{1,50}$/.test(b.code))code=b.code;}catch{}
 const reference=crypto.randomUUID();console.error(JSON.stringify({event:'nexus_upstream_error',action,status:r.status,code,reference}));
 const messages:Record<string,string>={'42501':'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ กรุณาติดต่อผู้ดูแล','23503':'ไม่พบเกมหรือรายการที่อ้างอิง กรุณาโหลดหน้าใหม่','23505':'รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น','23514':'ข้อมูลไม่ตรงเงื่อนไขของตาราง กรุณาตรวจช่องที่กรอก','PGRST202':'กรุณาติดตั้ง SQL สำหรับเวอร์ชัน 1.3 ให้ครบ','PGRST204':'โครงสร้างตารางยังไม่ตรงกับเวอร์ชัน 1.3','P0001':'ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองหรือถอนผู้ดูแลคนสุดท้ายได้'};
 throw new AppError((r.status===401?'เซสชันหมดอายุหรือ Supabase ไม่ยอมรับ Key':messages[code]||'บันทึกหรืออ่านข้อมูลไม่สำเร็จ')+` (HTTP ${r.status} / ${code} / ${reference})`,r.status===401?401:r.status===403||code==='42501'?403:r.status===409?409:502,code);
}
export async function jsonBody(req:Request,max=40000){const raw=await req.text();if(raw.length>max)throw new AppError('ข้อมูลยาวเกินกำหนด',413);let b;try{b=JSON.parse(raw);}catch{throw new AppError('รูปแบบ JSON ไม่ถูกต้อง',400);}if(!b||typeof b!=='object'||Array.isArray(b))throw new AppError('รูปแบบข้อมูลไม่ถูกต้อง',400);return b;}
