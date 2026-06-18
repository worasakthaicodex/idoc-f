-- ตัวนับรหัสพนักงานแยกต่อบริษัท (1 แถว/บริษัท) — ทำให้รหัสเริ่มที่ 1 ทุกบริษัท
create table company_sequence (
    company_id   uuid   primary key references company(id),
    employee_seq bigint not null default 0
);

-- พนักงาน/ผู้ใช้ในบริษัท (tenant-scoped) — code เป็น running number ต่อบริษัท ไม่ใช่ PK
create table employee (
    id         uuid         primary key,
    company_id uuid         not null references company(id),
    code       varchar(20)  not null,
    full_name  varchar(200) not null,
    email      varchar(200),
    position   varchar(120),
    role       varchar(20)  not null,
    status     varchar(20)  not null,
    created_at timestamptz  not null,
    updated_at timestamptz  not null,
    constraint uq_employee_company_code unique (company_id, code),
    constraint uq_employee_company_email unique (company_id, email)
);

create index idx_employee_company on employee (company_id);
