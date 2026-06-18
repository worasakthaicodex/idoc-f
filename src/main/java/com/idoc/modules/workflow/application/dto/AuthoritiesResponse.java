package com.idoc.modules.workflow.application.dto;

import java.util.List;
import java.util.Map;

public record AuthoritiesResponse(
        String docType,
        List<Map<String, Object>> authorities
) {
}
