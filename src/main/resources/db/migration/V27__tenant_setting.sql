-- ค่าตั้งค่าต่อบริษัทแบบ key-value (ย้าย config จาก localStorage ขึ้น DB)
create table tenant_setting (
    id         uuid         primary key,
    company_id uuid         not null,
    skey       varchar(120) not null,
    value      jsonb        not null default 'null'::jsonb,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);
create unique index uq_tenant_setting on tenant_setting (company_id, skey);
