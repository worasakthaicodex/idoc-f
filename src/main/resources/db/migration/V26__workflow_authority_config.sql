-- เอกสารสิทธิ์ (authorities/กรอบ) ของวงจรชีวิตเอกสาร — 1 แถวต่อ (บริษัท + ประเภทเอกสาร)
create table workflow_authority_config (
    id          uuid        primary key,
    company_id  uuid        not null,
    doc_type    varchar(40) not null,
    authorities jsonb       not null default '[]'::jsonb,
    created_at  timestamptz not null,
    updated_at  timestamptz not null
);
create unique index uq_wf_auth_company_doctype on workflow_authority_config (company_id, doc_type);
