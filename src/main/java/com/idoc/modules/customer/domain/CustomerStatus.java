package com.idoc.modules.customer.domain;

/**
 * สถานะหลักของลูกค้า — โค้ดตายตัว (ใช้ในลอจิก) บริษัทเปิด/ปิด + เปลี่ยนคำที่แสดงได้ฝั่งหน้าเว็บ
 * เฉพาะ ACTIVE ที่แสดงในหน้าหลัก · PENDING_DELETE = ตั้งคิวลบใน 1 ปี
 */
public enum CustomerStatus {
    ACTIVE,
    INFORMATION_INCOMPLETE,
    NO_INTEREST,
    LEGAL_HOLD,
    BLACKLISTED,
    BUSINESS_CLOSED,
    PENDING_DELETE
}
