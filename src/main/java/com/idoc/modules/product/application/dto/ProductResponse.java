package com.idoc.modules.product.application.dto;

import com.idoc.modules.product.domain.ProductStatus;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        UUID companyId,
        String code,
        String name,
        ProductStatus status,
        String groupName,
        Map<String, String> attributes,
        Instant createdAt
) {
}
