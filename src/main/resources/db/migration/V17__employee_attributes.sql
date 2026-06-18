-- ฟิลด์ configurable (ไม่มีคอลัมน์ตายตัว) เก็บเป็น JSONB — เปิดฟิลด์ใหม่ได้โดยไม่ต้อง migration
alter table employee add column attributes jsonb not null default '{}'::jsonb;
