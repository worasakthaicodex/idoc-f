package com.idoc.modules.user.web;

import com.idoc.modules.user.application.EmployeeService;
import com.idoc.modules.user.application.dto.CreateEmployeeRequest;
import com.idoc.modules.user.application.dto.EmployeeResponse;
import com.idoc.modules.user.application.dto.UpdateEmployeeRequest;
import com.idoc.shared.access.AccessGuard;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller บาง — tenant มาจาก header X-Company-Id (ผ่าน TenantFilter -> TenantContext)
 * ไม่มี logic / ไม่รับ companyId จาก client
 */
@RestController
@RequestMapping("/api/admin/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    public Page<EmployeeResponse> list(Pageable pageable) {
        return employeeService.list(pageable);
    }

    @GetMapping("/{id}")
    public EmployeeResponse get(@PathVariable UUID id) {
        return employeeService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeResponse create(@Valid @RequestBody CreateEmployeeRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return employeeService.create(request);
    }

    @PutMapping("/{id}")
    public EmployeeResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateEmployeeRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return employeeService.update(id, request);
    }

    @PostMapping("/{id}/disable")
    public EmployeeResponse disable(@PathVariable UUID id) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return employeeService.disable(id);
    }

    @PostMapping("/{id}/enable")
    public EmployeeResponse enable(@PathVariable UUID id) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return employeeService.enable(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        employeeService.delete(id);
    }
}
