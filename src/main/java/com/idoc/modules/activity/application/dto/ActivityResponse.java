package com.idoc.modules.activity.application.dto;

import com.idoc.modules.activity.domain.ActivityStatus;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ActivityResponse(
        UUID id,
        String kind,
        String subjectType,
        String subjectCode,
        String parentType,
        String parentCode,
        String customerCode,
        Instant occurredAt,
        String createdBy,
        Map<String, String> payload,
        ActivityStatus status,
        Instant voidedAt,
        Instant createdAt
) {
}
