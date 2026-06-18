package com.idoc.modules.position.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/** ไม่รับ code (ระบบออกให้) */
public record CreatePositionRequest(
        @NotBlank @Size(max = 120) String name,
        String description,
        List<ModulePermission> modules,
        @Size(max = 120) String department,
        @Size(max = 120) String division
) {
}
