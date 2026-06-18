-- เอกสารงานขาย (CL/FO/QT/SO) — เก็บข้อมูลหลัก + อ้างอิงสายต้นทาง (customer / CL / FO / QT)
-- ค่าฟิลด์ทั้งหมดเก็บใน data (JSONB) · meta = received/bounce/sent
-- คอลัมน์อ้างอิง (customer_ref/src_*) แยกไว้ให้ระบบอื่น query/เชื่อมสายเอกสารได้
create table sales_document (
    id           uuid         primary key,
    company_id   uuid         not null,
    doc_type     varchar(4)   not null,         -- CL / FO / QT / SO
    code         varchar(30)  not null,         -- {DOC}{ปีเดือน}-{เลขรัน}
    title        varchar(255),
    telesale     varchar(255),
    phase        varchar(20)  not null,         -- RECEIVE / PROCESS / EXPORT / DONE
    stage_id     varchar(64),
    customer_ref varchar(60),                   -- รหัสลูกค้า (REG)
    src_cl       varchar(30),                   -- CL ปลายทาง
    src_fo       varchar(30),                   -- FO ปลายทาง
    src_qt       varchar(30),                   -- QT ปลายทาง
    data         jsonb        not null default '{}'::jsonb,  -- ค่าฟิลด์ทั้งหมด (values)
    meta         jsonb        not null default '{}'::jsonb,  -- received / bounce / sent
    saved_at     bigint,
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null
);
create index idx_sales_doc_company_type on sales_document (company_id, doc_type);
create unique index uq_sales_doc_company_type_code on sales_document (company_id, doc_type, code);
