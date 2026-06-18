-- บันทึก Log การ "ดึงรายชื่อลงตะกร้า CL" — ใคร/เมื่อไร/วิธีไหน/กี่ราย (ไว้ตรวจย้อนหลัง)
create table cl_pull_log (
    id          uuid         primary key,
    company_id  uuid         not null,
    cl_code     varchar(40)  not null,
    method      varchar(20)  not null,   -- FILTER (กรองรายชื่อ) | GROUP (เลือกจากกลุ่ม)
    detail      varchar(300),            -- เงื่อนไขที่ใช้ดึง (อ่านง่าย)
    cnt         int          not null,   -- จำนวนที่ดึงได้จริง (ไม่นับที่ซ้ำ)
    pulled_by   varchar(200),
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_cl_pull_log on cl_pull_log (company_id, cl_code, created_at desc);
