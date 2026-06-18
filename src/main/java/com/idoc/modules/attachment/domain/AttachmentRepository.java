package com.idoc.modules.attachment.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {

    List<Attachment> findByCompanyIdAndOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(
            UUID companyId, String ownerType, String ownerId, AttachmentStatus status);

    Optional<Attachment> findByIdAndCompanyId(UUID id, UUID companyId);

    /** รวมขนาดไฟล์ที่ใช้จริงต่อบริษัท (สำหรับเช็คโควตา) */
    @Query("select coalesce(sum(a.sizeBytes), 0) from Attachment a where a.companyId = :companyId and a.status = :status")
    long sumSize(@Param("companyId") UUID companyId, @Param("status") AttachmentStatus status);

    /** รวมขนาดไฟล์ทั้งระบบ (ทุกบริษัท) — สำหรับหน้า "จัดการ server" ของเจ้าของระบบ */
    @Query("select coalesce(sum(a.sizeBytes), 0) from Attachment a where a.status = :status")
    long sumSizeAll(@Param("status") AttachmentStatus status);
}
