import {db,reply,fail,must} from '@/lib/server';
import {requireAccess} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(){try{const a=await requireAccess();const r=await must(await db('rpc/nexus_catalog',{method:'POST',body:'{}'},a.token),'catalog');return reply({...await r.json(),connected:true,ai:false,adminReady:a.member.role!=='viewer'});}catch(e){return fail(e);}}
