package com.idoc.shared.notify;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** ของฉัน ล่าสุดก่อน (จำกัดจำนวน) */
    List<Notification> findByCompanyIdAndRecipientOrderByCreatedAtDesc(UUID companyId, String recipient, Pageable pageable);

    /** จำนวนที่ยังไม่อ่าน */
    long countByCompanyIdAndRecipientAndReadAtIsNull(UUID companyId, String recipient);

    @Modifying
    @Query("update Notification n set n.readAt = CURRENT_TIMESTAMP "
            + "where n.companyId = :tenant and n.recipient = :recipient and n.readAt is null")
    int markAllRead(@Param("tenant") UUID tenant, @Param("recipient") String recipient);
}
