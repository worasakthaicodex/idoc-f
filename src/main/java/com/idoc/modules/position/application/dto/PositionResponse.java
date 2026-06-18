package com.idoc.modules.position.application.dto;

import java.util.List;
import java.util.UUID;

public record PositionResponse(
        UUID id,
        String code,
        String name,
        String description,
        List<ModulePermission> modules,
        String department,
        String division
) {
}
