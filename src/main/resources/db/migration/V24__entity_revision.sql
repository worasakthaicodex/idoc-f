-- ประวัติ/เวอร์ชันของข้อมูล (generic) — เก็บ snapshot เต็มไว้ย้อนกลับได้
create table entity_revision (
    id          uuid         primary key,
    company_id  uuid         not null,
    entity_type varchar(40)  not null,
    entity_id   uuid         not null,
    entity_code varchar(60),
    revno       int          not null,
    action      varchar(20)  not null,   -- CREATE | UPDATE | REVERT
    changed_by  varchar(200),
    snapshot    jsonb        not null default '{}'::jsonb,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_revision_entity on entity_revision (company_id, entity_type, entity_id, revno desc);
