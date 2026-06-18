package com.idoc.modules.activity.application.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.Map;

/** companyId มาจาก tenant context · occurredAt ว่าง = เวลาปัจจุบัน */
public record CreateActivityRequest(
        @NotBlank String kind,
        String subjectType,
        String subjectCode,
        String parentType,
        String parentCode,
        String customerCode,
        Instant occurredAt,
        String createdBy,
        Map<String, String> payload
) {
}
