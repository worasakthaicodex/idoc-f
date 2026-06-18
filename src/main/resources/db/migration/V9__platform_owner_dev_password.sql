-- DEV เท่านั้น: ให้เจ้าของระบบ login ด้วยรหัสผ่านในเครื่องได้ (Gmail ยังไม่ได้ต่อจริง)
-- ของจริง (production) ควรบังคับ Google → ตั้ง password_hash = null / ลบ migration นี้ออก
alter table platform_account add column password_hash varchar(100);

-- รหัสผ่าน dev: Owner@1234  (bcrypt)
update platform_account
set password_hash = '$2b$10$8V0wI1MTioXwtICyVUH8P.jaSchAPnWbRkPOYQQlG2ldRfzK5rpWK'
where email = 'worasakyourself@gmail.com';
