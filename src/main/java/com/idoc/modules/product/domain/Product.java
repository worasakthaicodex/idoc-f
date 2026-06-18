package com.idoc.modules.product.domain;

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
 * Product = สินค้า/บริการของบริษัทหนึ่ง — tenant-scoped (มี companyId)
 *
 * code = รหัสที่คนเห็น (running ต่อบริษัท) รูปแบบ PRD{ปีเดือน}-{เลขรัน} — ไม่ใช่ PK
 * ฟิลด์ส่วนใหญ่ configurable → เก็บใน attributes (JSONB) · group_name = หมวดหมู่
 * เผื่อพ่วง BOM ในอนาคต (เป็น master ของรายการประกอบ)
 */
@Entity
@Table(name = "product")
@Getter
@NoArgsConstructor
public class Product extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProductStatus status;

    /** หมวดหมู่สินค้า/บริการ */
    @Column(name = "group_name", length = 120)
    private String groupName;

    /** ฟิลด์ configurable อื่น ๆ (ประเภท/หน่วยนับ/ราคา/…) เก็บเป็น JSONB ไม่ต้อง migration */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> attributes = new HashMap<>();

    /** เวลาที่ตั้งสถานะ PENDING_DELETE — ใช้คำนวณ purge 1 ปี (null = ไม่ได้รอลบ) */
    @Column(name = "pending_delete_at")
    private Instant pendingDeleteAt;

    public static Product create(UUID companyId, String code, String name, String groupName) {
        Product p = new Product();
        p.companyId = companyId;
        p.code = code;
        p.name = name;
        p.groupName = groupName;
        p.status = ProductStatus.ACTIVE;
        return p;
    }

    public void updateProfile(String name, String groupName) {
        this.name = name;
        this.groupName = groupName;
    }

    public void setStatus(ProductStatus status) {
        if (status == null) return;
        if (status == ProductStatus.PENDING_DELETE) {
            if (this.status != ProductStatus.PENDING_DELETE) this.pendingDeleteAt = Instant.now();
        } else {
            this.pendingDeleteAt = null;
        }
        this.status = status;
    }

    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes != null ? attributes : new HashMap<>();
    }
}
