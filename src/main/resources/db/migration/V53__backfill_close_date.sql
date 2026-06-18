-- Backfill วันที่ปิด (data.closeDate) จาก saved_at สำหรับเอกสารที่ปิดแล้ว (phase=DONE)
-- ที่ยังไม่มี closeDate — ข้อมูลที่ย้าย/seed เข้ามาตรงๆ ลงวันที่ไว้แค่ saved_at
-- closeDate กับ saved_at เป็นวันเดียวกัน · รูปแบบ YYYY-MM-DD (เวลาไทย) ให้ตรงกับที่ฟอร์มปิดการขายเขียน
update sales_document
set data = jsonb_set(
        data,
        '{closeDate}',
        to_jsonb(to_char(to_timestamp(saved_at / 1000) at time zone 'Asia/Bangkok', 'YYYY-MM-DD'))
    )
where phase = 'DONE'
  and saved_at is not null
  and coalesce(data ->> 'closeDate', '') = '';
