-- โมดูลลูกค้า (CRM) — ตารางลูกค้า + ตัวนับรหัสรันต่อบริษัท
-- ฟิลด์ส่วนใหญ่ configurable เก็บใน attributes (JSONB) ไม่ต้อง migration เพิ่มทีหลัง
create table customer (
    id          uuid         primary key,
    company_id  uuid         not null,
    code        varchar(30)  not null,          -- REG{ปีเดือน}-{เลขรัน}
    name        varchar(255) not null,
    status      varchar(20)  not null,
    group_name  varchar(120),
    attributes  jsonb        not null default '{}'::jsonb,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_customer_company on customer (company_id);
create unique index uq_customer_company_code on customer (company_id, code);

-- ตัวนับรหัสลูกค้า "แยกต่อบริษัท"
create table customer_sequence (
    company_id   uuid   primary key,
    customer_seq bigint not null default 0
);
