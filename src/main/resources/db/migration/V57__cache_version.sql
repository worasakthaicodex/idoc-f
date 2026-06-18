-- เลขเวอร์ชันของ cache สรุป/รายงานลูกค้า ต่อบริษัท (shared ข้าม instance)
-- ทุก instance อ่าน version เดียวกันจากตารางนี้ → ใส่ใน key ของ cache ในหน่วยความจำ
-- write ที่กระทบยอด (ลูกค้า/ตะกร้า/เอกสารขาย/กิจกรรม/ปฏิทิน) จะ version+1 ในทรานแซกชันเดียวกัน
-- → commit แล้วทุก instance เห็นเลขใหม่ คำนวณใหม่รอบเดียว (ไม่ต้อง Redis/NOTIFY)
create table cache_version (
    company_id uuid   primary key,
    version    bigint not null default 0
);
