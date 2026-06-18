-- ขยายสถานะลูกค้าเป็นโค้ดหลายตัว — แปลงค่าเก่า (ถ้ามี) ให้เข้ากับ enum ใหม่
update customer set status = 'NO_INTEREST' where status = 'INACTIVE';
