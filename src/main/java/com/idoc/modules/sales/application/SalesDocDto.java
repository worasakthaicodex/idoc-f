package com.idoc.modules.sales.application;

import com.idoc.modules.sales.domain.SalesDocument;
import java.util.HashMap;
import java.util.Map;

/**
 * รูปแบบเดียวกับ ClDoc ฝั่งหน้า — values = ค่าฟิลด์ทั้งหมด · received/bounce/sent มาจาก meta
 */
public record SalesDocDto(
        String code,
        String title,
        String telesale,
        String phase,
        Long savedAt,
        String stageId,
        Map<String, Object> values,
        Object received,
        Object bounce,
        Object sent) {

    public static SalesDocDto from(SalesDocument e) {
        Map<String, Object> meta = e.getMeta() == null ? Map.of() : e.getMeta();
        return new SalesDocDto(
                e.getCode(), e.getTitle(), e.getTelesale(), e.getPhase(), e.getSavedAt(), e.getStageId(),
                e.getData(), meta.get("received"), meta.get("bounce"), meta.get("sent"));
    }

    /** เวอร์ชัน slim — ตัด line items (ก้อนใหญ่สุด) ออก สำหรับ poll แจ้งเตือนที่ไม่ต้องใช้ยอด · ลด egress */
    public static SalesDocDto fromSlim(SalesDocument e) {
        Map<String, Object> meta = e.getMeta() == null ? Map.of() : e.getMeta();
        Map<String, Object> data = e.getData() == null ? Map.of() : new HashMap<>(e.getData());
        data.remove("items");
        return new SalesDocDto(
                e.getCode(), e.getTitle(), e.getTelesale(), e.getPhase(), e.getSavedAt(), e.getStageId(),
                data, meta.get("received"), meta.get("bounce"), meta.get("sent"));
    }
}
