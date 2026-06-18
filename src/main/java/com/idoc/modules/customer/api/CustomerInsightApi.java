package com.idoc.modules.customer.api;

import java.util.UUID;

/**
 * สัญญา (published API) สำหรับ "ล้าง cache สรุป/รายงานลูกค้า" ที่ module อื่นเรียกใช้ได้
 *
 * หน้า /customer/groups, /customer/reports และกล่องดึง lead ใน CL คำนวณ aggregate ทั้งบริษัท
 * (group-counts / sales-buckets / report) ซึ่ง "ไม่เปลี่ยนบ่อย" — cache ไว้ได้
 * เมื่อข้อมูลที่กระทบยอดเหล่านี้เปลี่ยน (ลูกค้า/ตะกร้า/เอกสารขาย/กิจกรรม/ปฏิทิน)
 * ให้เรียก invalidate(companyId) เพื่อล้าง cache "เฉพาะบริษัทนั้น" รอบเดียว
 *
 * กติกาการคุยข้าม module: import ได้เฉพาะ package `api` ของ module อื่นเท่านั้น
 */
public interface CustomerInsightApi {

    /** ล้าง cache สรุป/รายงานลูกค้าของบริษัทนี้ (ทำหลัง transaction commit เสมอ) */
    void invalidate(UUID companyId);
}
