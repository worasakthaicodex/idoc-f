package com.idoc.modules.user.application.dto;

import java.util.Map;
import java.util.UUID;

/**
 * ผลลัพธ์ login — รองรับสิทธิ์ 3 ระดับ
 *  - role = PLATFORM_OWNER  → เจ้าของระบบ (ไม่ผูกบริษัท: company* / employeeCode = null)
 *  - role = COMPANY_OWNER   → เจ้าของบริษัท (ผูก tenant)
 *  - role = STAFF           → พนักงานบริษัท (ผูก tenant)
 * modules = สิทธิ์เข้าโมดูลตามตำแหน่ง (moduleCode → USER|ADMIN|SUPER_ADMIN) · owner ไม่ต้องใช้ (มองเป็นสูงสุดทุกโมดูล)
 */
public record AuthResponse(
        String role,
        UUID accountId,
        String fullName,
        String email,
        UUID companyId,
        String companyCode,
        String companyName,
        String employeeCode,
        Map<String, String> modules
) {
    /** เจ้าของระบบ — ไม่มีบริษัท */
    public static AuthResponse platformOwner(UUID id, String fullName, String email) {
        return new AuthResponse("PLATFORM_OWNER", id, fullName, email, null, null, null, null, Map.of());
    }
}
