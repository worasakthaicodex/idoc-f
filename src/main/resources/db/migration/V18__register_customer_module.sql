-- ลงทะเบียนโมดูล "ลูกค้า" (CRM) ในทะเบียนโมดูลของระบบ
-- code = ชื่อไทย (ใช้เป็นค่าใน position.modules ให้เข้ากับระบบสิทธิ์ที่มีอยู่)
insert into app_module (id, code, name, name_en, sort_order, active, created_at, updated_at)
values (gen_random_uuid(), 'ลูกค้า', 'ลูกค้า', 'Customers', 8, true, now(), now())
on conflict (code) do nothing;
