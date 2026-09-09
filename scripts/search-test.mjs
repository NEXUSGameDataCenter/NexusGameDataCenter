import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-search-'));
try{
 const source=await fs.readFile(new URL('../lib/search-engine.ts',import.meta.url),'utf8');await fs.writeFile(path.join(tmp,'engine.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {rankEntries,normalize}=await import(pathToFileURL(path.join(tmp,'engine.mjs')));
 const row=(id,title,content='',topic='ทั่วไป')=>({id,title,content,summary:'',game:'TOSM',topic,tags:[],category:'คู่มือ',source_url:null,updated_at:'2026-09-09'});
 // Regression examples reflect headings/wording verified in the existing FAQ corpus.
 const data=[row('payment','เติมเงินแล้วเงินไม่เข้า ต้องทำยังไง','รอให้ระบบประมวลผลประมาณ 5–10 นาที','Payment'),row('password','ลืมรหัสผ่าน','กดลืมรหัสผ่านที่หน้า Login','Account'),row('account','ถูกระงับบัญชีแต่คิดว่าไม่ได้ทำผิด ต้องติดต่อใคร','ติดต่อทีมงาน Support'),row('card','ตีบวกการ์ดต้องทำยังไง','ใช้ชิ้นส่วนการ์ดในการอัปเกรด'),row('english','Download client installer','Install the game'),row('answer','ช่องทางช่วยเหลือ','หากต้องการเติมเงินให้ตรวจสอบรายการก่อน'),row('noise','บอทช่วยอะไรได้บ้าง','ตอบเรื่องบัญชี การเติมเงิน และปัญหาการเล่นเกม'),row('faq','ข้อมูลบัญชี','')];data.at(-1).source_id='faq_to_006';
 for(const q of ['เติมเงิน','เติม','เงินไม่เข้า','เติมเงิน ไม่เข้า','ไม่เข้า เติมเงิน','อยากทราบเรื่องเติมเงินหน่อยครับ'])assert.equal(rankEntries(data,q)[0]?.id,'payment',q);
 for(const q of ['รหัสผ่าน','ลืมรหัส','password'])assert.equal(rankEntries(data,q)[0]?.id,'password',q);
 assert.equal(rankEntries(data,'บัญชี')[0].id,'account');assert.equal(rankEntries(data,'การ์ด')[0].id,'card');assert.equal(rankEntries(data,'ดาวน์โหลด')[0].id,'english');assert.equal(rankEntries(data,'DOWNLoAD')[0].id,'english');assert.equal(rankEntries(data,'downlaod')[0].id,'english');assert.equal(rankEntries(data,'บัญชิ')[0].id,'account');
 assert.ok(rankEntries(data,'เติมเงิน').some(e=>e.id==='answer'&&e.match_label==='พบคำค้นในคำตอบ'));
 assert.equal(rankEntries(data,'faq_to_006')[0].id,'faq');assert.equal(rankEntries(data,'zzqxwvv').length,0);assert.equal(rankEntries(data,'(),%*').length,0);
 assert.equal(normalize('เปลี่ยนรหัสผ่าน'),normalize('เปลี่ยนรหัสผ่าน'.normalize('NFD')));
 assert.ok(normalize('บัญชี').includes('ั'));assert.ok(normalize('เปลี่ยน').includes('่'));
 const many=Array.from({length:1361},(_,i)=>row(String(i),'หัวข้อทั่วไป '+i));many[1360]=row('last','เติมเงินทดสอบหน้าท้ายสุด');assert.equal(rankEntries(many,'เติมเงิน')[0].id,'last');
 const start=performance.now();for(let i=0;i<5;i++)rankEntries(many,'เติมเงิน');console.log('PASS Thai marks, partial/multiple/reordered words, Thai+English aliases, typos, body matches, FAQ IDs, no-match, 1,361-row scan ('+Math.round((performance.now()-start)/5)+' ms average)');
}finally{await fs.rm(tmp,{recursive:true,force:true});}
