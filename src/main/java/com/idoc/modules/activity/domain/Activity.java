package com.idoc.modules.activity.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Activity = บันทึกของ "เครื่องมือเอกสารใช้ร่วม" (สื่อสาร/ผลโทร/ระบบลูกค้า/ไฟล์แนบ ...)
 * เชื่อมเอกสารแบบ string (subject/parent/customer) ไม่ผูก entity ข้ามโมดูล → โมดูลไหนก็เขียน/อ่านได้
 * payload เก็บฟิลด์เฉพาะเครื่องมือเป็น JSONB (ไม่ต้อง migration ต่อเครื่องมือ)
 */
@Entity
@Table(name = "activity")
@Getter
@NoArgsConstructor
public class Activity extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 40)
    private String kind;

    @Column(name = "subject_type", length = 40)
    private String subjectType;
    @Column(name = "subject_code", length = 60)
    private String subjectCode;

    @Column(name = "parent_type", length = 40)
    private String parentType;
    @Column(name = "parent_code", length = 60)
    private String parentCode;

    @Column(name = "customer_code", length = 60)
    private String customerCode;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "created_by", length = 200)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> payload = new HashMap<>();

    /** ACTIVE = ใช้งาน · VOID = ขีดออก (รอนำออก 6 เดือน) */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ActivityStatus status = ActivityStatus.ACTIVE;

    @Column(name = "voided_at")
    private Instant voidedAt;

    public void update(Instant occurredAt, Map<String, String> payload) {
        if (occurredAt != null) this.occurredAt = occurredAt;
        this.payload = payload != null ? payload : new HashMap<>();
    }

    /** ขีดออก (soft delete) — เก็บเวลาไว้คำนวณ purge 6 เดือน */
    public void voidEntry() {
        this.status = ActivityStatus.VOID;
        this.voidedAt = Instant.now();
    }

    /** ยกเลิกการลบ */
    public void restore() {
        this.status = ActivityStatus.ACTIVE;
        this.voidedAt = null;
    }

    public static Activity create(UUID companyId, String kind, String subjectType, String subjectCode,
                                  String parentType, String parentCode, String customerCode,
                                  Instant occurredAt, String createdBy, Map<String, String> payload) {
        Activity a = new Activity();
        a.companyId = companyId;
        a.kind = kind;
        a.subjectType = subjectType;
        a.subjectCode = subjectCode;
        a.parentType = parentType;
        a.parentCode = parentCode;
        a.customerCode = customerCode;
        a.occurredAt = occurredAt != null ? occurredAt : Instant.now();
        a.createdBy = createdBy;
        a.payload = payload != null ? payload : new HashMap<>();
        return a;
    }
}
