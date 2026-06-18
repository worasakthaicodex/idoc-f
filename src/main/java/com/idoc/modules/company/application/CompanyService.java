package com.idoc.modules.company.application;

import com.idoc.modules.company.application.dto.CompanyResponse;
import com.idoc.modules.company.application.dto.CreateCompanyRequest;
import com.idoc.modules.company.application.dto.UpdateCompanyRequest;
import com.idoc.modules.company.domain.CompanyStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Use cases ของ Company (public API ภายใน module) — web เรียกผ่าน interface นี้ */
public interface CompanyService {

    CompanyResponse create(CreateCompanyRequest request);

    CompanyResponse get(UUID id);

    Page<CompanyResponse> list(CompanyStatus status, Pageable pageable);

    CompanyResponse update(UUID id, UpdateCompanyRequest request);

    CompanyResponse activate(UUID id);

    CompanyResponse suspend(UUID id);
}
