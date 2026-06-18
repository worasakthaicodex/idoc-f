package com.idoc.modules.workflow.application;

import com.idoc.modules.workflow.application.dto.AuthoritiesResponse;
import com.idoc.modules.workflow.application.dto.StagesResponse;
import com.idoc.modules.workflow.domain.WorkflowAuthorityConfig;
import com.idoc.modules.workflow.domain.WorkflowAuthorityConfigRepository;
import com.idoc.modules.workflow.domain.WorkflowStageConfig;
import com.idoc.modules.workflow.domain.WorkflowStageConfigRepository;
import com.idoc.shared.tenant.TenantContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class WorkflowServiceImpl implements WorkflowService {

    private final WorkflowStageConfigRepository repository;
    private final WorkflowAuthorityConfigRepository authorityRepository;

    @Override
    @Transactional(readOnly = true)
    public StagesResponse getStages(String docType) {
        List<Map<String, Object>> stages = repository
                .findByCompanyIdAndDocType(TenantContext.required(), docType)
                .map(WorkflowStageConfig::getStages)
                .orElse(List.of());
        return new StagesResponse(docType, stages);
    }

    @Override
    public StagesResponse saveStages(String docType, List<Map<String, Object>> stages) {
        UUID tenant = TenantContext.required();
        WorkflowStageConfig cfg = repository.findByCompanyIdAndDocType(tenant, docType)
                .orElseGet(() -> WorkflowStageConfig.create(tenant, docType, stages));
        cfg.setStages(stages);
        repository.save(cfg);
        return new StagesResponse(docType, cfg.getStages());
    }

    @Override
    @Transactional(readOnly = true)
    public AuthoritiesResponse getAuthorities(String docType) {
        List<Map<String, Object>> items = authorityRepository
                .findByCompanyIdAndDocType(TenantContext.required(), docType)
                .map(WorkflowAuthorityConfig::getAuthorities)
                .orElse(List.of());
        return new AuthoritiesResponse(docType, items);
    }

    @Override
    public AuthoritiesResponse saveAuthorities(String docType, List<Map<String, Object>> authorities) {
        UUID tenant = TenantContext.required();
        WorkflowAuthorityConfig cfg = authorityRepository.findByCompanyIdAndDocType(tenant, docType)
                .orElseGet(() -> WorkflowAuthorityConfig.create(tenant, docType, authorities));
        cfg.setAuthorities(authorities);
        authorityRepository.save(cfg);
        return new AuthoritiesResponse(docType, cfg.getAuthorities());
    }
}
