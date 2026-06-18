package com.idoc.modules.workflow.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowStageConfigRepository extends JpaRepository<WorkflowStageConfig, UUID> {

    Optional<WorkflowStageConfig> findByCompanyIdAndDocType(UUID companyId, String docType);
}
