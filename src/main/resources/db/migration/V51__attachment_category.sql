-- ชนิดไฟล์ (category) + เอกสารต้นทางที่ไฟล์มาจาก (source_ref เช่น QT202606-1) สำหรับไฟล์แนบ
alter table attachment add column category   varchar(80);
alter table attachment add column source_ref varchar(40);
