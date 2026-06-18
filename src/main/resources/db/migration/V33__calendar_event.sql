-- ปฏิทินกิจกรรม (Calendar) — โมดูลกลาง ใช้ได้ทุกโมดูล · tenant-scoped (company_id)
-- อ้างอิงเอกสาร/ลูกค้าแบบ generic (ref_type + ref_code, customer_ref) เพื่อเชื่อมข้ามโมดูล
create table calendar_event (
    id            uuid         primary key,
    company_id    uuid         not null,
    activity_date date         not null,        -- วันที่กิจกรรม
    remind_date   date,                          -- วันที่เตือนล่วงหน้า
    priority      varchar(20)  not null default 'NORMAL', -- LOW / NORMAL / HIGH (HIGH = ต้องยืนยันว่าทำแล้ว)
    status        varchar(20)  not null default 'PENDING',-- PENDING / DONE / OVERDUE
    confirmed     boolean      not null default false,    -- ยืนยันว่าทำแล้ว (สำหรับ HIGH)
    title         varchar(255) not null,         -- กิจกรรมอะไร
    customer_ref  varchar(60),                   -- รหัสลูกค้า (ถ้ามี)
    ref_type      varchar(20),                   -- เอกสารอ้างอิง: CL / FO / QT / SO / ...
    ref_code      varchar(40),                   -- รหัสเอกสารอ้างอิง
    module        varchar(40),                   -- โมดูลต้นทาง (sales / crm / ...)
    created_by    varchar(255),                  -- ผู้บันทึก
    note          text,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
create index idx_calendar_company_date on calendar_event (company_id, activity_date);
create index idx_calendar_company_customer on calendar_event (company_id, customer_ref);
create index idx_calendar_company_ref on calendar_event (company_id, ref_type, ref_code);
