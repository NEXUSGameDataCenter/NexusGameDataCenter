# NEXUS — TOSM & Zone4 | Vercel edition

เว็บศูนย์ข้อมูลเกมภาษาไทย สร้างด้วย Next.js App Router สำหรับ deploy บน Vercel โดยตรง

## ข้อมูลที่พร้อมแล้ว
- Supabase project: Nexus Game Data Center (`esggoqvrwjdzszahzxlp`)
- ตาราง `public.game_entries` มี FAQ TOSM 360 รายการที่นำเข้าไว้แล้ว ไม่ต้องนำเข้า CSV ซ้ำ
- อ่านเฉพาะแถว `published = true` ด้วย publishable key; ไม่ใช้ service_role
- Zone4 พร้อมรองรับข้อมูล แต่ยังไม่มีข้อมูลนำเข้า
- ค้นหาด้วยคำสำคัญ เปิดรายละเอียด และแสดงชื่อไฟล์/รหัส FAQ/แถวต้นทาง
- AI ช่วยแปลงคำถามเป็นคำค้นและสรุปจาก 6 รายการที่พบ พร้อมหมายเลขอ้างอิง เมื่อใส่ OpenAI API key

## ขึ้น Vercel ผ่าน GitHub
1. แตก ZIP นี้ แล้วนำไฟล์ทั้งหมดในโฟลเดอร์ `nexus-vercel` ขึ้น GitHub repository ของคุณ (ให้ `package.json` อยู่ที่ราก repository)
2. ใน Vercel เลือก Add New → Project แล้ว Import repository
3. Framework Preset: **Next.js** / Node.js: **22.x** / Root Directory: โฟลเดอร์ที่มี `package.json`
4. ใช้ค่าจาก `vercel.json`: Install Command `npm ci`, Build Command `npm run build`; Output Directory ปล่อยค่าเริ่มต้น
5. เพิ่ม Environment Variables ตามตารางด้านล่าง แล้วกด Deploy
6. หลังแก้ Environment Variables ต้อง Redeploy เพื่อให้มีผล

| ชื่อ | ค่า | จำเป็น |
|---|---|---|
| `SUPABASE_URL` | `https://esggoqvrwjdzszahzxlp.supabase.co` | สำหรับข้อมูลจริง |
| `SUPABASE_PUBLISHABLE_KEY` | คัดลอก Publishable key ของโปรเจกต์จาก Supabase → Settings → API Keys | สำหรับข้อมูลจริง |
| `OPENAI_API_KEY` | API key จากบัญชี OpenAI API ของคุณ | สำหรับ AI |
| `OPENAI_MODEL` | `gpt-4o-mini` หรือโมเดลที่รองรับ Chat Completions และ `temperature`/`max_tokens` | ไม่บังคับ |

ไฟล์ `.env.example` มีชื่อค่าครบแล้ว ไม่มี API key จริงแนบใน ZIP และห้ามเปลี่ยนชื่อ key เป็น `NEXT_PUBLIC_` เพราะใช้ฝั่งเซิร์ฟเวอร์เท่านั้น

**ก่อนใส่ OpenAI key ให้เปิด Deployment Protection ของ Vercel สำหรับผู้ที่คุณอนุญาต** แอปชุดนี้ไม่มีระบบสมาชิกหรือ rate limit ถ้าจะเปิดสาธารณะ ควรเพิ่มการยืนยันตัวตน/จำกัดการเรียก AI ก่อน เพื่อควบคุมค่าใช้จ่าย API การค้นหา AI ส่งคำถามและเนื้อหาที่ค้นพบไปยัง OpenAI

หากยังไม่ใส่ OpenAI key การค้นหาด้วยคำสำคัญจาก Supabase ยังใช้ได้ หากยังไม่ใส่ Supabase key จะแสดงโหมดตัวอย่างชัดเจน

## ทดลองในเครื่อง
ติดตั้ง Node.js 22 แล้วเปิด Terminal ในโฟลเดอร์โปรเจกต์:

```bash
npm ci
```

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ key ของคุณ จากนั้น:

```bash
npm run dev
```

เปิด http://localhost:3000

ตรวจสอบ production:

```bash
npm run build
npm test
npm start
```

`npm test` ทดสอบโค้ด API route จริงด้วย Supabase จำลอง โดยไม่เปิดเซิร์ฟเวอร์ ไม่ใช้ API key จริง และไม่แก้ข้อมูลในฐานข้อมูล

## ตรวจสอบหลัง Deploy
- สถานะด้านบนต้องเป็น “เชื่อมต่อ Supabase แล้ว”
- เลือก TOSM แล้วค้น “EXE ID” หรือ “สมัครไอดี”
- เปิดคำตอบเพื่อตรวจชื่อไฟล์และรหัส FAQ
- เมื่อใส่ OpenAI key ทดลองพิมพ์คำถามแล้วกดค้นหาด้วย AI
- ตัวเว็บแสดงสูงสุด 60 ผลลัพธ์ต่อการค้นหา ให้ใช้คำค้น/ตัวกรองเพื่อเจาะจงข้อมูล

## ฐานข้อมูล
ใช้โปรเจกต์เดิมได้ทันทีโดยตั้ง URL และ key เท่านั้น **ไม่ต้องรัน SQL อีกครั้ง**
`supabase/schema.sql` เป็นโครงสร้างอ้างอิงสำหรับโปรเจกต์ใหม่ ไม่ได้รวมข้อมูล FAQ หรือข้อมูลลับ ใช้เพื่อเตรียมฐานข้อมูลใหม่เท่านั้น

ระบบค้นหาปัจจุบันเป็น keyword retrieval + AI query expansion ยังไม่ใช่ vector/embedding search ข้อมูลจาก FAQ อาจมีวันหมดอายุกิจกรรมหรือเงื่อนไขที่เปลี่ยนแปลง คำตอบแสดงตามข้อมูลที่นำเข้า

## การตรวจสอบแพ็กเกจ
Production build, TypeScript และ API route smoke test ผ่านด้วย dependencies ที่มีอยู่ในสภาพแวดล้อมจัดทำ การเปิด production server ทดสอบในสภาพแวดล้อมนี้ติดข้อจำกัด network interfaces จึงยังไม่ได้ทดสอบเว็บผ่านเบราว์เซอร์ ไม่ได้ deploy เข้าบัญชี Vercel หรือเรียก AI จริง การติดตั้ง dependencies ใหม่แบบ `npm ci` ต้องทำบนเครื่อง/ระบบที่เข้าถึง npm registry ได้

## เอกสารอ้างอิง
- https://nextjs.org/docs/app/getting-started/deploying
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/getting-started/api-keys
