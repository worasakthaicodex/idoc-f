-- เก็บค่าที่มาจาก FO (บริการ/ความต้องการ/%ปิด/กลยุทธ/สถานะ/ความเร่งด่วน/ลักษณะ/ราคาที่ควรเสนอ) "ลงในตัว QT" เลย
-- กล่องงานจะอ่านจากตัวเอกสารตรง ๆ ไม่ต้อง join FO ตอนโหลด (เดิมต้องไปดึง FO มาทุกรอบ → ช้า/ข้อมูลไม่ขึ้น)
-- หน้า detail จะอัปเดตค่าพวกนี้ใหม่เมื่อเปิด · ทำเฉพาะงานที่ยัง active (DONE ใช้ค่าของตัวเองอยู่แล้ว)
update sales_document qt
set data = qt.data || jsonb_strip_nulls(jsonb_build_object(
        'servicesWanted', fo.data ->> 'servicesWanted',
        'customerNeed',   fo.data ->> 'customerNeed',
        'winProbability', fo.data ->> 'winProbability',
        'closingMethod',  fo.data ->> 'closingMethod',
        'saleDocStatus',  fo.data ->> 'saleDocStatus',
        'teleDocStatus',  fo.data ->> 'teleDocStatus',
        'saleUrgency',    fo.data ->> 'saleUrgency',
        'teleUrgency',    fo.data ->> 'teleUrgency',
        'saleTraits',     fo.data ->> 'saleTraits',
        'teleTraits',     fo.data ->> 'teleTraits',
        'suggestedPrice', fo.data ->> 'suggestedPrice'
    ))
from sales_document fo
where qt.doc_type = 'QT' and qt.phase <> 'DONE'
  and fo.doc_type = 'FO' and fo.company_id = qt.company_id
  and fo.code = nullif(qt.data ->> 'srcFo', '');
