package com.idoc.modules.department.application;

import com.idoc.modules.department.application.dto.CreateDepartmentRequest;
import com.idoc.modules.department.application.dto.DepartmentResponse;
import com.idoc.modules.department.application.dto.UpdateDepartmentRequest;
import com.idoc.modules.department.domain.Department;
import com.idoc.modules.department.domain.DepartmentRepository;
import com.idoc.modules.department.domain.DepartmentSequence;
import com.idoc.modules.department.domain.DepartmentSequenceRepository;
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
public class DepartmentServiceImpl implements DepartmentService {

    private final DepartmentRepository repository;
    private final DepartmentSequenceRepository sequenceRepository;

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentResponse> list() {
        return repository.findByCompanyIdOrderByName(TenantContext.required())
                .stream().map(DepartmentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DepartmentResponse get(UUID id) {
        return DepartmentMapper.toResponse(findScoped(id));
    }

    @Override
    public DepartmentResponse create(CreateDepartmentRequest request) {
        UUID tenant = TenantContext.required();
        if (repository.existsByCompanyIdAndName(tenant, request.name())) {
            throw new BusinessException("department.duplicate_name", "Department '%s' already exists".formatted(request.name()));
        }
        Department d = Department.create(tenant, nextCode(tenant), request.name(), request.division());
        return DepartmentMapper.toResponse(repository.save(d));
    }

    @Override
    public DepartmentResponse update(UUID id, UpdateDepartmentRequest request) {
        Department d = findScoped(id);
        d.updateDetails(request.name(), request.division());
        return DepartmentMapper.toResponse(d);
    }

    @Override
    public void delete(UUID id) {
        repository.delete(findScoped(id));
    }

    private Department findScoped(UUID id) {
        return repository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Department", id));
    }

    private String nextCode(UUID tenant) {
        DepartmentSequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new DepartmentSequence(tenant)));
        return "DEP-%05d".formatted(seq.nextDepartment());
    }
}
