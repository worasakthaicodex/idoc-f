package com.idoc.modules.activity.application;

import com.idoc.modules.activity.application.dto.ActivityResponse;
import com.idoc.modules.activity.application.dto.ContactSummary;
import com.idoc.modules.activity.application.dto.CreateActivityRequest;
import com.idoc.modules.activity.application.dto.UpdateActivityRequest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** use cases ของเครื่องมือเอกสาร — ทุกตัว scope กับบริษัทปัจจุบัน (TenantContext) อัตโนมัติ */
public interface ActivityService {

    ActivityResponse create(CreateActivityRequest request);

    /**
     * ดึงรายการของเครื่องมือหนึ่ง:
     *  - มี subjectType+subjectCode → ตามเอกสาร (เปิดจากหน้าเอกสาร)
     *  - ไม่มี subject แต่มี customerCode → ตามลูกค้า (เปิดจากหน้าลูกค้า)
     */
    List<ActivityResponse> list(String subjectType, String subjectCode, String customerCode, String kind);

    ActivityResponse update(UUID id, UpdateActivityRequest request);

    /** ลบตามอายุ: ≤ 3 วันลบจริง (คืน true) · เกิน 3 วันขีดออก/soft (คืน false) */
    boolean delete(UUID id);

    /** ยกเลิกการลบ (restore จาก VOID) */
    ActivityResponse restore(UUID id);

    /** สรุปวันติดต่อล่าสุดของทุกลูกค้า (สื่อสาร/ผลโทร) — ใช้คำนวณ "พร้อมใช้" */
    List<ContactSummary> contactSummary();

    /** รายงาน: ทุกกิจกรรมของชนิดหนึ่งในบริษัท ภายในช่วงเวลา — ใช้หน้ารายงานการขาย */
    List<ActivityResponse> report(String kind, Instant from, Instant to);
}
