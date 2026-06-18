-- transform-ownership.sql — เติมเจ้าของ/ผู้ถือ/ผู้ร่วม ให้ FO/QT (สำหรับกล่องงาน role=sale)
-- creator=ผู้สร้าง · receiver=ผู้ถือ (สำคัญเฉพาะ current_step=Proceed) · refer_user=ทุกคนที่เคยร่วม
-- Proceed → meta.received(by=receiver)+meta.sent(by=creator) → เข้ากล่อง "ดำเนินการ" ของ receiver
-- ทุก doc → data.createdBy + data.participants(จาก refer_user) → กล่อง "เสร็จสิ้น" ของผู้ร่วมทุกคน
-- usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on

-- id -> ชื่อ: จากคู่ creator/data_nameadd, sender/data_namesend, receiver/data_namereceiver ในตัว idoc
drop table if exists staging.idmap;
create table staging.idmap as
with pairs as (
  select creator id, data_nameadd nm from staging.stg_idoc
  union all select sender, data_namesend from staging.stg_idoc
  union all select receiver, data_namereceiver from staging.stg_idoc
)
select id, mode() within group (order by nm) as name
from pairs where id ~ '^[0-9]+$' and id <> '0' and nm is not null and nm !~ '^[0-9]+$' and btrim(nm) <> ''
group by id;
-- เติม sales id ที่ไม่ปรากฏในคู่ชื่อ (ตาม map: 150/186/187/192 = กัญจน์ชญา)
insert into staging.idmap(id, name)
select v.id, v.name from (values ('150','กัญจน์ชญา ผาคำ'),('186','กัญจน์ชญา ผาคำ'),('187','กัญจน์ชญา ผาคำ'),('192','กัญจน์ชญา ผาคำ')) v(id,name)
where not exists (select 1 from staging.idmap m where m.id = v.id);

with src as (
  select distinct on (i.eform_id)
    i.eform_id, i.current_step, i.refer_user,
    case when staging.nz(i.data_nameadd) ~ '^[0-9.]+$' then null else staging.nz(i.data_nameadd) end as creator_nm,
    case when staging.nz(i.data_namereceiver) ~ '^[0-9.]+$' then null else staging.nz(i.data_namereceiver) end as receiver_nm,
    (extract(epoch from coalesce(staging.dz(i.date), now())) * 1000)::bigint as at_ms
  from staging.stg_idoc i
  where i.document_id in ('110','113') and staging.nz(i.eform_id) is not null and i.eform_id <> '0'
  order by i.eform_id, i.date desc nulls last, i.id desc
),
parts as (
  select s.*,
    (select string_agg(distinct m.name, ',')
       from unnest(string_to_array(s.refer_user, ',')) u(uid)
       join staging.idmap m on m.id = btrim(u.uid)) as participant_names
  from src s
)
update sales_document d
set data = (d.data - 'createdBy' - 'participants') || jsonb_strip_nulls(jsonb_build_object(
             'createdBy',    p.creator_nm,
             'participants', p.participant_names)),
    meta = (coalesce(d.meta, '{}'::jsonb) - 'received' - 'sent') || (
      case when p.current_step = 'Proceed' and p.receiver_nm is not null then jsonb_build_object(
        'received', jsonb_build_object('by', p.receiver_nm, 'at', p.at_ms),
        'sent',     jsonb_build_object('by', coalesce(p.creator_nm, p.receiver_nm), 'to', p.receiver_nm, 'at', p.at_ms, 'recipients', jsonb_build_array(p.receiver_nm))
      ) else '{}'::jsonb end),
    updated_at = now()
from parts p
where d.company_id = :cid::uuid and d.doc_type in ('FO','QT') and d.data->>'legacyId' = p.eform_id;
