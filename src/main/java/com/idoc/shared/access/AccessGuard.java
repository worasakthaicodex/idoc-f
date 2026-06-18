package com.idoc.shared.access;

import com.idoc.shared.exception.ForbiddenException;

/**
 * เช็คสิทธิ์ระดับ backend — เรียกที่ต้นเมธอดของ endpoint ที่ต้องคุม
 *   requireAdmin       = ผู้ดูแล (ADMIN/SUPER_ADMIN) ของโมดูล → เพิ่ม/แก้ไขข้อมูล
 *   requireSuperAdmin  = ผู้ดูแลสูงสุด (SUPER_ADMIN) → หน้าตั้งค่า
 * owner (เจ้าของระบบ/บริษัท) ผ่านทุกอย่างเสมอ
 */
public final class AccessGuard {

    public static final String CUSTOMER = "ลูกค้า";
    public static final String SALES = "งานขาย";
    public static final String HR = "บุคคล";
    public static final String PRODUCT = "สินค้าและบริการ";

    private AccessGuard() {
    }

    public static void requireAdmin(String moduleCode) {
        if (UserContext.isWorkflow()) return;   // ทำตามคำขอที่อนุมัติแล้ว (ผ่าน workflow) — อนุญาต
        String lv = UserContext.level(moduleCode);
        if (!"ADMIN".equals(lv) && !"SUPER_ADMIN".equals(lv)) {
            throw new ForbiddenException("access.denied", "ต้องเป็นผู้ดูแลของโมดูลนี้จึงจะดำเนินการได้");
        }
    }

    public static void requireSuperAdmin(String moduleCode) {
        if (!"SUPER_ADMIN".equals(UserContext.level(moduleCode))) {
            throw new ForbiddenException("access.denied", "ต้องเป็นผู้ดูแลสูงสุดของโมดูลนี้จึงจะดำเนินการได้");
        }
    }
}
