-- บันทึกผลการโทรของรายชื่อในชุด CL (worklist) — 1 แถวต่อ 1 ครั้งที่โทร
-- result = รหัสผลการโทร: INTERESTED / CALLBACK / NOANSWER / REJECTED / TO_FO
create table cl_call_log (
    id            uuid         primary key,
    company_id    uuid         not null,
    cl_code       varchar(40)  not null,
    customer_code varchar(60)  not null,
    result        varchar(40)  not null,
    minutes       int,
    note          text,
    called_by     varchar(160),
    called_at     timestamptz  not null,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
create index idx_cl_call_lookup on cl_call_log (company_id, cl_code, customer_code, called_at desc);
