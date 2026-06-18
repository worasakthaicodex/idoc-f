-- เปิด/ปิด การเข้าสู่ระบบด้วย Gmail (Google) รายคน
alter table employee add column google_enabled boolean not null default false;
