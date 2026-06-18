package com.idoc.modules.calendar.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, UUID> {


  /*

    @Query("select c from CalendarEvent c where c.companyId = :tenant "
            + "and (:from is null or c.activityDate >= :from) "
            + "and (:to is null or c.activityDate <= :to) "
            + "and (:customerRef is null or c.customerRef = :customerRef) "
            + "and (:refType is null or c.refType = :refType) "
            + "and (:refCode is null or c.refCode = :refCode) "
            + "and (:module is null or c.module = :module) "
            + "order by c.activityDate asc")
    List<CalendarEvent> search(@Param("tenant") UUID tenant,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               @Param("customerRef") String customerRef,
                               @Param("refType") String refType,
                               @Param("refCode") String refCode,
                               @Param("module") String module);

    
    @Query("select c from CalendarEvent c where c.companyId = :tenant "
            + "and c.status <> 'DONE' and c.confirmed = false "
            + "and coalesce(c.remindDate, c.activityDate) <= :today "
            + "and coalesce(c.remindDate, c.activityDate) >= :since "
            + "order by c.activityDate asc")
    List<CalendarEvent> searchDue(@Param("tenant") UUID tenant,
                                  @Param("since") LocalDate since,
                                  @Param("today") LocalDate today);

    @Query("select c from CalendarEvent c where c.companyId = :tenant and c.refType = :refType "
            + "and c.refCode in :codes and c.status <> 'DONE' and c.confirmed = false "
            + "order by c.activityDate asc")
    List<CalendarEvent> findPendingByRefCodes(@Param("tenant") UUID tenant,
            @Param("refType") String refType, @Param("codes") List<String> codes);
 */

            /** รายการกิจกรรมของบริษัท — กรองช่วงวันที่/ลูกค้า/ชนิดอ้างอิง/โมดูลได้ (null = ไม่กรอง) */
    // 🎯 เพิ่ม cast(:param as string) และ cast(:param as date) ครอบท่อนตรวจ null ทั้งหมดครับเดฟ
    @Query("select c from CalendarEvent c where c.companyId = :tenant "
            + "and (cast(:from as date) is null or c.activityDate >= :from) "
            + "and (cast(:to as date) is null or c.activityDate <= :to) "
            + "and (cast(:customerRef as string) is null or c.customerRef = :customerRef) "
            + "and (cast(:refType as string) is null or c.refType = :refType) "
            + "and (cast(:refCode as string) is null or c.refCode = :refCode) "
            + "and (cast(:module as string) is null or c.module = :module) "
            + "order by c.activityDate asc")
    List<CalendarEvent> search(@Param("tenant") UUID tenant,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               @Param("customerRef") String customerRef,
                               @Param("refType") String refType,
                               @Param("refCode") String refCode,
                               @Param("module") String module);

    /** กิจกรรมที่ "ถึงกำหนดเตือน/เลยกำหนด" — ผ่านฉลุย โค้ดเดิมของเดฟไม่ต้องแก้ครับ */
    @Query("select c from CalendarEvent c where c.companyId = :tenant "
            + "and c.status <> 'DONE' and c.confirmed = false "
            + "and coalesce(c.remindDate, c.activityDate) <= :today "
            + "and coalesce(c.remindDate, c.activityDate) >= :since "
            + "order by c.activityDate asc")
    List<CalendarEvent> searchDue(@Param("tenant") UUID tenant,
                                  @Param("since") LocalDate since,
                                  @Param("today") LocalDate today);

    /** นัดที่ยังไม่ทำ ของเอกสารชุดหนึ่ง — ผ่านฉลุย โค้ดเดิมของเดฟไม่ต้องแก้ครับ */
    @Query("select c from CalendarEvent c where c.companyId = :tenant and c.refType = :refType "
            + "and c.refCode in :codes and c.status <> 'DONE' and c.confirmed = false "
            + "order by c.activityDate asc")
    List<CalendarEvent> findPendingByRefCodes(@Param("tenant") UUID tenant,
            @Param("refType") String refType, @Param("codes") List<String> codes);



}



