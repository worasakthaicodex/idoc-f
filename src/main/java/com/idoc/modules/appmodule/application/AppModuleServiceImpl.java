package com.idoc.modules.appmodule.application;

import com.idoc.modules.appmodule.application.dto.CreateModuleRequest;
import com.idoc.modules.appmodule.application.dto.ModuleResponse;
import com.idoc.modules.appmodule.application.dto.UpdateModuleRequest;
import com.idoc.modules.appmodule.domain.AppModule;
import com.idoc.modules.appmodule.domain.AppModuleRepository;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class AppModuleServiceImpl implements AppModuleService {

    private final AppModuleRepository repository;

    @Override
    @Transactional(readOnly = true)
    public List<ModuleResponse> list(boolean includeInactive) {
        List<AppModule> items = includeInactive
                ? repository.findAllByOrderBySortOrderAscNameAsc()
                : repository.findByActiveTrueOrderBySortOrderAscNameAsc();
        return items.stream().map(AppModuleMapper::toResponse).toList();
    }

    @Override
    public ModuleResponse create(CreateModuleRequest request) {
        String code = (request.code() == null || request.code().isBlank()) ? request.name() : request.code();
        if (repository.existsByCode(code)) {
            throw new BusinessException("module.duplicate_code", "Module code '%s' already exists".formatted(code));
        }
        int sort = request.sortOrder() != null ? request.sortOrder() : (int) repository.count() + 1;
        AppModule m = AppModule.create(code, request.name(), request.nameEn(), sort);
        return AppModuleMapper.toResponse(repository.save(m));
    }

    @Override
    public ModuleResponse update(UUID id, UpdateModuleRequest request) {
        AppModule m = repository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Module", id));
        m.updateDetails(request.name(), request.nameEn(), request.sortOrder(), request.active());
        return AppModuleMapper.toResponse(m);
    }

    @Override
    public void delete(UUID id) {
        repository.delete(repository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Module", id)));
    }
}
