package com.idoc.modules.appmodule.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateModuleRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 120) String nameEn,
        Integer sortOrder,
        Boolean active
) {
}
