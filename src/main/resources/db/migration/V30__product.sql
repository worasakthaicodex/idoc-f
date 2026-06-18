-- โมดูลสินค้าและบริการ (Product) — โครงเดียวกับ customer
-- ฟิลด์ส่วนใหญ่ configurable เก็บใน attributes (JSONB) · group_name = หมวดหมู่สินค้า/บริการ
-- เผื่อพ่วง BOM ในอนาคต (product เป็น master ของ BOM)
create table product (
    id          uuid         primary key,
    company_id  uuid         not null,
    code        varchar(30)  not null,          -- PRD{ปีเดือน}-{เลขรัน}
    name        varchar(255) not null,
    status      varchar(40)  not null,
    group_name  varchar(120),                   -- หมวดหมู่
    attributes  jsonb        not null default '{}'::jsonb,
    pending_delete_at timestamptz,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_product_company on product (company_id);
create unique index uq_product_company_code on product (company_id, code);

-- ตัวนับรหัสสินค้า "แยกต่อบริษัท"
create table product_sequence (
    company_id  uuid   primary key,
    product_seq bigint not null default 0
);

-- ลงทะเบียนโมดูล "สินค้าและบริการ"
insert into app_module (id, code, name, name_en, sort_order, active, created_at, updated_at)
values (gen_random_uuid(), 'สินค้าและบริการ', 'สินค้าและบริการ', 'Products & Services', 9, true, now(), now())
on conflict (code) do nothing;
