package com.idoc.modules.division.application;

import com.idoc.modules.division.application.dto.CreateDivisionRequest;
import com.idoc.modules.division.application.dto.DivisionResponse;
import com.idoc.modules.division.application.dto.UpdateDivisionRequest;
import com.idoc.modules.division.domain.Division;
import com.idoc.modules.division.domain.DivisionRepository;
import com.idoc.modules.division.domain.DivisionSequence;
import com.idoc.modules.division.domain.DivisionSequenceRepository;
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
public class DivisionServiceImpl implements DivisionService {

    private final DivisionRepository repository;
    private final DivisionSequenceRepository sequenceRepository;

    @Override
    @Transactional(readOnly = true)
    public List<DivisionResponse> list() {
        return repository.findByCompanyIdOrderByName(TenantContext.required())
                .stream().map(DivisionMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DivisionResponse get(UUID id) {
        return DivisionMapper.toResponse(findScoped(id));
    }

    @Override
    public DivisionResponse create(CreateDivisionRequest request) {
        UUID tenant = TenantContext.required();
        if (repository.existsByCompanyIdAndName(tenant, request.name())) {
            throw new BusinessException("division.duplicate_name", "Division '%s' already exists".formatted(request.name()));
        }
        Division d = Division.create(tenant, nextCode(tenant), request.name());
        return DivisionMapper.toResponse(repository.save(d));
    }

    @Override
    public DivisionResponse update(UUID id, UpdateDivisionRequest request) {
        Division d = findScoped(id);
        d.updateDetails(request.name());
        return DivisionMapper.toResponse(d);
    }

    @Override
    public void delete(UUID id) {
        repository.delete(findScoped(id));
    }

    private Division findScoped(UUID id) {
        return repository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Division", id));
    }

    private String nextCode(UUID tenant) {
        DivisionSequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new DivisionSequence(tenant)));
        return "DIV-%05d".formatted(seq.nextDivision());
    }
}
