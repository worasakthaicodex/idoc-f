package com.idoc.modules.company.api;

import java.util.UUID;

/** มุมมองบริษัทแบบย่อ สำหรับ module อื่นใช้ (ไม่เปิด entity ภายในออกไป) */
public record CompanyView(UUID id, String code, String name, boolean active) {
}
