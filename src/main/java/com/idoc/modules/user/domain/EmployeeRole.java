package com.idoc.modules.user.domain;

/**
 * บทบาทผู้ใช้ "ภายในบริษัท" (tenant-scoped) — 2 ระดับ
 * เจ้าของระบบ (platform owner) อยู่คนละโครงสร้าง: ดู PlatformAccount
 */
public enum EmployeeRole {
    COMPANY_OWNER,  // เจ้าของบริษัท (ผู้ใช้หลักของบริษัท)
    STAFF           // พนักงานทั่วไป
}
