package com.idoc.modules.customer.application.dto;

import java.util.List;

/**
 * ใส่ลงตะกร้า — เลือกได้:
 *  - codes: รายชื่อรหัสลูกค้าตรง ๆ (ทีละราย/หลายราย)
 *  - field+value: ยกก้อนจากกลุ่ม (เช่น businessType=อาหาร)
 *  - bucket(+year): ยกก้อนจาก "ตามงานขาย" (เจาะกลุ่มด้วย field+value ได้)
 * limit = จำนวนสูงสุดเมื่อยกก้อน (default 60) · ready/months/days = ตัวกรองพร้อมใช้
 */
public record AddToBasketRequest(
        List<String> codes,
        String field,
        String value,
        String bucket,
        Integer year,
        Integer limit,
        Boolean onlyNew,   // true = ยกก้อนเฉพาะคนที่ยังไม่อยู่ในตะกร้านี้
        String ready,
        Integer sinceContactMonths,
        Integer calendarDays,
        String reason,     // เหตุผลที่ใส่ลงตะกร้า (ใช้กับรายการที่เพิ่มในครั้งนี้)
        String removeBy) {} // วันที่ต้องหยิบออก (ISO yyyy-MM-dd)
