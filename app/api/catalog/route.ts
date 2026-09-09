import {configured,adminReady,db,reply} from '@/lib/server';
import {demo} from '@/lib/game-data';
export const dynamic='force-dynamic';
export async function GET(){try{
 if(!configured())return reply({games:[...new Set(demo.map(e=>e.game))].map(id=>({id,name:id,description:'ข้อมูลตัวอย่าง',color:'teal',count:demo.filter(e=>e.game===id).length})),topics:[],total:demo.length,connected:false,ai:false,adminReady:false});
 const r=await db('rpc/nexus_catalog',{method:'POST',body:'{}'});if(!r.ok)throw Error('โหลดรายชื่อเกมไม่ได้ กรุณาตรวจสอบการเชื่อมต่อและติดตั้งฐานข้อมูลเวอร์ชัน 2');
 return reply({...await r.json(),connected:true,ai:!!process.env.OPENAI_API_KEY,adminReady:adminReady()});
 }catch(e){return reply({error:(e as Error).message},502);}}
