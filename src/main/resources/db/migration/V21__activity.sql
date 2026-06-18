-- เครื่องมือเอกสารใช้ร่วม (activity) — ตารางเดียวเก็บทุกเครื่องมือ (kind + payload jsonb)
-- เชื่อมเอกสารแบบ string (subject/parent/customer) ไม่มี FK ข้ามโมดูล
create table activity (
    id            uuid         primary key,
    company_id    uuid         not null,
    kind          varchar(40)  not null,
    subject_type  varchar(40),
    subject_code  varchar(60),
    parent_type   varchar(40),
    parent_code   varchar(60),
    customer_code varchar(60),
    occurred_at   timestamptz  not null,
    created_by    varchar(200),
    payload       jsonb        not null default '{}'::jsonb,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);

-- ดึงตามเอกสาร (panel) และตามลูกค้า (รายงานข้ามเครื่องมือ)
create index idx_activity_subject  on activity (company_id, subject_type, subject_code, kind, occurred_at desc);
create index idx_activity_customer on activity (company_id, customer_code, kind, occurred_at desc);
