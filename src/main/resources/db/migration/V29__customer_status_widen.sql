-- ขยายคอลัมน์ status ให้พอกับชื่อ enum ยาวสุด (INFORMATION_INCOMPLETE = 22 ตัวอักษร)
-- เดิม varchar(20) ทำให้บันทึกบางสถานะไม่ได้ (value too long)
alter table customer alter column status type varchar(40);
