package com.idoc.modules.appmodule.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateModuleRequest(
        @Size(max = 60) String code,        // ว่างได้ → ใช้ name เป็น code
        @NotBlank @Size(max = 120) String name,
        @Size(max = 120) String nameEn,
        Integer sortOrder
) {
}
