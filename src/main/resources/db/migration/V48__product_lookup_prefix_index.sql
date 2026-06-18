-- ค้นหาสินค้า/บริการแบบ prefix (ส่วนหน้า) ให้เร็วแม้สินค้าหลักพัน/หมื่น (endpoint /api/products/lookup)
-- text_pattern_ops เพื่อให้ LIKE 'x%' ใช้ btree index ได้โดยไม่ขึ้นกับ collation · ค้นบน lower(code)/lower(name)
create index if not exists idx_product_code_prefix
    on product (company_id, lower(code) text_pattern_ops);
create index if not exists idx_product_name_prefix
    on product (company_id, lower(name) text_pattern_ops);
