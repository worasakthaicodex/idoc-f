-- แชร์ตะกร้าให้ผู้ใช้คนอื่น (shared_with = รหัสพนักงาน) เห็นได้
create table basket_share (
    id          uuid        primary key,
    basket_id   uuid        not null references basket(id) on delete cascade,
    shared_with varchar(80) not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index uq_basket_share on basket_share (basket_id, shared_with);
create index idx_basket_share_user on basket_share (shared_with);
