-- เร่ง aggregate "วันติดต่อล่าสุดต่อลูกค้า" (GROUP BY company_id, kind, customer_code)
-- ใช้กับ /api/activities/contact-summary — ให้เร็วแม้ activity มีจำนวนมาก
create index if not exists idx_activity_contact
    on activity (company_id, kind, customer_code, occurred_at);
