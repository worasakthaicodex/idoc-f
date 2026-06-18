-- Company = บริษัทที่มาเช่าใช้ (tenant) — ตารางระดับแพลตฟอร์ม (ไม่ scope ตาม tenant)
create table company (
    id            uuid         primary key,
    code          varchar(40)  not null unique,
    name          varchar(200) not null,
    status        varchar(20)  not null,
    plan          varchar(20)  not null,
    contact_email varchar(200),
    expires_at    date,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);

create index idx_company_status on company (status);
