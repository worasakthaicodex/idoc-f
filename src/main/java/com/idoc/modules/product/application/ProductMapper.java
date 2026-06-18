package com.idoc.modules.product.application;

import com.idoc.modules.product.application.dto.ProductResponse;
import com.idoc.modules.product.domain.Product;

final class ProductMapper {

    private ProductMapper() {
    }

    static ProductResponse toResponse(Product p) {
        return new ProductResponse(
                p.getId(), p.getCompanyId(), p.getCode(), p.getName(), p.getStatus(),
                p.getGroupName(), p.getAttributes(), p.getCreatedAt());
    }
}
