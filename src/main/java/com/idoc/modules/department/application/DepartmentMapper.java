package com.idoc.modules.department.application;

import com.idoc.modules.department.application.dto.DepartmentResponse;
import com.idoc.modules.department.domain.Department;

final class DepartmentMapper {
    private DepartmentMapper() {
    }

    static DepartmentResponse toResponse(Department d) {
        return new DepartmentResponse(d.getId(), d.getCode(), d.getName(), d.getDivision());
    }
}
