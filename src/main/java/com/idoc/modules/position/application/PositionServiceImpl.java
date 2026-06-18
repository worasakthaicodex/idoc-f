package com.idoc.modules.position.application;

import com.idoc.modules.position.application.dto.CreatePositionRequest;
import com.idoc.modules.position.application.dto.PositionResponse;
import com.idoc.modules.position.application.dto.UpdatePositionRequest;
import com.idoc.modules.position.domain.Position;
import com.idoc.modules.position.domain.PositionRepository;
import com.idoc.modules.position.domain.PositionSequence;
import com.idoc.modules.position.domain.PositionSequenceRepository;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.tenant.TenantContext;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class PositionServiceImpl implements PositionService {

    private final PositionRepository repository;
    private final PositionSequenceRepository sequenceRepository;

    @Override
    @Transactional(readOnly = true)
    public List<PositionResponse> list() {
        return repository.findByCompanyIdOrderByName(TenantContext.required())
                .stream().map(PositionMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PositionResponse get(UUID id) {
        return PositionMapper.toResponse(findScoped(id));
    }

    @Override
    public PositionResponse create(CreatePositionRequest request) {
        UUID tenant = TenantContext.required();
        if (repository.existsByCompanyIdAndName(tenant, request.name())) {
            throw new BusinessException("position.duplicate_name", "Position '%s' already exists".formatted(request.name()));
        }
        String code = nextPositionCode(tenant);
        Position p = Position.create(tenant, code, request.name(), request.description(),
                PositionMapper.join(request.modules()), request.department(), request.division());
        return PositionMapper.toResponse(repository.save(p));
    }

    @Override
    public PositionResponse update(UUID id, UpdatePositionRequest request) {
        Position p = findScoped(id);
        p.updateDetails(request.name(), request.description(),
                PositionMapper.join(request.modules()), request.department(), request.division());
        return PositionMapper.toResponse(p);
    }

    @Override
    public void delete(UUID id) {
        repository.delete(findScoped(id));
    }

    private Position findScoped(UUID id) {
        return repository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Position", id));
    }

    /** ออกรหัสตำแหน่งแบบรันต่อบริษัท: POS-00001, POS-00002, ... (ล็อกแถวกันเลขชน) */
    private String nextPositionCode(UUID tenant) {
        PositionSequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new PositionSequence(tenant)));
        return "POS-%05d".formatted(seq.nextPosition());
    }
}
