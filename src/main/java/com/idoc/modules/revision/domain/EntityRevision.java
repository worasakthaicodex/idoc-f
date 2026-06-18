package com.idoc.modules.revision.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * EntityRevision = เวอร์ชัน/ประวัติของ "ข้อมูลตัวหนึ่ง" (ใคร สร้าง/แก้ไข/ย้อนกลับ + snapshot เต็ม)
 * อ้างอิงแบบ generic (entityType + entityId) ไม่ผูก entity ข้ามโมดูล → โมดูลไหนก็ใช้ได้
 */
@Entity
@Table(name = "entity_revision")
@Getter
@NoArgsConstructor
public class EntityRevision extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;
    @Column(name = "entity_id", nullable = false)
    private UUID entityId;
    @Column(name = "entity_code", length = 60)
    private String entityCode;

    @Column(nullable = false)
    private int revno;

    @Column(nullable = false, length = 20)
    private String action;   // CREATE | UPDATE | REVERT

    @Column(name = "changed_by", length = 200)
    private String changedBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> snapshot = new HashMap<>();

    public static EntityRevision create(UUID companyId, String entityType, UUID entityId, String entityCode,
                                        int revno, String action, String changedBy, Map<String, Object> snapshot) {
        EntityRevision r = new EntityRevision();
        r.companyId = companyId;
        r.entityType = entityType;
        r.entityId = entityId;
        r.entityCode = entityCode;
        r.revno = revno;
        r.action = action;
        r.changedBy = changedBy;
        r.snapshot = snapshot != null ? snapshot : new HashMap<>();
        return r;
    }
}
