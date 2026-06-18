package com.idoc.modules.customer.domain;

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
 * Customer = ลูกค้าของบริษัทหนึ่ง — tenant-scoped (มี companyId)
 *
 * code = รหัสลูกค้าที่คนเห็น (running ต่อบริษัท) รูปแบบ REG{ปีเดือน}-{เลขรัน} — ไม่ใช่ PK
 * ฟิลด์ส่วนใหญ่ configurable (เลือก/จัดได้แบบ Employee fields) → เก็บใน attributes (JSONB)
 * เก็บเป็นคอลัมน์จริงเฉพาะที่ใช้ค้น/แสดงตารางบ่อย: name, status, group_name
 */
@Entity
@Table(name = "customer")
@Getter
@NoArgsConstructor
public class Customer extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CustomerStatus status;

    /** กลุ่มลูกค้า (ใช้เมนู "รายชื่อตามกลุ่ม") */
    @Column(name = "group_name", length = 120)
    private String groupName;

    /** ฟิลด์ configurable อื่น ๆ (เลือก/จัดได้) เก็บเป็น JSONB ไม่ต้อง migration */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> attributes = new HashMap<>();

    /** เวลาที่ตั้งสถานะ PENDING_DELETE — ใช้คำนวณ purge 1 ปี (null = ไม่ได้รอลบ) */
    @Column(name = "pending_delete_at")
    private Instant pendingDeleteAt;

    /**
     * วันติดต่อล่าสุด (denormalize จาก activity) — ดูแลด้วย DB trigger เท่านั้น
     * อ่านอย่างเดียว (insertable/updatable=false) กัน Hibernate เขียนทับค่าที่ trigger ดูแล
     * ใช้คำนวณ "พร้อมใช้" แบบไม่ต้อง subquery บน activity ต่อแถว (รองรับลูกค้าจำนวนมาก)
     */
    @Column(name = "last_comm_at", insertable = false, updatable = false)
    private Instant lastCommAt;

    @Column(name = "last_call_at", insertable = false, updatable = false)
    private Instant lastCallAt;

    public static Customer create(UUID companyId, String code, String name, String groupName) {
        Customer c = new Customer();
        c.companyId = companyId;
        c.code = code;
        c.name = name;
        c.groupName = groupName;
        c.status = CustomerStatus.ACTIVE;
        return c;
    }

    public void updateProfile(String name, String groupName) {
        this.name = name;
        this.groupName = groupName;
    }

    public void setStatus(CustomerStatus status) {
        if (status == null) return;
        if (status == CustomerStatus.PENDING_DELETE) {
            if (this.status != CustomerStatus.PENDING_DELETE) this.pendingDeleteAt = Instant.now();
        } else {
            this.pendingDeleteAt = null;   // ออกจากคิวลบ
        }
        this.status = status;
    }

    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes != null ? attributes : new HashMap<>();
    }
}
