# Mapping — legacy `edata` tools → new `activity`

Tools are `edata` rows keyed by `extension_id`. Common columns on every tool row:
`data_value1..N` (values), `reference` (→ parent document's data_id), `data_idadd`/
`data_nameadd` (who added). New `activity` columns: company_id, kind, subject_type,
subject_code, customer_code, occurred_at, created_by, payload(JSONB), status.

Common mapping (all tools):
- `reference` (doc data_id) → resolve via document legacyId map → `subject_type` (FO/QT/CL)
  + `subject_code` (new doc code) + `customer_code` (the doc's customer)
- `data_nameadd` → `created_by` · (`data_idadd` → payload.legacyAddId, optional)
- `data_id` (the tool row's own id) → payload.legacyId · status = ACTIVE

## extension_id = 5 → COMMUNICATION
| legacy | → |
|---|---|
| data_value1 | payload.message |
| data_value2 | occurred_at (datetime บันทึก) |

## extension_id = 6 → CALL_RESULT
| legacy | → |
|---|---|
| data_value1 | payload.result  **(value-map → 7 opts: สนใจ/นัดหมาย · ระหว่างการพิจารณา · นัดโทรกลับ · ไม่รับสาย · พบปัญหาการติดต่อ · ไม่สนใจ/ปฏิเสธ · ส่งต่อเปิด FO)** |
| data_value2 | payload.minutes (เวลาโทร นาที) |
| data_value3 | payload.problem |
| data_value4 | payload.badInfo **(value-map → -, เบอร์ผิด, อีเมลผิด, ที่อยู่ผิด, ผู้ติดต่อเปลี่ยน)** |
| data_value5 | occurred_at (datetime บันทึก) |

## extension_id = 8 → CUSTOMER_SYSTEM
| legacy | → |
|---|---|
| data_value1 | payload.system **(value-map → ISO 9001/14001/45001, GMP, HACCP, HALAL, อย., อื่นๆ)** |
| data_value2 | payload.expiry (วันหมดอายุ — ฟอร์แมตเป็น date) |
| data_value3 | payload.scope |
| data_value4 | payload.note |
| occurred_at | **? ไม่มีคอลัมน์ datetime ในชุดนี้** — ใช้ generic insert-date ของ edata row ถ้ามี ไม่งั้น = expiry/now |

(ATTACHMENT tool = ไฟล์ → แยกไป Firebase ไม่ได้อยู่ใน edata)

## ยังต้องได้
1. **DISTINCT ค่า**: data_value1 ของ ext 6 (ผลการโทร), data_value4 ของ ext 6 (badInfo),
   data_value1 ของ ext 8 (ระบบ) — เพื่อทำ value-map → opts ใหม่
2. **ext 8 occurred_at**: edata มีคอลัมน์ "วันที่เพิ่ม record" กลางๆ ไหม (เช่น date_insert) —
   ใช้เป็น occurred_at ของ ext 8 (และ fallback ของทุก tool)
3. CUSTOMER_SYSTEM ในระบบใหม่ writesCalendar (expiry → ปฏิทิน) — สร้าง calendar event ตอน
   import ด้วยไหม หรือเก็บแค่ activity ก่อน (ทำทีหลังได้)
