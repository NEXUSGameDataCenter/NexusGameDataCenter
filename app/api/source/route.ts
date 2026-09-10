import {requireAccess} from '@/lib/auth';
import {sameOrigin,jsonBody,reply,fail,db,must,AppError} from '@/lib/server';
import {fetchSource,extractArticle,suggestTopic} from '@/lib/source-reader';
import {getGame,duplicatePreview} from '@/lib/import-data';
import {validateRow,safeSource} from '@/lib/transfer';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:Request){try{sameOrigin(req);const a=await requireAccess('editor'),b=await jsonBody(req,50000);await getGame(String(b.game||''),a.token);
 if(b.action==='fetch'){if(typeof b.url!=='string'||b.url.length>2000)throw new AppError('กรุณาระบุ URL',400);const source=await fetchSource(b.url),article=extractArticle(source.html);const cat=await(await must(await db('rpc/nexus_catalog',{method:'POST',body:'{}'},a.token),'topics.read')).json();const topics=[...new Set<string>((cat.topics||[]).map((t:{topic:string})=>t.topic))];await requireAccess('editor');return reply({...article,source_url:source.url,topic:suggestTopic(article.title+' '+article.content,topics),fetched_at:new Date().toISOString()});}
 const row=validateRow(b.row);row.source_url=safeSource(row.source_url);if(!row.source_url)throw new AppError('กรุณาแนบลิงก์ต้นทาง',400);
 if(b.action==='preview')return reply(await duplicatePreview(b.game,a.token,[row]));
 if(b.action!=='submit'||b.confirmed!==true)throw new AppError('กรุณายืนยันการส่งร่าง',400);
 const r=await must(await db('rpc/nexus_enqueue',{method:'POST',body:JSON.stringify({p_game:b.game,p_rows:[row],p_kind:'url',p_source:row.source_url})},a.token),'drafts.source');return reply(await r.json());}catch(e){return fail(e);}}
