package com.idoc.modules.attachment.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Metadata ของไฟล์แนบ — tenant-scoped · **ไม่เก็บ bytes** (ไฟล์จริงอยู่ object storage)
 * owner_type/owner_id = ผูกกับอะไร (เช่น "employee" + employeeId, "qt" + docId)
 */
@Entity
@Table(name = "attachment")
@Getter
@NoArgsConstructor
public class Attachment extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "owner_type", nullable = false, length = 40)
    private String ownerType;

    @Column(name = "owner_id", nullable = false, length = 64)
    private String ownerId;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttachmentStatus status;

    @Column(name = "uploaded_by", length = 120)
    private String uploadedBy;

    /** ชนิดไฟล์ (เลือกจากชุดที่บริษัทกำหนด เช่น สัญญา/ใบโอนยอด) */
    @Column(length = 80)
    private String category;

    /** เอกสารต้นทางที่ไฟล์มาจาก (เช่น QT202606-1) */
    @Column(name = "source_ref", length = 40)
    private String sourceRef;

    public static Attachment createPending(UUID companyId, String ownerType, String ownerId,
                                           String filename, String contentType, long sizeBytes,
                                           String storageKey, String uploadedBy,
                                           String category, String sourceRef) {
        Attachment a = new Attachment();
        a.companyId = companyId;
        a.ownerType = ownerType;
        a.ownerId = ownerId;
        a.filename = filename;
        a.contentType = contentType;
        a.sizeBytes = sizeBytes;
        a.storageKey = storageKey;
        a.uploadedBy = uploadedBy;
        a.category = (category == null || category.isBlank()) ? null : category.trim();
        a.sourceRef = (sourceRef == null || sourceRef.isBlank()) ? null : sourceRef.trim();
        a.status = AttachmentStatus.PENDING;
        return a;
    }

    public void markReady() {
        this.status = AttachmentStatus.READY;
    }
}
