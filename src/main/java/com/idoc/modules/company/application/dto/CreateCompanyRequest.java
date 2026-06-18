package com.idoc.modules.company.application.dto;

import com.idoc.modules.company.domain.CompanyPlan;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCompanyRequest(
        @NotBlank @Size(max = 40) String code,
        @NotBlank @Size(max = 200) String name,
        @Email @Size(max = 200) String contactEmail,
        CompanyPlan plan
) {
}
