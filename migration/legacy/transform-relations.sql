-- transform-relations.sql — เติม src_fo ให้ QT จากตาราง relations (สายเอกสาร)
-- relations: main_id = เอกสารที่แตกออกมา, relations_id = ต้นทาง/พ่อ · join ด้วย idoc.eform_id (= data.legacyId)
-- QT(113).main ↔ FO(110).relations  → QT.src_fo = FO.code (2,824 edges). usage: -v cid="'<uuid>'"
-- หมายเหตุ: FO.src_cl (FO↔CL 112) ข้ามไปก่อน เพราะ CL ไม่ได้ migrate มาเป็นเอกสาร
\set ON_ERROR_STOP on

with edges as (                                   -- คู่ QT→FO จาก relations (ผ่าน eform_id)
  select r.main_id as qt_e, r.relations_id as fo_e
  from staging.stg_rel r
  join staging.stg_idoc mi on mi.eform_id = r.main_id        and mi.document_id = '113'
  join staging.stg_idoc ri on ri.eform_id = r.relations_id   and ri.document_id = '110'
),
mapped as (                                       -- จับคู่กับเอกสารจริง · QT หลายเส้น → เลือก FO ใหม่สุด
  select distinct on (qt.id) qt.id as qt_id, fo.code as fo_code
  from edges e
  join sales_document qt on qt.company_id = :cid::uuid and qt.doc_type = 'QT' and qt.data->>'legacyId' = e.qt_e
  join sales_document fo on fo.company_id = :cid::uuid and fo.doc_type = 'FO' and fo.data->>'legacyId' = e.fo_e
  order by qt.id, fo.saved_at desc nulls last
)
update sales_document s
set data   = jsonb_set(s.data, '{srcFo}', to_jsonb(m.fo_code)),   -- UI อ่าน values.srcFo
    src_fo = m.fo_code,
    updated_at = now()
from mapped m
where s.id = m.qt_id;
