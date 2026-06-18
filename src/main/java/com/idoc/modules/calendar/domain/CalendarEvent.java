package com.idoc.modules.calendar.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * กิจกรรมในปฏิทิน (Calendar) — โมดูลกลาง ใช้ได้ทุกโมดูล · tenant-scoped
 * อ้างอิงเอกสาร/ลูกค้าแบบ generic (refType+refCode, customerRef) เพื่อเชื่อมข้ามโมดูล
 */
@Entity
@Table(name = "calendar_event")
@Getter
@Setter
@NoArgsConstructor
public class CalendarEvent extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(name = "remind_date")
    private LocalDate remindDate;

    @Column(nullable = false, length = 20)
    private String priority = "NORMAL";   // LOW / NORMAL / HIGH

    @Column(nullable = false, length = 20)
    private String status = "PENDING";    // PENDING / DONE / OVERDUE

    @Column(nullable = false)
    private boolean confirmed = false;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "customer_ref", length = 60)
    private String customerRef;

    @Column(name = "ref_type", length = 20)
    private String refType;

    @Column(name = "ref_code", length = 40)
    private String refCode;

    @Column(length = 40)
    private String module;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(columnDefinition = "text")
    private String note;
}
