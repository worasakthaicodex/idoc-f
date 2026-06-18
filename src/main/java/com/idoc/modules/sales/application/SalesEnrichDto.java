package com.idoc.modules.sales.application;

/**
 * ค่าเสริมต่อเอกสารกล่องงาน — คำนวณรวดเดียวที่ backend (ไม่ให้หน้าเว็บไล่ยิงรายแถว)
 *  grade = เกรดลูกค้า · latestCommAt = เวลาติดต่อล่าสุด (epoch ms) · rounds = จำนวนรอบโทร · apptDate = วันนัดที่ยังไม่ทำ (เร็วสุด)
 */
public record SalesEnrichDto(
        String code,
        String customerRef,
        String grade,
        Long latestCommAt,
        String latestCommMsg,
        Integer rounds,
        String apptDate) {
}
