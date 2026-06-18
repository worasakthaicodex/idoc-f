package com.idoc.modules.calendar.application;

import com.idoc.modules.calendar.domain.CalendarEvent;
import java.time.LocalDate;
import java.util.UUID;

/** กิจกรรมในปฏิทิน (รับ/ส่งกับหน้าเว็บ) */
public record CalendarDto(
        UUID id,
        LocalDate activityDate,
        LocalDate remindDate,
        String priority,
        String status,
        boolean confirmed,
        String title,
        String customerRef,
        String refType,
        String refCode,
        String module,
        String createdBy,
        String note) {

    public static CalendarDto from(CalendarEvent e) {
        return new CalendarDto(e.getId(), e.getActivityDate(), e.getRemindDate(), e.getPriority(),
                e.getStatus(), e.isConfirmed(), e.getTitle(), e.getCustomerRef(), e.getRefType(),
                e.getRefCode(), e.getModule(), e.getCreatedBy(), e.getNote());
    }

    /** เวอร์ชัน slim สำหรับ poll กระดิ่ง — ตัด note (text ยาว)/module/priority ที่ตัวแจ้งเตือนไม่ใช้ */
    public static CalendarDto fromSlim(CalendarEvent e) {
        return new CalendarDto(e.getId(), e.getActivityDate(), e.getRemindDate(), null,
                e.getStatus(), e.isConfirmed(), e.getTitle(), e.getCustomerRef(), e.getRefType(),
                e.getRefCode(), null, e.getCreatedBy(), null);
    }
}
