package com.idoc.modules.department.application;

import com.idoc.modules.department.application.dto.CreateDepartmentRequest;
import com.idoc.modules.department.application.dto.DepartmentResponse;
import com.idoc.modules.department.application.dto.UpdateDepartmentRequest;
import java.util.List;
import java.util.UUID;

public interface DepartmentService {
    List<DepartmentResponse> list();

    DepartmentResponse get(UUID id);

    DepartmentResponse create(CreateDepartmentRequest request);

    DepartmentResponse update(UUID id, UpdateDepartmentRequest request);

    void delete(UUID id);
}
