-- ตะกร้ารายชื่อลูกค้า — ของผู้ใช้แต่ละคน (owner = employeeCode) เก็บลูกค้าที่จะทำงานต่อ
create table basket (
    id          uuid         primary key,
    company_id  uuid         not null,
    owner       varchar(80)  not null,          -- รหัสพนักงาน (ผู้ใช้)
    name        varchar(120) not null,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_basket_company_owner on basket (company_id, owner);

create table basket_item (
    id           uuid        primary key,
    basket_id    uuid        not null references basket(id) on delete cascade,
    customer_ref varchar(60) not null,          -- รหัสลูกค้า
    added_at     timestamptz not null
);
create unique index uq_basket_item on basket_item (basket_id, customer_ref);
create index idx_basket_item_basket on basket_item (basket_id);
