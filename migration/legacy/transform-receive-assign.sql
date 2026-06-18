-- transform-receive-assign.sql — เอกสารที่ค้างกล่อง "รับเข้า" (current_step=Create/ลอย ไม่มีคนถือ)
-- → ย้ายไป "ดำเนินการ" + มอบเจ้าของ · QT = ขวัญใจ จันทร์คง · FO = กุลจิรา เกิดภักดี · stage = st-exec
-- รันหลัง transform-docs/stages. usage: -v cid="'<uuid>'"
\set ON_ERROR_STOP on
update sales_document
set phase    = 'PROCESS',
    stage_id = 'st-exec',
    meta = (coalesce(meta, '{}'::jsonb) - 'received' - 'sent')
           || jsonb_build_object('received', jsonb_build_object(
                'by', case when doc_type = 'QT' then 'ขวัญใจ จันทร์คง' else 'กุลจิรา เกิดภักดี' end,
                'at', saved_at)),
    data = data || jsonb_build_object('createdBy',
             case when doc_type = 'QT' then 'ขวัญใจ จันทร์คง' else 'กุลจิรา เกิดภักดี' end),
    updated_at = now()
where company_id = :cid::uuid and doc_type in ('FO','QT') and phase = 'RECEIVE';
