-- รองรับ analytics "ตามงานขาย" (ตัวนับต่อปี + เช็คลูกค้ามี/ไม่มีเอกสาร) ให้ใช้ index
-- ครอบ: count(distinct customer_ref) per doc_type/year, และ EXISTS(customer_ref, doc_type)
create index if not exists idx_sales_doc_cust on sales_document (company_id, doc_type, customer_ref, created_at);
