-- transform-stages.sql — เซ็ต stage_id (ขั้นใน stepper) ให้ FO/QT/SO ตาม current_step เดิม
-- stage_id ว่าง → ฟอร์มตกที่ st-head ("จัดทำ"). ที่ถูก: Proceed→st-exec("ดำเนินการ"), Completion→st-done("เสร็จสิ้น")
-- รันหลัง transform-docs (docs DELETE+reinsert ทำให้ stage_id กลับเป็น null). usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on

-- FO/QT จาก idoc.current_step (ผ่าน eform_id = data.legacyId)
update sales_document s
set stage_id = m.sid, updated_at = now()
from (
  select distinct on (eform_id) eform_id,
    case current_step when 'Completion' then 'st-done' when 'Proceed' then 'st-exec' else 'st-head' end as sid
  from staging.stg_idoc where document_id in ('110','113')
  order by eform_id, date desc nulls last, id desc
) m
where s.company_id = :cid::uuid and s.doc_type in ('FO','QT') and s.data->>'legacyId' = m.eform_id;

-- SO ที่สร้างจาก QT ปิดได้ = จบแล้ว → เสร็จสิ้น
update sales_document set stage_id = 'st-done', updated_at = now()
where company_id = :cid::uuid and doc_type = 'SO' and data ? 'fromQt';
