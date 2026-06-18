-- ไฟล์แนบ (metadata เท่านั้น — ไฟล์จริงอยู่ object storage)
create table attachment (
    id           uuid         primary key,
    company_id   uuid         not null references company(id),
    owner_type   varchar(40)  not null,
    owner_id     varchar(64)  not null,
    filename     varchar(255) not null,
    content_type varchar(120),
    size_bytes   bigint       not null default 0,
    storage_key  varchar(500) not null,
    status       varchar(20)  not null,
    uploaded_by  varchar(120),
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null
);

create index idx_attachment_owner on attachment (company_id, owner_type, owner_id);
