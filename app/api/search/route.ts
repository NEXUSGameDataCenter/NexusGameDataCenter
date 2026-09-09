import type {Entry} from '@/lib/game-data';
import {requireAccess} from '@/lib/auth';
import {db,must,reply,fail,jsonBody,sameOrigin,AppError} from '@/lib/server';
import {rankEntries} from '@/lib/search-engine';
export const dynamic='force-dynamic';
const fields='id,game,category,title,summary,content,tags,source_url,updated_at,source_file,source_id,source_row,source_category,topic';
export async function POST(req:Request){try{
 sameOrigin(req);const access=await requireAccess();const body=await jsonBody(req,5000);
 const q=typeof body.q==='string'?body.q.trim():'';if(q.length>500)throw new AppError('กรุณาใช้คำค้นไม่เกิน 500 ตัวอักษร',400);
 const game=typeof body.game==='string'&&/^[A-Za-z0-9_-]{1,48}$/.test(body.game)?body.game:'all';
 const category=typeof body.category==='string'&&body.category.length<=80?body.category:'all';
 const page=Number.isInteger(body.page)&&body.page>0&&body.page<=10000?body.page:1;
 const pageSize=[24,48,96].includes(body.pageSize)?body.pageSize:24,suggest=body.suggest===true;
 const params=new URLSearchParams({select:fields,published:'eq.true',order:!q&&body.sort==='title'?'title.asc,id.asc':'updated_at.desc,id.asc'});
 if(game!=='all')params.set('game','eq.'+game);if(category!=='all')params.set('topic','eq.'+category);
 async function batch(offset:number,limit:number){if(req.signal.aborted)throw new AppError('ยกเลิกคำขอแล้ว',499);params.set('offset',String(offset));params.set('limit',String(limit));const r=await must(await db('game_entries?'+params.toString(),{headers:{Prefer:'count=exact'}},access.token),'search');const count=r.headers.get('content-range')?.split('/')[1];if(!count||!/^\d+$/.test(count))throw new AppError('อ่านจำนวนผลลัพธ์ไม่สำเร็จ กรุณาลองใหม่',502);return {entries:await r.json() as Entry[],total:Number(count)};}
 if(!q){if(suggest)return reply({entries:[],total:0,page:1,pageSize:6});const result=await batch((page-1)*pageSize,pageSize);return reply({...result,page,pageSize,connected:true,ai:false,terms:[],sources:[]});}
 if(!/[\p{L}\p{N}]/u.test(q))return reply({entries:[],total:0,page,pageSize,connected:true,ai:false,terms:[]});
 // Read every permitted row in batches; rank before slicing, never only the first 60/1000.
 // Deliberately no cross-user cache: every scan uses this member's JWT and existing RLS.
 const corpus:Entry[]=[];let offset=0;for(;;){const b=await batch(offset,500);corpus.push(...b.entries);offset+=b.entries.length;if(offset>=b.total)break;if(!b.entries.length)throw new AppError('ข้อมูลเปลี่ยนระหว่างค้นหา กรุณาลองใหม่',409);}
 const ranked=rankEntries([...new Map(corpus.map(e=>[e.id,e])).values()],q,suggest?'relevance':body.sort||'relevance');
 // Recheck live approval before returning a potentially long scan.
 await requireAccess();const size=suggest?6:pageSize,start=suggest?0:(page-1)*size;
 return reply({entries:ranked.slice(start,start+size),total:ranked.length,page:suggest?1:page,pageSize:size,connected:true,ai:false,terms:[q],sources:[],related:ranked.filter(r=>r.match_kind==='related').length});
 }catch(e){return fail(e);}}
