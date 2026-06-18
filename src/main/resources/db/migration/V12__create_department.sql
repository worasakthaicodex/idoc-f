-- แผนก (department) — tenant-scoped, code รันต่อบริษัท (DEP-00001), สังกัดฝ่าย (เก็บชื่อฝ่าย)
create table org_department (
    id         uuid         primary key,
    company_id uuid         not null references company(id),
    code       varchar(20)  not null,
    name       varchar(120) not null,
    division   varchar(120),
    created_at timestamptz  not null,
    updated_at timestamptz  not null,
    constraint uq_department_company_code unique (company_id, code),
    constraint uq_department_company_name unique (company_id, name)
);
create index idx_department_company on org_department (company_id);

create table department_sequence (
    company_id     uuid   primary key references company(id),
    department_seq bigint not null default 0
);
