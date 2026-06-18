package com.idoc.modules.revision.application;

import com.idoc.modules.revision.api.RevisionApi;
import com.idoc.modules.revision.api.RevisionView;
import com.idoc.modules.revision.domain.EntityRevision;
import com.idoc.modules.revision.domain.EntityRevisionRepository;
import com.idoc.shared.exception.ResourceNotFoundException;
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
public class RevisionServiceImpl implements RevisionApi {

    private final EntityRevisionRepository repository;

    @Override
    public void record(String entityType, UUID entityId, String entityCode, String action, String changedBy, Map<String, Object> snapshot) {
        UUID tenant = TenantContext.required();
        int next = repository.countByCompanyIdAndEntityTypeAndEntityId(tenant, entityType, entityId) + 1;
        repository.save(EntityRevision.create(tenant, entityType, entityId, entityCode, next, action, changedBy, snapshot));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RevisionView> list(String entityType, UUID entityId) {
        return repository
                .findByCompanyIdAndEntityTypeAndEntityIdOrderByRevnoDesc(TenantContext.required(), entityType, entityId)
                .stream()
                .map(r -> new RevisionView(r.getId(), r.getRevno(), r.getAction(), r.getChangedBy(), r.getCreatedAt(), r.getSnapshot()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> snapshot(UUID revisionId) {
        return repository.findByIdAndCompanyId(revisionId, TenantContext.required())
                .map(EntityRevision::getSnapshot)
                .orElseThrow(() -> ResourceNotFoundException.of("Revision", revisionId));
    }
}
