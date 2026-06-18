package com.idoc.modules.platform.api;

import java.util.UUID;

/** มุมมองเจ้าของระบบแบบย่อ ให้ module อื่น (เช่น auth) ใช้ — ไม่เปิด entity ภายในออกไป */
public record PlatformAccountView(UUID id, String email, String fullName) {
}
