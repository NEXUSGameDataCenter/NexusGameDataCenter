import {currentAccess} from '@/lib/auth';
import {reply,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){try{const a=await currentAccess(true,true);return reply({user:a.user,member:a.member,version:'1.5'});}catch(e){return fail(e);}}
