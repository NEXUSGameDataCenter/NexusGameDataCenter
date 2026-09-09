import {db,reply,fail,must,sameOrigin,jsonBody} from '@/lib/server';
import {requireAccess} from '@/lib/auth';
export const runtime='nodejs';
export async function POST(req:Request){
 try{sameOrigin(req);const a=await requireAccess('editor');const b=await jsonBody(req);
 if(b.action==='game.create'||b.action==='game.update'){
 const id=String(b.id||''),name=String(b.name||'').trim(),description=String(b.description||'').trim(),color=String(b.color||'teal');
 if(!/^[A-Za-z0-9_-]{1,48}$/.test(id)||id==='all'||!name||name.length>80||description.length>240||!['teal','blue','violet','orange','rose'].includes(color))return reply({error:'ตรวจรหัสเกม ชื่อ และรายละเอียดอีกครั้ง'},400);
 const edit=b.action==='game.update';
 const r=await db('games'+(edit?'?id=eq.'+encodeURIComponent(id):''),{method:edit?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(edit?{name,description,color}:{id,name,description,color})},a.token);
 await must(r,b.action);
 const data=await r.json();if(!data.length)return reply({error:'ไม่พบเกมนี้แล้ว'},404);return reply({game:data[0]});
 }
 if(b.action==='entry.create'||b.action==='entry.update'){
 const edit=b.action==='entry.update';if(edit&&!/^[0-9a-f-]{36}$/i.test(String(b.id)))return reply({error:'รหัสหัวข้อไม่ถูกต้อง'},400);
 const game=String(b.game||''),title=String(b.title||'').trim(),content=String(b.content||'').trim(),topic=String(b.topic||'ทั่วไป').trim();
 if(!/^[A-Za-z0-9_-]{1,48}$/.test(game)||!title||title.length>300||!content||content.length>20000||!topic||topic.length>80)return reply({error:'กรุณาระบุเกม หัวข้อ คำตอบ และหมวดหมู่ให้ครบ'},400);
 const r=await db('game_entries'+(edit?'?id=eq.'+encodeURIComponent(b.id):''),{method:edit?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({game,title,content,summary:content.slice(0,160),category:'คู่มือ',source_category:topic,tags:[topic],published:true,updated_at:new Date().toISOString()})},a.token);
 await must(r,b.action);const rows=await r.json();if(!rows.length)return reply({error:'ไม่พบหัวข้อนี้แล้ว'},404);return reply({entry:rows[0]});
 }
 return reply({error:'ไม่รองรับคำสั่งนี้'},400);
 }catch(e){return fail(e);}
}
