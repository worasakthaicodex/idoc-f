package com.idoc.modules.company.application;

import com.idoc.modules.company.api.CompanyApi;
import com.idoc.modules.company.api.CompanyCreatedEvent;
import com.idoc.modules.company.api.CompanyView;
import com.idoc.modules.company.application.dto.CompanyResponse;
import com.idoc.modules.company.application.dto.CreateCompanyRequest;
import com.idoc.modules.company.application.dto.UpdateCompanyRequest;
import com.idoc.modules.company.domain.Company;
import com.idoc.modules.company.domain.CompanyRepository;
import com.idoc.modules.company.domain.CompanyStatus;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic ทั้งหมดของ Company อยู่ที่นี่ (controller ไม่มี logic)
 * implements ทั้ง CompanyService (ใช้ภายใน) และ CompanyApi (ให้ module อื่นเรียก)
 */
@Service
@Transactional
@RequiredArgsConstructor
public class CompanyServiceImpl implements CompanyService, CompanyApi {

    private final CompanyRepository repository;
    private final ApplicationEventPublisher events;

    @Override
    public CompanyResponse create(CreateCompanyRequest request) {
        if (repository.existsByCode(request.code())) {
            throw new BusinessException("รหัสบริษัท '%s' ถูกใช้แล้ว".formatted(request.code()));
        }
        Company company = Company.create(request.code(), request.name(), request.contactEmail(), request.plan());
        Company saved = repository.save(company);
        // แจ้ง module อื่น — user module จะสร้างบัญชีเจ้าของบริษัทให้อัตโนมัติ
        events.publishEvent(new CompanyCreatedEvent(saved.getId(), saved.getCode(), saved.getName(), saved.getContactEmail()));
        return CompanyMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public CompanyResponse get(UUID id) {
        return CompanyMapper.toResponse(findOrThrow(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CompanyResponse> list(CompanyStatus status, Pageable pageable) {
        Page<Company> page = (status == null)
                ? repository.findAll(pageable)
                : repository.findByStatus(status, pageable);
        return page.map(CompanyMapper::toResponse);
    }

    @Override
    public CompanyResponse update(UUID id, UpdateCompanyRequest request) {
        Company company = findOrThrow(id);
        company.updateDetails(request.name(), request.contactEmail(), request.plan(), request.expiresAt());
        return CompanyMapper.toResponse(company);
    }

    @Override
    public CompanyResponse activate(UUID id) {
        Company company = findOrThrow(id);
        company.activate();
        return CompanyMapper.toResponse(company);
    }

    @Override
    public CompanyResponse suspend(UUID id) {
        Company company = findOrThrow(id);
        company.suspend();
        return CompanyMapper.toResponse(company);
    }

    // ----- CompanyApi (cross-module) -----

    @Override
    @Transactional(readOnly = true)
    public Optional<CompanyView> findById(UUID id) {
        return repository.findById(id).map(CompanyMapper::toView);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isActive(UUID id) {
        return repository.findById(id).map(Company::isActive).orElse(false);
    }

    private Company findOrThrow(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Company", id));
    }
}
