package com.idoc.modules.revision.api;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * จุดเชื่อมข้ามโมดูลของระบบประวัติ/เวอร์ชัน — โมดูลอื่นเรียกผ่าน interface นี้เท่านั้น
 * (บันทึก snapshot ตอน สร้าง/แก้ไข/ย้อนกลับ และอ่านกลับเพื่อ revert)
 */
public interface RevisionApi {

    /** บันทึก 1 เวอร์ชัน (revno รันต่อ entity อัตโนมัติ) */
    void record(String entityType, UUID entityId, String entityCode, String action, String changedBy, Map<String, Object> snapshot);

    /** รายการเวอร์ชันของ entity (ใหม่ → เก่า) */
    List<RevisionView> list(String entityType, UUID entityId);

    /** snapshot เต็มของเวอร์ชันหนึ่ง (ใช้ตอน revert) — scope ตามบริษัท */
    Map<String, Object> snapshot(UUID revisionId);
}
