package com.idoc.modules.user.application;

import com.idoc.modules.user.application.dto.CreateEmployeeRequest;
import com.idoc.modules.user.application.dto.EmployeeResponse;
import com.idoc.modules.user.application.dto.UpdateEmployeeRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** use cases ของพนักงาน — ทุกตัว scope กับบริษัทของผู้ใช้ปัจจุบัน (TenantContext) อัตโนมัติ */
public interface EmployeeService {

    EmployeeResponse create(CreateEmployeeRequest request);

    EmployeeResponse get(UUID id);

    Page<EmployeeResponse> list(Pageable pageable);

    EmployeeResponse update(UUID id, UpdateEmployeeRequest request);

    EmployeeResponse disable(UUID id);

    EmployeeResponse enable(UUID id);

    /** ลบพนักงานถาวร (ห้ามลบเจ้าของบริษัท) */
    void delete(UUID id);
}
