package com.idoc.shared.tenant;

import com.idoc.shared.exception.BusinessException;
import java.util.UUID;

/**
 * เก็บ "บริษัทปัจจุบัน" (tenant) ของ request ไว้ใน ThreadLocal
 * service ดึงจากที่นี่เพื่อ scope ข้อมูล — ไม่รับ companyId จาก client ตรง ๆ ใน body
 *
 * ปัจจุบัน (dev) ค่ามาจาก header X-Company-Id ผ่าน TenantFilter
 * ของจริงจะมาจาก JWT claim หลังต่อ auth
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(UUID companyId) {
        CURRENT.set(companyId);
    }

    public static UUID get() {
        return CURRENT.get();
    }

    /** บังคับว่าต้องมี tenant ไม่งั้นปฏิเสธ (กันลืม scope) */
    public static UUID required() {
        UUID id = CURRENT.get();
        if (id == null) {
            throw new BusinessException("ไม่พบบริษัทของผู้ใช้ (X-Company-Id) — เข้าสู่ระบบก่อน");
        }
        return id;
    }

    public static void clear() {
        CURRENT.remove();
    }
}
