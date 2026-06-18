-- เติมข้อมูล SO จาก QT ที่เกี่ยวข้อง (จับคู่ SO.srcQt/quotationRef = QT.code) — ย้ายมาจาก backfill ฝั่ง client
-- เฉพาะช่องที่ยังว่าง · ใบใหม่ตั้งค่าตอนปิดการขายอยู่แล้ว นี่แก้ของเก่าที่ migrate เข้ามา

-- 1) ข้อมูลเพิ่มเติม (additionalInfo) <- บริการที่นำเสนอ (servicesOffered) ของ QT
update sales_document so
set data = jsonb_set(so.data, '{additionalInfo}', to_jsonb(qt.data->>'servicesOffered'))
from sales_document qt
where so.doc_type = 'SO'
  and qt.doc_type = 'QT'
  and qt.company_id = so.company_id
  and qt.code = coalesce(nullif(so.data->>'srcQt', ''), nullif(so.data->>'quotationRef', ''))
  and coalesce(so.data->>'additionalInfo', '') = ''
  and coalesce(qt.data->>'servicesOffered', '') <> '';

-- 2) บันทึกรายการ (quoteItemsNote) <- รายการย่อย (items) ของ QT
--    รูปแบบเดียวกับ fmtQtItems: "i. name · serviceType · qty unit · price฿ · ลด discount" ต่อบรรทัด (ข้ามรายการที่ไม่มีชื่อ)
update sales_document so
set data = jsonb_set(so.data, '{quoteItemsNote}', to_jsonb(fmt.note))
from sales_document qt
cross join lateral (
  select string_agg(
           idx || '. ' || array_to_string(array_remove(array[
             nullif(trim(it->>'name'), ''),
             nullif(trim(it->>'serviceType'), ''),
             case when nullif(trim(it->>'qty'), '') is not null
                  then trim(it->>'qty') || case when nullif(trim(it->>'unit'), '') is not null
                                                then ' ' || trim(it->>'unit') else '' end
                  else null end,
             case when nullif(trim(it->>'price'), '') is not null then (it->>'price') || '฿' else null end,
             case when coalesce(it->>'discount', '') ~ '^[0-9]+(\.[0-9]+)?$' and (it->>'discount')::numeric > 0
                  then 'ลด ' || (it->>'discount') else null end
           ], null), ' · '),
           E'\n' order by idx
         ) as note
  from jsonb_array_elements(
         -- items เก็บเป็น "สตริง JSON" → parse ก่อน (เฉพาะที่ขึ้นต้นด้วย '[' กันสตริงเสีย)
         case when coalesce(qt.data->>'items', '') ~ '^\s*\[' then (qt.data->>'items')::jsonb else '[]'::jsonb end
       ) with ordinality as t(it, idx)
  where nullif(trim(it->>'name'), '') is not null
) fmt
where so.doc_type = 'SO'
  and qt.doc_type = 'QT'
  and qt.company_id = so.company_id
  and qt.code = coalesce(nullif(so.data->>'srcQt', ''), nullif(so.data->>'quotationRef', ''))
  and coalesce(so.data->>'quoteItemsNote', '') = ''
  and fmt.note is not null and fmt.note <> '';
