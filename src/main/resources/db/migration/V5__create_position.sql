-- ตำแหน่งงาน (tenant-scoped) — ผูกสิทธิ์ "เข้าโมดูลไหนได้บ้าง" ไว้ที่ตำแหน่ง
create table job_position (
    id         uuid         primary key,
    company_id uuid         not null references company(id),
    name       varchar(120) not null,
    modules    varchar(500) not null default '',   -- รายชื่อโมดูล คั่นด้วย comma
    created_at timestamptz  not null,
    updated_at timestamptz  not null,
    constraint uq_position_company_name unique (company_id, name)
);

create index idx_position_company on job_position (company_id);
