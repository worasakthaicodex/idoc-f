package com.idoc.modules.platform.api;

import java.util.Optional;

/**
 * สัญญา (published API) ของ Platform module ให้ module อื่นเรียกใช้
 * กติกาข้าม module: import ได้เฉพาะ package `api` เท่านั้น
 */
public interface PlatformAccountApi {

    /** หาเจ้าของระบบที่ active + เปิด Google login ด้วยอีเมล (ใช้ตอน login ด้วย Gmail) */
    Optional<PlatformAccountView> findActiveGoogleByEmail(String email);

    /**
     * ตรวจรหัสผ่านเจ้าของระบบ (dev: ของจริงบังคับ Google)
     * คืนค่าเมื่ออีเมล active + ตั้งรหัสผ่านไว้ + รหัสตรง
     */
    Optional<PlatformAccountView> verifyPassword(String email, String rawPassword);
}
