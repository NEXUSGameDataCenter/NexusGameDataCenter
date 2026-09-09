import {db,reply,fail,must,sameOrigin,jsonBody,supabase} from '@/lib/server';
import {requireAccess} from '@/lib/auth';
export const runtime='nodejs';
export async function POST(req:Request){
 try{sameOrigin(req);const a=await requireAccess('editor');const b=await jsonBody(req);
 if(b.action==='entry.delete'){
 const id=String(b.id||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||b.confirm!==true)return reply({error:'กรุณายืนยันหัวข้อที่จะลบ'},400);
 const r=await must(await db('game_entries?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=representation'}},a.token),'entry.delete');const rows=await r.json();if(!rows.length)return reply({error:'ไม่พบหัวข้อนี้ อาจถูกลบไปแล้ว'},404);return reply({ok:true,game:rows[0].game});
 }
 if(b.action==='game.delete'){
 const id=String(b.id||''),confirm=String(b.confirmName||'');if(!/^[A-Za-z0-9_-]{1,48}$/.test(id)||!confirm||confirm.length>80)return reply({error:'กรุณาพิมพ์ชื่อเกมเพื่อยืนยัน'},400);
 const r=await db('rpc/nexus_delete_game',{method:'POST',body:JSON.stringify({p_id:id,p_confirm:confirm,p_delete_entries:b.deleteEntries===true})},a.token);
 if(!r.ok){const err=await r.clone().json().catch(()=>({}));if(err.code==='23503')return reply({error:'เกมนี้ยังมีหัวข้อ กรุณายืนยันการลบหัวข้อทั้งหมดด้วย'},409);if(err.code==='22023')return reply({error:'ชื่อเกมที่ยืนยันไม่ตรง กรุณาโหลดรายการล่าสุด'},409);if(err.code==='P0002')return reply({error:'ไม่พบเกมนี้ อาจถูกลบไปแล้ว'},404);if(err.code==='PGRST202')return reply({error:'กรุณารัน supabase/upgrade-v1.4.sql ก่อนใช้งานการลบเกม'},503);await must(r,'game.delete');}
 const result=await r.json();let warning='';if(result.image_path){try{const cleanup=await supabase('/storage/v1/object/game-images',{method:'DELETE',body:JSON.stringify({prefixes:[result.image_path]})},a.token);if(!cleanup.ok)warning='ลบเกมแล้ว แต่ล้างไฟล์รูปเดิมไม่สำเร็จ ผู้ดูแลสามารถลบไฟล์ค้างใน Storage ได้';}catch{warning='ลบเกมแล้ว แต่ล้างไฟล์รูปเดิมไม่สำเร็จ';}}
 return reply({ok:true,deleted_entries:result.deleted_entries,warning});
 }
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
 const catalog=await(await must(await db('rpc/nexus_catalog',{method:'POST',body:'{}'},a.token),'topics.read')).json();const allowed=new Set((catalog.topics||[]).map((t:{topic:string})=>t.topic));if(!allowed.size)allowed.add('ทั่วไป');if(!allowed.has(topic))return reply({error:'กรุณาเลือกหมวดหมู่ที่มีอยู่แล้ว หรือรีเฟรชรายการหมวดหมู่'},400);
 const r=await db('game_entries'+(edit?'?id=eq.'+encodeURIComponent(b.id):''),{method:edit?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({game,title,content,summary:content.slice(0,160),category:'คู่มือ',source_category:topic,tags:[topic],published:true,updated_at:new Date().toISOString()})},a.token);
 await must(r,b.action);const rows=await r.json();if(!rows.length)return reply({error:'ไม่พบหัวข้อนี้แล้ว'},404);return reply({entry:rows[0]});
 }
 return reply({error:'ไม่รองรับคำสั่งนี้'},400);
 }catch(e){return fail(e);}
}
