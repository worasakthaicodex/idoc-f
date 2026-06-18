-- ค้นหาลูกค้าแบบ prefix (ส่วนหน้า) ให้เร็วแม้ลูกค้าหลักหมื่น (endpoint /api/customers/lookup)
-- ใช้ text_pattern_ops เพื่อให้ LIKE 'x%' ใช้ btree index ได้โดยไม่ขึ้นกับ collation
-- ค้นบน lower(code)/lower(name) จึง index บนนิพจน์ lower(...) ตรงกับ query
create index if not exists idx_customer_code_prefix
    on customer (company_id, lower(code) text_pattern_ops);
create index if not exists idx_customer_name_prefix
    on customer (company_id, lower(name) text_pattern_ops);
