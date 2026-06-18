-- transform-qt-srcfo.sql — เติม QT.src_fo จากตาราง qt (คอลัมน์ id_fo) ตรงๆ
-- ใช้เฉพาะ QT ที่ relations หา FO ไม่เจอ (data.srcFo ยังว่าง)
-- map: QT เลข = ltrim(qt.id,'0') = digits(QT.legacyCode); FO เลข = ltrim(right(qt.id_fo,6),'0') = digits(FO.legacyCode)
-- เช่น qt.id=002110, id_fo=2205003934 → FO-3934. usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on

with src as (                                     -- เลข QT -> เลข FO จากตาราง qt + qt2 (รวมใบที่หลงเหลือ)
  -- FO ref = id_fo ถ้าไม่ใช่ 0 ไม่งั้นใช้ id_refer (ตัวเดียวกัน) · เลข FO = 6 หลักท้าย strip 0
  select ltrim(u.id, '0') as qtnum,
         ltrim(right(case when ltrim(coalesce(u.id_fo,''),'0') <> '' then u.id_fo
                          else coalesce(u.id_refer,'') end, 6), '0') as fonum
  from (select id, id_fo, id_refer from staging.stg_qt
        union all select id, id_fo, id_refer from staging.stg_qt2) u
  where ltrim(right(case when ltrim(coalesce(u.id_fo,''),'0') <> '' then u.id_fo
                         else coalesce(u.id_refer,'') end, 6), '0') <> ''
),
mapped as (                                       -- จับคู่กับเอกสารจริง (FO ต้องมีอยู่)
  select distinct on (qt.id) qt.id as qt_id, fo.code as fo_code
  from src s
  join sales_document qt on qt.company_id = :cid::uuid and qt.doc_type = 'QT'
       and regexp_replace(coalesce(qt.data->>'legacyCode',''),'\D','','g') = s.qtnum
       and coalesce(qt.data->>'srcFo','') = ''          -- เฉพาะที่ relations ยังไม่ได้เติม
  join sales_document fo on fo.company_id = :cid::uuid and fo.doc_type = 'FO'
       and regexp_replace(coalesce(fo.data->>'legacyCode',''),'\D','','g') = s.fonum
  order by qt.id, fo.saved_at desc nulls last
)
update sales_document s
set data   = jsonb_set(s.data, '{srcFo}', to_jsonb(m.fo_code)),
    src_fo = m.fo_code,
    updated_at = now()
from mapped m
where s.id = m.qt_id;
