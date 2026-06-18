package com.idoc.modules.activity.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** ทุก query scope ด้วย companyId เสมอ (กันข้อมูลข้ามบริษัท) ยกเว้นงาน purge ที่เป็น system-level */
public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    Optional<Activity> findByIdAndCompanyId(UUID id, UUID companyId);

    /** purge รายการที่ขีดออก (VOID) เกิน cutoff — ข้ามทุกบริษัท */
    @Modifying
    @Query("delete from Activity a where a.status = :status and a.voidedAt < :cutoff")
    int purgeVoidedBefore(@Param("status") ActivityStatus status, @Param("cutoff") Instant cutoff);

    /** ดึงตามเอกสาร (subject) — ใช้ตอนระบบอื่นเปิดจากหน้าเอกสาร CL/FO/QT/SO */
    List<Activity> findByCompanyIdAndSubjectTypeAndSubjectCodeAndKindOrderByOccurredAtDesc(
            UUID companyId, String subjectType, String subjectCode, String kind);

    /** ดึงตามลูกค้า — ใช้ตอนบันทึก/ดูจากหน้าลูกค้า (ไม่มีเอกสารแม่/อ้างอิง) */
    List<Activity> findByCompanyIdAndCustomerCodeAndKindOrderByOccurredAtDesc(
            UUID companyId, String customerCode, String kind);

    /** รายงาน: ทุกกิจกรรมของชนิดหนึ่งในบริษัท ภายในช่วงเวลา (ACTIVE เท่านั้น) — ใช้ในหน้ารายงานการขาย */
    @Query("select a from Activity a where a.companyId = :tenant and a.kind = :kind "
            + "and a.status = com.idoc.modules.activity.domain.ActivityStatus.ACTIVE "
            + "and a.occurredAt >= :from and a.occurredAt < :to order by a.occurredAt desc")
    List<Activity> reportByKind(@Param("tenant") UUID tenant, @Param("kind") String kind,
            @Param("from") Instant from, @Param("to") Instant to);

    /** projection: วันติดต่อล่าสุด ต่อ (ลูกค้า, ชนิด) */
    interface ContactRow {
        String getCustomerCode();
        String getKind();
        Instant getLast();
    }

    /** สรุป "วันติดต่อล่าสุด" ของทุกลูกค้า แยกตามชนิด (COMMUNICATION/CALL_RESULT) — รวดเดียว ไม่ยิงทีละคน */
    @Query("select a.customerCode as customerCode, a.kind as kind, max(a.occurredAt) as last "
            + "from Activity a where a.companyId = :tenant and a.status = com.idoc.modules.activity.domain.ActivityStatus.ACTIVE "
            + "and a.customerCode is not null and a.kind in :kinds "
            + "group by a.customerCode, a.kind")
    List<ContactRow> contactSummary(@Param("tenant") UUID tenant, @Param("kinds") List<String> kinds);

    /** วันติดต่อล่าสุด ของลูกค้าชุดหนึ่ง ชนิดเดียว — รวดเดียวสำหรับ enrich กล่องงาน (ไม่ยิงทีละคน) */
    @Query("select a.customerCode as customerCode, a.kind as kind, max(a.occurredAt) as last "
            + "from Activity a where a.companyId = :tenant and a.status = com.idoc.modules.activity.domain.ActivityStatus.ACTIVE "
            + "and a.kind = :kind and a.customerCode in :codes "
            + "group by a.customerCode, a.kind")
    List<ContactRow> latestByCustomers(@Param("tenant") UUID tenant, @Param("kind") String kind,
            @Param("codes") List<String> codes);

    /** projection: จำนวนกิจกรรมต่อเอกสาร (subject) */
    interface CountRow {
        String getSubjectCode();
        long getCnt();
    }

    /** นับกิจกรรมชนิดหนึ่ง (เช่น CALL_RESULT = รอบโทร) ต่อเอกสารชุดหนึ่ง — รวดเดียวสำหรับ enrich */
    @Query("select a.subjectCode as subjectCode, count(a) as cnt "
            + "from Activity a where a.companyId = :tenant and a.status = com.idoc.modules.activity.domain.ActivityStatus.ACTIVE "
            + "and a.kind = :kind and a.subjectType = :subjectType and a.subjectCode in :codes "
            + "group by a.subjectCode")
    List<CountRow> countBySubjects(@Param("tenant") UUID tenant, @Param("kind") String kind,
            @Param("subjectType") String subjectType, @Param("codes") List<String> codes);

    /** ข้อความติดต่อ "ล่าสุด" ต่อลูกค้า (COMMUNICATION) — รวดเดียวสำหรับ enrich · คืน [customer_code, message] */
    @Query(value = "select distinct on (customer_code) customer_code, payload->>'message' "
            + "from activity where company_id = :tenant and kind = 'COMMUNICATION' and status = 'ACTIVE' "
            + "and customer_code in (:codes) order by customer_code, occurred_at desc", nativeQuery = true)
    List<Object[]> latestMessageByCustomers(@Param("tenant") UUID tenant, @Param("codes") List<String> codes);
}
