package com.idoc.modules.product.domain;

/**
 * สถานะหลักของสินค้า/บริการ — โค้ดตายตัว (ใช้ในลอจิก) บริษัทเปลี่ยนคำที่แสดงได้ฝั่งหน้าเว็บ
 * เฉพาะ ACTIVE ที่แสดงในหน้าหลัก · PENDING_DELETE = ตั้งคิวลบใน 1 ปี
 */
public enum ProductStatus {
    ACTIVE,
    DISCONTINUED,
    OUT_OF_STOCK,
    DRAFT,
    PENDING_DELETE
}
