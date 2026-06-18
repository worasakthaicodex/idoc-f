package com.idoc.modules.company.domain;

/** สถานะของบริษัทที่มาเช่าใช้ (tenant) */
public enum CompanyStatus {
    TRIAL,      // ทดลองใช้
    ACTIVE,     // ใช้งานปกติ
    SUSPENDED,  // ถูกระงับ (ค้างชำระ/ผิดเงื่อนไข)
    EXPIRED     // หมดอายุ
}
