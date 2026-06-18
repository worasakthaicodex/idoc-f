package com.idoc.modules.customer.application.dto;

import com.idoc.modules.customer.domain.CustomerStatus;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record CustomerResponse(
        UUID id,
        UUID companyId,
        String code,
        String name,
        CustomerStatus status,
        String groupName,
        Map<String, String> attributes,
        Instant createdAt
) {
}
