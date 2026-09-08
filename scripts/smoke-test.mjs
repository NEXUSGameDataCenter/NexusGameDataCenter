import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
// Exercise the real route in-process; no API keys, network or database writes.
const data=await fs.readFile(new URL('../lib/game-data.ts',import.meta.url),'utf8');
const source=(await fs.readFile(new URL('../app/api/search/route.ts',import.meta.url),'utf8')).replace(/import \{demo, type Entry\} from '@\/lib\/game-data';/,'');
const compiled=ts.transpileModule(data+'\n'+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const saved={...process.env};const nativeFetch=globalThis.fetch;
const post=b=>POST(new Request('http://test.local/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}));
try{
 process.env.SUPABASE_URL='';process.env.SUPABASE_PUBLISHABLE_KEY='';process.env.OPENAI_API_KEY='';
 let r=await post({game:'TOSM',q:''});assert.equal(r.status,200);let d=await r.json();assert.equal(d.connected,false);assert.equal(d.entries.length,3);assert.ok(d.entries.every(x=>x.game==='TOSM'));
 assert.equal((await post({q:'x'.repeat(501)})).status,400);assert.equal((await post(null)).status,400);assert.equal((await POST(new Request('http://test.local',{method:'POST',body:'bad JSON'}))).status,400);
 console.log('PASS: demo, filters, malformed input and query length');
 process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='test-publishable';
 let called=false;
 globalThis.fetch=async (input,options)=>{called=true;const u=new URL(input);assert.equal(u.pathname,'/rest/v1/game_entries');assert.equal(u.searchParams.get('published'),'eq.true');assert.equal(u.searchParams.get('game'),'eq.TOSM');assert.match(u.searchParams.get('or'),/EXE ID/);assert.match(u.searchParams.get('select'),/source_file/);assert.equal(options.headers.apikey,'test-publishable');return Response.json([{id:'test',game:'TOSM',category:'คู่มือ',title:'EXE ID',content:'ตัวอย่างคำตอบ',tags:[],source_id:'faq_test',source_file:'test.csv'}]);};
 r=await post({game:'TOSM',q:'EXE ID',ai:true});d=await r.json();assert.ok(called);assert.equal(r.status,200);assert.equal(d.connected,true);assert.equal(d.ai,false);assert.equal(d.entries[0].source_id,'faq_test');assert.match(d.answer,/Supabase/);
 console.log('PASS: Supabase query, published-only filter, provenance, AI-not-configured fallback');
 globalThis.fetch=async()=>new Response('Error',{status:500});assert.equal((await post({q:'test'})).status,502);
 console.log('PASS: upstream database error');
}finally{globalThis.fetch=nativeFetch;for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','OPENAI_API_KEY']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
