-- เจ้าของระบบ (platform owner) — แยกจาก employee (ผู้ใช้ในบริษัท) อย่างชัดเจน
-- ตารางระดับแพลตฟอร์ม ไม่ผูก tenant (ไม่มี company_id); เข้าสู่ระบบด้วย Google เท่านั้น
create table platform_account (
    id             uuid         primary key,
    email          varchar(200) not null unique,
    full_name      varchar(200) not null,
    status         varchar(20)  not null,
    google_enabled boolean      not null default true,
    created_at     timestamptz  not null,
    updated_at     timestamptz  not null
);

-- seed เจ้าของระบบคนแรก: worasakyourself@gmail.com (login ผ่าน Gmail)
insert into platform_account (id, email, full_name, status, google_enabled, created_at, updated_at)
values ('ef16c8f8-5f8d-4e15-94c6-769073d5653f', 'worasakyourself@gmail.com',
        'Worasak (เจ้าของระบบ)', 'ACTIVE', true, now(), now());
