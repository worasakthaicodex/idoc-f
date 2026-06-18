package com.idoc.modules.company.web;

import com.idoc.modules.company.application.CompanyService;
import com.idoc.modules.company.application.dto.CompanyResponse;
import com.idoc.modules.company.application.dto.CreateCompanyRequest;
import com.idoc.modules.company.application.dto.UpdateCompanyRequest;
import com.idoc.modules.company.domain.CompanyStatus;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller บาง ๆ — แค่ map HTTP ↔ DTO แล้ว delegate ไป service
 * ไม่มี business logic ใด ๆ ที่นี่
 */
@RestController
@RequestMapping("/api/admin/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;

    @GetMapping
    public Page<CompanyResponse> list(
            @RequestParam(required = false) CompanyStatus status,
            Pageable pageable) {
        return companyService.list(status, pageable);
    }

    @GetMapping("/{id}")
    public CompanyResponse get(@PathVariable UUID id) {
        return companyService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyResponse create(@Valid @RequestBody CreateCompanyRequest request) {
        return companyService.create(request);
    }

    @PutMapping("/{id}")
    public CompanyResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateCompanyRequest request) {
        return companyService.update(id, request);
    }

    @PostMapping("/{id}/activate")
    public CompanyResponse activate(@PathVariable UUID id) {
        return companyService.activate(id);
    }

    @PostMapping("/{id}/suspend")
    public CompanyResponse suspend(@PathVariable UUID id) {
        return companyService.suspend(id);
    }
}
