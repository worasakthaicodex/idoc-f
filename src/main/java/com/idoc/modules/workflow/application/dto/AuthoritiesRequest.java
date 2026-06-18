package com.idoc.modules.workflow.application.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

public record AuthoritiesRequest(
        @NotBlank String docType,
        List<Map<String, Object>> authorities
) {
}
