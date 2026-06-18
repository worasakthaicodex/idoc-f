-- รองรับการเข้าสู่ระบบด้วยอีเมล: เก็บรหัสผ่าน (bcrypt) ของผู้ใช้ที่ login ได้
alter table employee add column password_hash varchar(100);

-- อีเมลสำหรับ login ต้องไม่ซ้ำ "ทั้งระบบ" (เพราะ login ด้วยอีเมลล้วน ไม่เลือกบริษัท)
create unique index uq_employee_login_email on employee (email) where password_hash is not null;
