package com.idoc.modules.revision.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** ทุก query scope ด้วย companyId เสมอ (กันข้อมูลข้ามบริษัท) */
public interface EntityRevisionRepository extends JpaRepository<EntityRevision, UUID> {

    List<EntityRevision> findByCompanyIdAndEntityTypeAndEntityIdOrderByRevnoDesc(
            UUID companyId, String entityType, UUID entityId);

    int countByCompanyIdAndEntityTypeAndEntityId(UUID companyId, String entityType, UUID entityId);

    Optional<EntityRevision> findByIdAndCompanyId(UUID id, UUID companyId);
}
