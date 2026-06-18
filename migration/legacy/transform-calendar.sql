-- transform-calendar.sql — ปฏิทิน/นัดหมายระบบเก่า (calendar) -> calendar_event
-- index_id = register.id -> customer.code (attributes.legacyId) · eform_id = edata.data_id -> sales_document (FO/QT)
-- by_name = ชื่อพนักงานเต็ม -> created_by (เตือนตรงคน: registerCalendarNotifs กรอง createdBy === session.fullName)
-- id แบบ deterministic จาก legacy id -> idempotent (ON CONFLICT). usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on
create or replace function staging.nz(t text) returns text language sql immutable as
$$ select nullif(nullif(btrim($1), ''), '\N') $$;
create or replace function staging.dz(t text) returns timestamptz language plpgsql immutable as
$$ begin
     if btrim(t) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' then return null; end if;
     return btrim(t)::timestamptz;
   exception when others then return null;
   end $$;

insert into calendar_event (id, company_id, activity_date, remind_date, priority, status, confirmed,
                            title, customer_ref, ref_type, ref_code, module, created_by, note, created_at, updated_at)
select
  ('ca1e0000-0000-0000-0000-' || lpad(c.id, 12, '0'))::uuid,
  :cid::uuid,
  make_date(c.year::int, c.month::int, c.day::int),                       -- activity_date (year/month/day)
  make_date(c.year::int, c.month::int, c.day::int),                       -- remind_date = วันเดียวกัน
  'NORMAL',
  case when c.status = '1' then 'DONE' else 'PENDING' end,                -- status 1=เสร็จ / 0=ค้าง
  (c.status = '1'),                                                       -- confirmed
  left(coalesce(staging.nz(c.event), 'นัดหมาย'), 255),                    -- title
  cu.code,                                                                -- customer_ref (จาก index_id=register.id)
  d.doc_type,                                                             -- ref_type (FO/QT)
  d.code,                                                                 -- ref_code (จาก eform_id=edata.data_id)
  'sales',
  staging.nz(c.by_name),                                                  -- created_by = ชื่อพนักงานเต็ม (เตือนตรงคน)
  nullif(btrim(coalesce(staging.nz(c.start_time), '') ||
               case when staging.nz(c.end_time) is not null then '-' || c.end_time else '' end), ''),  -- note = ช่วงเวลา
  coalesce(staging.dz(c.created_at), now()),
  now()
from staging.stg_calendar c
left join customer cu on cu.company_id = :cid::uuid and cu.attributes->>'legacyId' = c.index_id
left join lateral (
  select s.doc_type, s.code from sales_document s
  where s.company_id = :cid::uuid and s.data->>'legacyId' = c.eform_id limit 1
) d on true
on conflict (id) do update set
  activity_date = excluded.activity_date, remind_date = excluded.remind_date, status = excluded.status,
  confirmed = excluded.confirmed, title = excluded.title, customer_ref = excluded.customer_ref,
  ref_type = excluded.ref_type, ref_code = excluded.ref_code, created_by = excluded.created_by,
  note = excluded.note, updated_at = now();
