-- บันทึก "ลูกค้าถูกนำไปใช้ในชุด CL ที่ทำจนจบ (DONE)" — ไว้อ้างอิงว่าเคยใช้กี่รอบ
-- 1 แถวต่อ (ลูกค้า, ชุด CL) เพื่อกันนับซ้ำในชุดเดียว
create table customer_use_log (
    id            uuid         primary key,
    company_id    uuid         not null,
    customer_code varchar(60)  not null,
    cl_code       varchar(40)  not null,
    used_at       timestamptz  not null,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
create unique index uq_customer_use on customer_use_log (company_id, cl_code, customer_code);
create index idx_customer_use_cust on customer_use_log (company_id, customer_code);
