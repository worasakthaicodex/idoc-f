-- transform-docs.sql — idoc(FO/QT) + edata + doc -> sales_document (header + items)
-- code  = doc-table formatted code, else idoc.reference_oldsys (old code), else synthetic
-- customer = edata header REG code (FO=data_value2, QT=data_value5) — NOT customer_oldsys (bogus default=1)
-- idempotent: wipe previously-migrated FO/QT (tagged legacyId) then reinsert. usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on
create or replace function staging.nz(t text) returns text language sql immutable as
$$ select nullif(nullif(btrim($1), ''), '\N') $$;
create or replace function staging.dz(t text) returns timestamptz language plpgsql immutable as
$$ begin
     if btrim(t) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' then return null; end if;
     return btrim(t)::timestamptz;
   exception when others then return null;
   end $$;

delete from sales_document where company_id = :cid::uuid and doc_type in ('FO','QT')
  and data ? 'legacyId';        -- wipe prior migration (keep genuine app docs without legacyId)

with built as (
select
  gen_random_uuid() as id,
  :cid::uuid as company_id,
  case i.document_id when '110' then 'FO' else 'QT' end as doc_type,
  coalesce(
    nullif(d.doc_type || d.doc_date || '-' || d.doc_autoid                          -- 1) doc-table code {type}{date}-{autoid}
           || case when coalesce(d.doc_rv,'0') ~ '^[0-9]+$' and d.doc_rv::int > 0    --    + -R{rev} เมื่อ revision > 0
                   then '-R' || d.doc_rv else '' end, ''),
    staging.nz(i.reference_oldsys),                                                 -- 2) old code (e.g. FO-998)
    (case i.document_id when '110' then 'FO' else 'QT' end) || '-' || i.eform_id     -- 3) synthetic fallback
  ) as code,
  left(coalesce(staging.nz(c.name), cust.code, '—'), 250) as title,                 -- title = customer name
  sp.name as telesale,                                                              -- telesale/salesperson (mapped from sale_oldsys)
  case i.current_step when 'Completion' then 'DONE' when 'Proceed' then 'PROCESS' else 'RECEIVE' end as phase,
  cust.code as customer_ref,                                                        -- customer_ref = REG code from edata header
  jsonb_strip_nulls(jsonb_build_object(
    'legacyId',       i.eform_id,
    'legacyIdocId',   i.id,
    'legacyCode',     staging.nz(i.reference_oldsys),
    'revNo',          case when coalesce(d.doc_rv,'0') ~ '^[0-9]+$' then (d.doc_rv::int + 1)::text end,  -- workbox โชว์ revNo-1 = doc_rv
    'docRv',          staging.nz(d.doc_rv),
    'customerRef',    cust.code,                                                     -- SalesHistoryPanel filters by this (REG code)
    'customerName',   staging.nz(c.name),                                            -- ชื่อลูกค้า
    'customerCode',   staging.nz(c.name),                                            -- CustomerPicker value (app sets this = name on pick)
    'closeResult',    case when i.closing_status like 'ปิดการขายได้%'   then 'won'    -- ค่าระบบ (FO_OUTCOME): won/lost/cancel/quote
                           when i.closing_status like 'ปิดการขายไม่ได้%' then 'lost'
                           when i.closing_status like 'หมดอายุ%'        then 'lost'
                           when i.closing_status like 'ยกเลิก%'         then 'cancel'
                           when i.closing_status like '%ใบเสนอราคา%' and i.document_id = '110' then 'quote' end,
    'closeStatusRaw', staging.nz(i.closing_status),
    'outcome',        case when i.closing_status like 'ปิดการขายได้%'   then 'ปิดการขายได้'      -- won (รวมยืนยันคำสั่งซื้อ)
                           when i.closing_status like 'ปิดการขายไม่ได้%' then 'ปิดการขายไม่ได้'    -- lost
                           when i.closing_status like 'หมดอายุ%'        then 'หมดอายุ'
                           when i.closing_status like 'ยกเลิก%'         then 'ยกเลิก'
                           when i.closing_status like '%ใบเสนอราคา%'     then 'เปิดใบเสนอราคา'    -- สร้าง/ขอแก้ไข/ขอสร้าง = อยู่ระหว่างเสนอ
                           else null end,
    'servicesOffered',staging.nz(case i.document_id when '113' then h.data_value7 end),
    'grandTotal',     staging.nz(case i.document_id when '113' then h.data_value8 end),
    'saleLegacyId',   staging.nz(i.sale_oldsys),
    'salesperson',    sp.name,
    'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name',  coalesce(staging.nz(li.data_value10), ''), 'code', '', 'serviceType', '',
                 'price', coalesce(staging.nz(li.data_value12), ''), 'discount', coalesce(staging.nz(li.data_value14), ''),
                 'qty',   coalesce(staging.nz(li.data_value15), '1'), 'unit', coalesce(staging.nz(li.data_value16), ''))
               order by li.data_id)
        from staging.stg_edata li where li."tempId" = i.eform_id and li.extension_id = '0'
      )::text, '[]')
  ) || (case i.document_id
    when '110' then jsonb_build_object(                                            -- FO body (v3..v26)
       'servicesWanted',  staging.nz(h.data_value11), 'customerNeed',    staging.nz(h.data_value12),
       'teleUrgency',     staging.nz(h.data_value3),  'teleEngagement',  staging.nz(h.data_value4),
       'teleCompetition', staging.nz(h.data_value5),  'teleContactRole', staging.nz(h.data_value6),
       'teleTraits',      staging.nz(h.data_value7),  'teleNote',        staging.nz(h.data_value8),
       'teleDocStatus',   staging.nz(h.data_value9),  'clRef',           staging.nz(h.data_value10),
       'saleUrgency',     staging.nz(h.data_value13), 'saleEngagement',  staging.nz(h.data_value14),
       'saleCompetition', staging.nz(h.data_value15), 'usageSchedule',   staging.nz(h.data_value16),
       'saleContactRole', staging.nz(h.data_value18), 'planPresented',   staging.nz(h.data_value19),
       'saleDocStatus',   staging.nz(h.data_value20), 'winProbability',  staging.nz(h.data_value21),
       'closingMethod',   staging.nz(h.data_value22), 'expectedPrice',   staging.nz(h.data_value23),
       'suggestedPrice',  staging.nz(h.data_value24), 'competitorPrice', staging.nz(h.data_value25))
    else jsonb_build_object(                                                       -- QT body
       'paymentTerms', coalesce(staging.nz(h.data_value17), staging.nz(h.data_value29)),
       'qtNote',       staging.nz(h.data_value24))
  end)) as data,
  (extract(epoch from coalesce(staging.dz(i.date), now())) * 1000)::bigint as saved_at,
  coalesce(staging.dz(i.date), now()) as created_at,
  now() as updated_at
from (
  select distinct on (eform_id) *
  from staging.stg_idoc
  where document_id in ('110','113') and staging.nz(eform_id) is not null and eform_id <> '0'
  order by eform_id, date desc nulls last, id desc
) i
left join staging.stg_edata h on h.data_id = i.eform_id                             -- header content
-- รหัสจริงรูปแบบใหม่จากตาราง doc: doc_idrefer = idoc.EFORM_ID (ไม่ใช่ id) → {type}{doc_date}-{autoid} เช่น QT202606-187
left join lateral (
  select dd.doc_type, dd.doc_date, dd.doc_autoid, dd.doc_rv
  from staging.stg_doc dd
  where dd.doc_idrefer = i.eform_id and dd.doc_type in ('FO','QT')
  order by dd.doc_rv desc nulls last, dd.doc_id::int desc limit 1
) d on true
-- customer code from the edata header (FO=v2, QT=v5)
cross join lateral (select case i.document_id when '110' then staging.nz(h.data_value2)
                                              else staging.nz(h.data_value5) end as code) cust
-- salesperson: map sale_oldsys id -> employee name (114/115/116 known · others -> กัญจน์ชญา · 0/ว่าง -> ไม่มี)
cross join lateral (select case when staging.nz(i.sale_oldsys) is null or i.sale_oldsys = '0' then null
                                when i.sale_oldsys = '114' then 'ขวัญใจ จันทร์คง'
                                when i.sale_oldsys = '115' then 'กุลจิรา เกิดภักดี'
                                when i.sale_oldsys = '116' then 'นวลอนงค์ หล่อเจริญธรรม'
                                else 'กัญจน์ชญา ผาคำ' end as name) sp
left join customer c on c.company_id = :cid::uuid and c.code = cust.code
)
insert into sales_document (id, company_id, doc_type, code, title, telesale, phase,
                            customer_ref, data, saved_at, created_at, updated_at)
select distinct on (code) id, company_id, doc_type, code, title, telesale, phase,
       customer_ref, data, saved_at, created_at, updated_at
from built
where customer_ref is not null and btrim(customer_ref) <> ''   -- ข้ามใบที่ไม่มีลูกค้า (edata header ว่าง = เปิดผิด)
order by code, saved_at desc                       -- revisions ใช้ doc code เดียวกัน → เก็บใบล่าสุด
on conflict (company_id, doc_type, code) do update set
  title = excluded.title, telesale = excluded.telesale, phase = excluded.phase,
  customer_ref = excluded.customer_ref, data = excluded.data,
  saved_at = excluded.saved_at, updated_at = now();
