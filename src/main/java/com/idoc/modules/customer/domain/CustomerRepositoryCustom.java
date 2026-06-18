package com.idoc.modules.customer.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * ค้นหาลูกค้าแบบไดนามิก (ค้นจริงที่ DB ไม่ใช่กรองฝั่งหน้า)
 *  - q       = ค้นง่าย (รหัส/ชื่อ/กลุ่ม/ทุกค่าใน attributes)
 *  - filters = ค้นเต็มพิกัด รายฟิลด์ (คอลัมน์จริง หรือ key ใน attributes JSONB)
 *  ทุก query scope ด้วย companyId + เฉพาะ ACTIVE เสมอ
 */
public interface CustomerRepositoryCustom {
    Page<Customer> search(UUID companyId, String q, Map<String, String> filters, List<String> statusIn, Pageable pageable);

    /**
     * ค้นหาเร็วสำหรับ dropdown/autocomplete — prefix ที่ "ส่วนหน้า" ของรหัส/ชื่อ (q%) ใช้ index ได้
     * ไม่สแกน attributes::text (ต่างจาก search ทั่วไปที่เป็น %q% contains) → เร็วแม้ลูกค้าหลักหมื่น
     */
    List<Customer> lookup(UUID companyId, String q, int limit);

    /** ผลนับต่อกลุ่ม (value = ค่ากลุ่ม, null = ไม่ระบุ) */
    record GroupCount(String value, long count) {}

    /**
     * สมาชิกในกลุ่ม (โชว์ใน popup)
     *  - lastContact = ติดต่อล่าสุด (comm ก่อน ไม่มีค่อย call)
     *  - groupValue  = ค่าจริงในเรคคอร์ดของฟิลด์ที่กด (ไว้ตรวจว่าตรงกลุ่ม)
     *  - followUp    = กำหนดติดตามล่าสุดในปฏิทิน (ยังไม่เสร็จ · ไม่เก่ากว่า 2 เดือน)
     */
    record Member(String code, String name, Instant lastContact, String groupValue, LocalDate followUp) {}

    /** ตัวอย่างสมาชิกกลุ่มแบบ head…tail (Python-style) — total = ทั้งหมด, head/tail = หัว/ท้ายตามรหัส */
    record GroupMembers(long total, List<Member> head, List<Member> tail) {}

    /**
     * นับลูกค้าต่อกลุ่ม (GROUP BY ที่ DB) — field = groupName | grade | businessType
     * ready = all | ready | notReady · กรอง "พร้อมใช้" ใน SQL (OR ของกฎที่ส่งมา):
     *  - sinceContactMonths != null → กฎ "ไม่ได้ติดต่อ ≥ N เดือน" (comm ก่อน ไม่มีค่อย call)
     *  - calendarDays != null       → กฎ "มีกิจกรรมปฏิทินภายใน ±N วัน ที่ยังไม่เสร็จ"
     */
    List<GroupCount> groupCounts(UUID companyId, String field, String ready,
                                 Integer sinceContactMonths, Integer calendarDays, String excludeBasketOwner);

    /** ดึงตัวอย่างสมาชิกกลุ่ม (เป๊ะตาม value) แบบ head…tail (ไม่ดึงทั้งหมด) — limit = จำนวนหัว/ท้าย
     *  excludeBasketOwner != null → ตัดคนที่อยู่ในตะกร้าที่ผู้ใช้คนนั้นเห็น (ของตัวเอง/แชร์มา) ออก */
    GroupMembers groupMembers(UUID companyId, String field, String value, String ready,
                              Integer sinceContactMonths, Integer calendarDays, String excludeBasketOwner, int limit);

    /** ตัวนับต่อปี (FO/QT/SO) */
    record YearCount(int year, long count) {}

    /** สรุป "ตามงานขาย" — FO/QT/SO รายปี (ย้อนหลัง N ปี) + กลุ่มติดต่อ/ใหม่/ปฏิทินข้างหน้า */
    record SalesBuckets(List<YearCount> fo, List<YearCount> qt, List<YearCount> so,
                        long contactedNotClosed, long neverContacted, long calendarAhead) {}

    SalesBuckets salesBuckets(UUID companyId, int years, String ready, Integer sinceContactMonths, Integer calendarDays,
                              String excludeBasketOwner);

    /**
     * สมาชิกของ bucket หนึ่ง (FO/QT/SO+year, contactedNotClosed, neverContacted, calendarAhead)
     * เจาะลึกตามกลุ่มลูกค้าได้ (field+value เช่น businessType=อาหาร) — null = ไม่เจาะ
     */
    GroupMembers bucketMembers(UUID companyId, String bucket, Integer year, String field, String value,
                               String ready, Integer sinceContactMonths, Integer calendarDays,
                               String excludeBasketOwner, int limit);

    /** แยกย่อย bucket ตามกลุ่ม (field) → นับลูกค้าต่อค่ากลุ่ม ภายใน bucket นั้น */
    List<GroupCount> bucketBreakdown(UUID companyId, String bucket, Integer year, String field,
                                     String ready, Integer sinceContactMonths, Integer calendarDays,
                                     String excludeBasketOwner);

    /**
     * รหัสลูกค้า N รายแรก (เรียงตามรหัส) ของกลุ่ม/bucket — ใช้ยกก้อนลงตะกร้า
     * excludeBasketId != null → ตัดคนที่อยู่ในตะกร้านั้นแล้วออก (เอาเฉพาะที่ยังไม่อยู่)
     */
    List<String> resolveCodes(UUID companyId, String field, String value, String bucket, Integer year,
                              String ready, Integer sinceContactMonths, Integer calendarDays,
                              UUID excludeBasketId, boolean excludeInProgressCl, int limit);

    /** รหัสลูกค้า N รายแรกจาก "การค้น" (q ง่าย หรือ filters รายฟิลด์ เหมือนหน้า /customer) + กรองพร้อมใช้/กันซ้ำ */
    List<String> resolveSearchCodes(UUID companyId, String q, Map<String, String> filters,
                                    String ready, Integer sinceContactMonths, Integer calendarDays,
                                    UUID excludeBasketId, boolean excludeInProgressCl, int limit);

    /** พรีวิวลูกค้าตามรหัส + ติดธง พร้อมใช้ (ready) / อยู่ใน CL อื่นที่ยังไม่ปิด (inOtherCl) — ไว้ให้เลือกตอนดึงจากตะกร้า */
    record LeadPreview(String code, String name, String groupName, Instant lastContact, boolean ready, boolean inOtherCl, long usedCount) {}

    List<LeadPreview> leadPreviewByCodes(UUID companyId, List<String> codes,
                                         Integer sinceContactMonths, Integer calendarDays, String currentClCode);

    /** แถวในตะกร้า (พร้อมจำนวน FO/QT/SO + เหตุผล/วันที่ต้องหยิบออก/วันที่ใส่) */
    record BasketRow(String code, String name, String groupName, Instant lastContact, long fo, long qt, long so,
                     String reason, java.time.LocalDate removeBy, Instant addedAt) {}

    List<BasketRow> basketItems(UUID companyId, UUID basketId);

    /**
     * รายการลูกค้า (ACTIVE) ที่ "เคลื่อนไหว" ล่าสุด — เคลื่อนไหว = ถูกดำเนินการจาก Tool (activity),
     * จากเอกสาร CL/FO/QT/SO (sales_document) หรือจากปฏิทิน (calendar_event)
     *  - movedAt = วันที่เคลื่อนไหวล่าสุด · source = TOOL | CL | FO | QT | SO | CALENDAR · detail = รายละเอียด (kind/หัวข้อ)
     */
    record MovementRow(String id, String code, String name, String status, Instant movedAt, String source, String detail) {}

    List<MovementRow> recentMovements(UUID companyId, int limit);
}
