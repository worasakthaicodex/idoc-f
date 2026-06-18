-- ทะเบียนโมดูลของระบบ (global — ไม่ผูก tenant) · ค่อย ๆ เพิ่มได้ 10-30 ตัว
create table app_module (
    id         uuid         primary key,
    code       varchar(60)  not null unique,   -- ใช้เป็นค่าใน position.modules (ตั้ง = ชื่อไทยเดิมเพื่อ compat)
    name       varchar(120) not null,
    name_en    varchar(120),
    sort_order int          not null default 0,
    active     boolean      not null default true,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);

-- seed 6 โมดูลเดิม (code = ชื่อไทย ให้ตรงกับข้อมูลตำแหน่งที่มีอยู่)
insert into app_module (id, code, name, name_en, sort_order, active, created_at, updated_at) values
 (gen_random_uuid(), 'งานขาย',      'งานขาย',      'Sales',      1, true, now(), now()),
 (gen_random_uuid(), 'คลังสินค้า',   'คลังสินค้า',   'Inventory',  2, true, now(), now()),
 (gen_random_uuid(), 'จัดซื้อ',      'จัดซื้อ',      'Purchasing', 3, true, now(), now()),
 (gen_random_uuid(), 'บัญชีการเงิน', 'บัญชีการเงิน', 'Accounting', 4, true, now(), now()),
 (gen_random_uuid(), 'บุคคล',       'บุคคล',       'HR',         5, true, now(), now()),
 (gen_random_uuid(), 'รายงาน',      'รายงาน',      'Reports',    6, true, now(), now());
