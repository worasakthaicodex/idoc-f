package com.idoc.modules.company.application.dto;

import com.idoc.modules.company.domain.CompanyPlan;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record UpdateCompanyRequest(
        @Size(max = 200) String name,
        @Email @Size(max = 200) String contactEmail,
        CompanyPlan plan,
        LocalDate expiresAt
) {
}
