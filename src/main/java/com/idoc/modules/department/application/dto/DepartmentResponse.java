package com.idoc.modules.department.application.dto;

import java.util.UUID;

public record DepartmentResponse(UUID id, String code, String name, String division) {
}
