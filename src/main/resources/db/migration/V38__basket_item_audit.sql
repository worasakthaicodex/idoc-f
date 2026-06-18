-- basket_item สืบทอด BaseEntity (ต้องมี created_at/updated_at) — เติมให้ครบ
alter table basket_item
    add column created_at timestamptz not null default now(),
    add column updated_at timestamptz not null default now();
