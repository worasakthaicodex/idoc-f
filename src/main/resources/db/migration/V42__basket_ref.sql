-- ผูกตะกร้ากับเอกสาร (เช่น CL) — ตะกร้า "ซื้อจริง" ที่ซ่อนจากผู้ใช้ (ref_type=CL, ref_code=<รหัส CL>)
-- ตะกร้า wishlist ทั่วไป (ref_type = null) ยังแสดงใน /customer/basket เหมือนเดิม
alter table basket add column ref_type varchar(20);
alter table basket add column ref_code varchar(40);
create index if not exists idx_basket_ref on basket (company_id, ref_type, ref_code);
