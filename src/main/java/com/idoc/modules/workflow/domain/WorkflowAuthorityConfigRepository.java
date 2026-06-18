package com.idoc.modules.workflow.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowAuthorityConfigRepository extends JpaRepository<WorkflowAuthorityConfig, UUID> {

    Optional<WorkflowAuthorityConfig> findByCompanyIdAndDocType(UUID companyId, String docType);
}
