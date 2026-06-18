-- transform-qtitems.sql — เติม line items ให้ QT ที่ยังไม่มี items (จาก qt_description, revision ล่าสุด)
-- join: เลข QT = ltrim(right(qt_id,6),'0') = regexp(reference_oldsys) · usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on
create or replace function staging.nz(t text) returns text language sql immutable as
$$ select nullif(nullif(btrim($1), ''), '\N') $$;

with latest as (                                          -- revision ล่าสุดต่อ qt_id เท่านั้น
  select qt_id, max(revision::int) maxrev
  from staging.stg_qtdesc where revision ~ '^[0-9]+$'
  group by qt_id
),
agg as (                                                  -- รวม line items ต่อเลข QT
  select ltrim(right(q.qt_id, 6), '0') as qtnum,
         jsonb_agg(jsonb_build_object(
           'name',     coalesce(staging.nz(q.qt_description), ''), 'code', '',
           'serviceType', '',
           'price',    coalesce(staging.nz(q.qt_price), ''),
           'discount', coalesce(staging.nz(q.qt_discount), ''),
           'qty',      coalesce(staging.nz(q.qt_unit), '1'),
           'unit',     coalesce(staging.nz(q.qt_type), ''))
           order by q.id::int)::text as items_json
  from staging.stg_qtdesc q
  join latest l on l.qt_id = q.qt_id and q.revision::int = l.maxrev
  where staging.nz(q.qt_description) is not null          -- ข้ามบรรทัดว่าง
  group by ltrim(right(q.qt_id, 6), '0')
)
update sales_document s
set data = jsonb_set(s.data, '{items}', to_jsonb(agg.items_json)), updated_at = now()
from agg
where s.company_id = :cid::uuid and s.doc_type = 'QT'
  and coalesce(s.data->>'items', '[]') = '[]'                              -- เฉพาะ QT ที่ยังไม่มี items
  and agg.qtnum <> ''
  and regexp_replace(coalesce(s.data->>'legacyCode', ''), '\D', '', 'g') = agg.qtnum;
