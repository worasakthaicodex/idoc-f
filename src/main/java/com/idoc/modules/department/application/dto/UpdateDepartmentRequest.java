package com.idoc.modules.department.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDepartmentRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 120) String division
) {
}
