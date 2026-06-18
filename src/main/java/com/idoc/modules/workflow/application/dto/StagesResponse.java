package com.idoc.modules.workflow.application.dto;

import java.util.List;
import java.util.Map;

public record StagesResponse(
        String docType,
        List<Map<String, Object>> stages
) {
}
