-- ฝ่าย (division) — tenant-scoped, code รันต่อบริษัท (DIV-00001)
create table org_division (
    id         uuid         primary key,
    company_id uuid         not null references company(id),
    code       varchar(20)  not null,
    name       varchar(120) not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null,
    constraint uq_division_company_code unique (company_id, code),
    constraint uq_division_company_name unique (company_id, name)
);
create index idx_division_company on org_division (company_id);

create table division_sequence (
    company_id   uuid   primary key references company(id),
    division_seq bigint not null default 0
);
