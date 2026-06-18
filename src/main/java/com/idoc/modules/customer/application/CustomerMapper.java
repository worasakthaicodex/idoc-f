package com.idoc.modules.customer.application;

import com.idoc.modules.customer.application.dto.CustomerResponse;
import com.idoc.modules.customer.domain.Customer;

final class CustomerMapper {

    private CustomerMapper() {
    }

    static CustomerResponse toResponse(Customer c) {
        return new CustomerResponse(
                c.getId(), c.getCompanyId(), c.getCode(), c.getName(), c.getStatus(),
                c.getGroupName(), c.getAttributes(), c.getCreatedAt());
    }
}
