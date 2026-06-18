-- transform-so.sql — สร้าง SO (ใบสั่งขาย) จาก QT ที่ "ปิดการขายได้" ทั้งหมด
-- SO ไม่มีในระบบเก่า = ของสร้างใหม่ → ออกเลขรูปแบบระบบใหม่ SO{YYYY}{MM}-{ลำดับ} (เช่น SO202203-1)
-- dedup ตามเลขออเดอร์เดิม qt.id_doc (กัน revisions ของ QT ใบเดียวกันนับซ้ำ) แต่เลขเอกสารใช้ฟอร์แมตใหม่
-- ผู้ดำเนินการ(telesale)=ขวัญใจ ทั้งหมด · พนักงานขาย/ลูกค้า/บริการ/วันที่ปิด/ยอด มาจาก QT+qt table
-- usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on
create or replace function staging.numz(t text) returns numeric language sql immutable as
$$ select coalesce(nullif(regexp_replace(coalesce(t,''),'[^0-9.\-]','','g'),'')::numeric, 0) $$;

delete from sales_document where company_id = :cid::uuid and doc_type = 'SO' and data ? 'fromQt';   -- idempotent

with won as (                                     -- QT ที่ปิดการขายได้
  select s.code as qt_code, s.title, s.customer_ref as cref,
         s.data->>'customerName' as cname, s.data->>'salesperson' as sp,
         s.data->>'servicesOffered' as svc, s.data->>'items' as items_txt, s.saved_at as qt_saved,
         regexp_replace(coalesce(s.data->>'legacyCode',''),'\D','','g') as qtnum
  from sales_document s
  where s.company_id = :cid::uuid and s.doc_type = 'QT' and s.data->>'outcome' = 'ปิดการขายได้'
),
joined as (                                       -- จับ qt table (id_doc=เลขออเดอร์เดิม, service, date_ends)
  select w.*, q.id_doc, q.service as qt_service, q.date_ends
  from won w left join staging.stg_qt q on ltrim(q.id, '0') = w.qtnum
),
calc as (
  select j.*,
    coalesce(nullif(j.id_doc,''), j.qt_code) as order_key,          -- identity ของดีล (กัน revisions ซ้ำ)
    coalesce((select sum(staging.numz(it->>'price') * coalesce(nullif(staging.numz(it->>'qty'),0),1) - staging.numz(it->>'discount'))
              from jsonb_array_elements(case when coalesce(j.items_txt,'') ~ '^\[' then j.items_txt::jsonb else '[]'::jsonb end) it), 0) as sum_before,
    case when j.date_ends ~ '^[12][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' then j.date_ends::timestamptz end as close_ts
  from joined j
),
dedup as (                                        -- 1 SO ต่อ 1 ออเดอร์ (revision ล่าสุด)
  select distinct on (order_key) c.*, round(sum_before * 1.07, 2) as net,
         coalesce(close_ts, to_timestamp(qt_saved / 1000.0)) as so_ts
  from calc c order by order_key, close_ts desc nulls last
),
base as (                                         -- เลขรันที่มีอยู่แล้วต่อปีเดือน (SO ของแอป ไม่ใช่ที่ย้ายมา)
  select substring(code from 3 for 6) as ym, count(*) as cnt
  from sales_document where company_id = :cid::uuid and doc_type = 'SO' and code ~ '^SO[0-9]{6}-' group by 1
),
numbered as (
  select d.*, to_char(d.so_ts, 'YYYYMM') as ym,
         row_number() over (partition by to_char(d.so_ts, 'YYYYMM') order by d.so_ts, d.qt_code) as rn
  from dedup d
)
insert into sales_document (id, company_id, doc_type, code, title, telesale, phase, customer_ref, src_qt, data, saved_at, created_at, updated_at)
select gen_random_uuid(), :cid::uuid, 'SO',
  'SO' || n.ym || '-' || (coalesce(b.cnt, 0) + n.rn),               -- เลขรูปแบบระบบใหม่
  left(coalesce(n.cname, n.title, '—'), 250),
  'ขวัญใจ จันทร์คง',                              -- ผู้ดำเนินการ = ขวัญใจ (ทั้งหมด)
  'DONE', n.cref, n.qt_code,
  jsonb_strip_nulls(jsonb_build_object(
    'fromQt',        n.qt_code,
    'legacySoCode',  nullif(n.id_doc,''),           -- เลขออเดอร์เดิม (อ้างอิง)
    'customerRef',   n.cref, 'customerName', n.cname, 'customerCode', n.cname,
    'salesperson',   n.sp,                          -- พนักงานขาย (จริงจาก QT)
    'quotationRef',  n.qt_code, 'srcQt', n.qt_code,
    'closedService', coalesce(nullif(n.qt_service,''), n.svc),  -- ปิดบริการอะไร
    'servicesOffered', n.svc,
    'items',         n.items_txt,                   -- ราคา/บริการ (qtNet + ยอดขายรวม ใช้)
    'saleAmount',    case when n.net > 0 then to_char(n.net, 'FM999999990.00') end,   -- ยอดขาย (฿)
    'netAmount',     case when n.net > 0 then to_char(n.net, 'FM999999990.00') end,
    'orderDate',     case when n.close_ts is not null then to_char(n.close_ts, 'YYYY-MM-DD') end,  -- วันที่ปิด
    'closeDate',     case when n.close_ts is not null then to_char(n.close_ts, 'YYYY-MM-DD') end,
    'closeResult',   'won',
    'outcome',       'ยืนยันคำสั่งซื้อแล้ว'
  )),
  (extract(epoch from n.so_ts) * 1000)::bigint, n.so_ts, now()
from numbered n left join base b on b.ym = n.ym;
