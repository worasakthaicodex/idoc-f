-- เวลาที่ลูกค้าถูกตั้งสถานะ PENDING_DELETE — ใช้คำนวณ purge อัตโนมัติเมื่อครบ 1 ปี
alter table customer add column pending_delete_at timestamptz;

-- backfill ของเดิมที่เป็น PENDING_DELETE อยู่แล้ว (ใช้ updated_at เป็นจุดเริ่มนับ)
update customer set pending_delete_at = updated_at where status = 'PENDING_DELETE';
