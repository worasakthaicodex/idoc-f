-- ตำแหน่งงาน: เพิ่มรหัส (running ต่อบริษัท), คำอธิบาย, แผนก, ฝ่าย
alter table job_position add column code        varchar(20);
alter table job_position add column description text;
alter table job_position add column department  varchar(120);
alter table job_position add column division    varchar(120);

-- backfill รหัสให้ของเดิม: POS-00001, POS-00002, ... แยกต่อบริษัท
with seq as (
    select id, row_number() over (partition by company_id order by created_at, name) AS rn
    from job_position
)
update job_position p
set code = 'POS-' || lpad(seq.rn::text, 5, '0')
from seq
where seq.id = p.id;

alter table job_position alter column code set not null;
create unique index uq_position_company_code on job_position (company_id, code);

-- ตัวนับรหัสตำแหน่งต่อบริษัท (seed จากจำนวนที่มีอยู่)
create table position_sequence (
    company_id   uuid   primary key references company(id),
    position_seq bigint not null default 0
);
insert into position_sequence (company_id, position_seq)
select company_id, count(*) from job_position group by company_id;
