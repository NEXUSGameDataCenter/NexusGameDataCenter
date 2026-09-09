import type {Entry} from './game-data';
// Unicode marks are significant in Thai. NEVER strip \p{M} from searchable text.
export const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('th').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/gu,' ').trim();
const segmenter=new Intl.Segmenter('th',{granularity:'word'});
const stop=new Set(['เรื่อง','เกี่ยวกับ','ที่','ได้','ไหม','ยังไง','อย่างไร','ต้อง','ทำ','การ','ของ','กับ','และ','หรือ','อยาก','ทราบ','ขอ','หน่อย','ครับ','ค่ะ','คะ','จะ','มี','ให้','เป็น','ใน','แล้ว','นี้','the','a','an','how','to','do','i','is','are','can','please']);
// Small editable vocabulary, not generated answers or unrestricted semantic inference.
const aliases=[['เติมเงิน','topup','top up','recharge','payment'],['รหัสผ่าน','password','พาสเวิร์ด'],['เข้าสู่ระบบ','เข้าเกม','ล็อกอิน','ล็อคอิน','login','log in','sign in'],['บัญชี','ไอดี','account'],['ดาวน์โหลด','download'],['ติดตั้ง','install','installation'],['เซิร์ฟเวอร์','เซิฟเวอร์','server'],['แลค','กระตุก','lag'],['เควส','quest'],['อีเมล','อีเมล์','email','e-mail'],['การ์ด','card'],['เพื่อน','friend']].map(g=>g.map(normalize));
function words(value:string){return Array.from(segmenter.segment(value)).filter(p=>p.isWordLike).map(p=>p.segment);}
function queryTerms(q:string){const chunks=q.match(/[\p{L}\p{M}\p{N}_-]+/gu)||[];const terms=chunks.flatMap(c=>/\p{Script=Thai}/u.test(c)?words(c):[c]).filter(t=>!stop.has(t)&&/[\p{L}\p{N}]/u.test(t));return [...new Set(terms)].slice(0,24);}
// Bounded optimal-string-alignment distance also tolerates transposed letters.
function distance(a:string,b:string,max:number){const x=Array.from(a),y=Array.from(b);if(Math.abs(x.length-y.length)>max)return max+1;let before:number[]=[],prev=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const row=[i];for(let j=1;j<=y.length;j++){row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1])row[j]=Math.min(row[j],before[j-2]+1);}if(Math.min(...row)>max)return max+1;before=prev;prev=row;}return prev[y.length];}
function closeWord(a:string,b:string){const len=Array.from(a).length;if(len<4||len>40||/\d/.test(a)||/\p{Script=Thai}/u.test(a)!==/\p{Script=Thai}/u.test(b))return false;return distance(a,b,len>=8?2:1)<=(len>=8?2:1);}
export type MatchKind='exact'|'keywords'|'related';
export type SearchHit=Entry&{match_kind:MatchKind;match_label:string};
export function rankEntries(entries:Entry[],query:string,sort='relevance'):SearchHit[]{
 const q=normalize(query);if(!/[\p{L}\p{N}]/u.test(q))return [];
 const hasLiteral=entries.some(e=>normalize([e.title,e.summary,e.content,e.source_id,e.source_category,e.topic,...(e.tags||[])].filter(Boolean).join(' ')).includes(q));
 const terms=!hasLiteral&&!/\s/u.test(q)&&Array.from(q).length<=12?[q]:queryTerms(q);
 const groups=aliases.filter(g=>g.some(a=>q.includes(a)||(!hasLiteral&&terms.some(t=>closeWord(t,a)))));
 const results=entries.map(entry=>{
  const title=normalize(entry.title||''),content=normalize((entry.summary||'')+' '+(entry.content||'')),meta=normalize([entry.source_id,entry.source_category,entry.topic,...(entry.tags||[])].filter(Boolean).join(' '));
  const full=title+' '+content+' '+meta;const exactTitle=title.includes(q),exactBody=content.includes(q),exactMeta=meta.includes(q);
  let hits=0,titleHits=0;for(const t of terms){if(full.includes(t))hits++;if(title.includes(t))titleHits++;}
  const coverage=terms.length?hits/terms.length:0;
  const documentWords=words(title+' '+meta); // typo matching titles/labels avoids noise from long answers
  const synonymTitle=groups.filter(g=>g.some(a=>title.includes(a))).length;
  const synonymAny=groups.filter(g=>g.some(a=>full.includes(a))).length;
  let fuzzy=0;if(!hasLiteral&&!groups.length&&!exactTitle&&!exactBody&&!exactMeta&&coverage<1){for(const term of terms.length?terms:[q])if(!full.includes(term)&&documentWords.some(w=>closeWord(term,w)))fuzzy++;}
  const exact=exactTitle||exactBody||exactMeta;
  const strongKeywords=terms.length>0&&coverage===1;
  const related=(!hasLiteral&&terms.length>=3&&coverage>=0.6&&titleHits>0)||synonymAny>0||(fuzzy>0&&(hits+fuzzy)/Math.max(1,terms.length)>=0.6);
  if(!exact&&!strongKeywords&&!related)return null;
  // Exact title/FAQ beats body-only; complete keyword coverage beats a single generic term.
  const score=(title===q?2000:exactTitle?1200:0)+(normalize(entry.source_id||'')===q?2200:exactMeta?170:0)+(exactBody?350:0)+(strongKeywords?250:0)+coverage*100+titleHits*55+synonymTitle*65+synonymAny*10+fuzzy*8;
  const match_kind:MatchKind=exact?'exact':strongKeywords?'keywords':'related';
  return {entry:{...entry,match_kind,match_label:match_kind==='exact'?(exactTitle?'พบคำค้นในหัวข้อ':exactBody?'พบคำค้นในคำตอบ':'พบคำค้นในรหัสหรือหมวดหมู่'):match_kind==='keywords'?'พบคำสำคัญที่ค้นหา':'หัวข้อใกล้เคียง'},score};
 }).filter((x):x is NonNullable<typeof x>=>x!==null);
 results.sort((a,b)=>{if(sort==='title')return a.entry.title.localeCompare(b.entry.title,'th')||a.entry.id.localeCompare(b.entry.id);if(sort==='newest')return (b.entry.updated_at||'').localeCompare(a.entry.updated_at||'')||a.entry.id.localeCompare(b.entry.id);return b.score-a.score||(b.entry.updated_at||'').localeCompare(a.entry.updated_at||'')||a.entry.id.localeCompare(b.entry.id);});
 return results.map(r=>r.entry);
}
