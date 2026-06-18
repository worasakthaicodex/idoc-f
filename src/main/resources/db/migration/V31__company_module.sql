-- ทะเบียนโมดูลที่บริษัทเปิด/ซื้อไว้ (ราย-บริษัท) — ใช้รู้ว่าโมดูลที่ต้องพึ่งพร้อมใช้ไหม
create table company_module (
    id          uuid primary key,
    company_id  uuid not null,
    module_code varchar(60) not null,
    active      boolean not null default true,
    expires_at  date,
    created_at  timestamptz not null,
    updated_at  timestamptz not null,
    constraint uq_company_module unique (company_id, module_code)
);
create index idx_company_module_company on company_module (company_id);

-- seed: เปิดทุกโมดูลที่ active ให้ทุกบริษัทที่มีอยู่ (ปรับลด/ตั้งวันหมดอายุภายหลังได้)
insert into company_module (id, company_id, module_code, active, created_at, updated_at)
select gen_random_uuid(), c.id, m.code, true, now(), now()
from company c
cross join app_module m
where m.active = true;
