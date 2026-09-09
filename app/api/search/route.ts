import {type Entry} from '@/lib/game-data';
import {requireAccess} from '@/lib/auth';
import {db,must,reply,fail,jsonBody,sameOrigin} from '@/lib/server';
export const dynamic='force-dynamic';
export async function POST(req:Request) {
 try {
 sameOrigin(req);const access=await requireAccess();const body=await jsonBody(req,4000);
 const q=typeof body.q==='string'?body.q.trim():'';
 if(q.length>500) return reply({error:'กรุณาใช้คำค้นไม่เกิน 500 ตัวอักษร'},400);
 const game=typeof body.game==='string'&&/^[A-Za-z0-9_-]{1,48}$/.test(body.game)?body.game:'all';
 const page=Number.isInteger(body.page)&&body.page>0&&body.page<=10000?body.page:1;
 const pageSize=[24,48,96].includes(body.pageSize)?body.pageSize:24;
 let total=0;
 const category=typeof body.category==='string'&&body.category.length<=80?body.category:'all';
 const connected=true,ai=false,terms=q?[q]:[];let entries:Entry[];
  const url=new URL('/rest/v1/game_entries',process.env.SUPABASE_URL!);
  url.searchParams.set('select','id,game,category,title,summary,content,tags,source_url,updated_at,source_file,source_id,source_row,source_category,topic');url.searchParams.set('published','eq.true');url.searchParams.set('order',body.sort==='title'?'title.asc,id.asc':'updated_at.desc,id.asc');url.searchParams.set('limit',String(pageSize));url.searchParams.set('offset',String((page-1)*pageSize));
  if(game!=='all')url.searchParams.set('game','eq.'+game);
  if(category!=='all')url.searchParams.set('topic','eq.'+category);
  const safe=terms.map(t=>t.replace(/[^\p{L}\p{N}\s_-]/gu,'').trim()).filter(Boolean);
  if(q&&!safe.length) return reply({entries:[],total:0,page,pageSize,terms:[],connected,ai,answer:'ไม่พบคำค้นที่ใช้ได้',warning:''});
  if(safe.length)url.searchParams.set('or','('+safe.flatMap(t=>['title','summary','content','source_id','source_category'].map(f=>`${f}.ilike.*${t}*`)).join(',')+')');
  const r=await must(await db('game_entries'+url.search,{headers:{Prefer:'count=exact'}},access.token),'search');
  entries=await r.json() as Entry[];
 const count=r.headers.get('content-range')?.split('/')[1];if(!count||!/^\d+$/.test(count))throw Error('อ่านจำนวนผลลัพธ์ไม่สำเร็จ กรุณาลองใหม่');total=Number(count);
 return reply({entries,total,page,pageSize,terms,connected,ai,answer:'',warning:'',sources:[]});
 }catch(e){return fail(e);}
}
