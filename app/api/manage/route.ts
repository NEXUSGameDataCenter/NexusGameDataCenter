import {authorized,adminReady,db,reply,adminKeyIssue,databaseFailure} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!adminReady())return reply({error:'เจ้าของเว็บต้องตั้งค่า ADMIN_ACCESS_KEY และ SUPABASE_SECRET_KEY ใน Vercel ก่อนใช้งานหน้าจัดการ'},503);
 if(!authorized(req))return reply({error:'รหัสผู้ดูแลไม่ถูกต้อง'},401);
 let b;try{const raw=await req.text();if(raw.length>35000)return reply({error:'ข้อมูลยาวเกินกำหนด'},413);b=JSON.parse(raw);}catch{return reply({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}
 if(!b||typeof b!=='object')return reply({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);
 try{
 const keyIssue=adminKeyIssue();if(keyIssue)return reply({error:keyIssue},503);
 if(b.action==='verify'){const check=await db('games?select=id&limit=1',{},true);if(!check.ok)return databaseFailure(check,'verify');return reply({ok:true});}
 if(b.action==='game.create'||b.action==='game.update'){
 const id=String(b.id||''),name=String(b.name||'').trim(),description=String(b.description||'').trim(),color=String(b.color||'teal');
 if(!/^[A-Za-z0-9_-]{1,48}$/.test(id)||id==='all'||!name||name.length>80||description.length>240||!['teal','blue','violet','orange','rose'].includes(color))return reply({error:'ตรวจรหัสเกม ชื่อ และรายละเอียดอีกครั้ง'},400);
 const edit=b.action==='game.update';
 const r=await db('games'+(edit?'?id=eq.'+encodeURIComponent(id):''),{method:edit?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(edit?{name,description,color}:{id,name,description,color})},true);
 if(!r.ok)return databaseFailure(r,b.action);
 const data=await r.json();if(!data.length)return reply({error:'ไม่พบเกมนี้แล้ว'},404);return reply({game:data[0]});
 }
 if(b.action==='entry.create'){
 const game=String(b.game||''),title=String(b.title||'').trim(),content=String(b.content||'').trim(),topic=String(b.topic||'ทั่วไป').trim();
 if(!/^[A-Za-z0-9_-]{1,48}$/.test(game)||!title||title.length>300||!content||content.length>20000||!topic||topic.length>80)return reply({error:'กรุณาระบุเกม หัวข้อ คำตอบ และหมวดหมู่ให้ครบ'},400);
 const r=await db('game_entries',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({game,title,content,summary:content.slice(0,160),category:'คู่มือ',source_category:topic,tags:[topic],published:true})},true);
 if(!r.ok)return databaseFailure(r,'entry.create');return reply({entry:(await r.json())[0]});
 }
 return reply({error:'ไม่รองรับคำสั่งนี้'},400);
 }catch(e){return reply({error:(e as Error).message},502);}
}
