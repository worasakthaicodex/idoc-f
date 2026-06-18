package com.idoc.modules.product.application.dto;

import com.idoc.modules.product.domain.ProductStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record UpdateProductRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 120) String groupName,
        ProductStatus status,
        Map<String, String> attributes,
        String changedBy
) {
}
