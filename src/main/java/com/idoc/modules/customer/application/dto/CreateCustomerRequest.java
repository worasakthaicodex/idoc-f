package com.idoc.modules.customer.application.dto;

import com.idoc.modules.customer.domain.CustomerStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** ไม่รับ code (ระบบออกให้) และไม่รับ companyId (มาจาก tenant context) · status ว่าง = ACTIVE */
public record CreateCustomerRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 120) String groupName,
        CustomerStatus status,
        Map<String, String> attributes,
        String changedBy
) {
}
