-- ตั้งค่าขั้นตอนวงจรชีวิตเอกสาร (stages) — 1 แถวต่อ (บริษัท + ประเภทเอกสาร) เก็บเป็น JSONB
create table workflow_stage_config (
    id         uuid        primary key,
    company_id uuid        not null,
    doc_type   varchar(40) not null,
    stages     jsonb       not null default '[]'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
);
create unique index uq_wf_stage_company_doctype on workflow_stage_config (company_id, doc_type);
