package com.idoc.modules.revision.api;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** มุมมองประวัติ 1 เวอร์ชัน (รวม snapshot เต็มไว้ดู diff/ย้อนกลับฝั่งหน้าจอ) */
public record RevisionView(
        UUID id,
        int revno,
        String action,
        String changedBy,
        Instant createdAt,
        Map<String, Object> snapshot
) {
}
