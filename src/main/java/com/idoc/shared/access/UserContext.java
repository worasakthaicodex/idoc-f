package com.idoc.shared.access;

import java.util.Map;

/**
 * เก็บ "ผู้ใช้ปัจจุบัน" (role + สิทธิ์เข้าโมดูล) ของ request ไว้ใน ThreadLocal
 * ค่ามาจาก header X-User-Role / X-User-Modules ผ่าน UserFilter
 *
 * NOTE (dev): ระดับ trust เดียวกับ X-Company-Id — ของจริงต้องอ่านจาก JWT claim
 */
public final class UserContext {

    public record CurrentUser(String role, Map<String, String> modules, boolean workflow) {}

    private static final ThreadLocal<CurrentUser> CURRENT = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(String role, Map<String, String> modules, boolean workflow) {
        CURRENT.set(new CurrentUser(role == null ? "" : role, modules == null ? Map.of() : modules, workflow));
    }

    /** เป็นการ "ทำตามคำขอที่อนุมัติแล้ว" (workflow) ไหม — endpoint ที่ถูก guard จะยอมให้ผ่าน */
    public static boolean isWorkflow() {
        CurrentUser u = CURRENT.get();
        return u != null && u.workflow();
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static boolean isOwner() {
        CurrentUser u = CURRENT.get();
        return u != null && ("PLATFORM_OWNER".equals(u.role()) || "COMPANY_OWNER".equals(u.role()));
    }

    /** ระดับสิทธิ์ในโมดูล (owner = SUPER_ADMIN) · ไม่มี = null */
    public static String level(String moduleCode) {
        if (isOwner()) return "SUPER_ADMIN";
        CurrentUser u = CURRENT.get();
        return u == null ? null : u.modules().get(moduleCode);
    }
}
