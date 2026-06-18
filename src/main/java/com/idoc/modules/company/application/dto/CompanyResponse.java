package com.idoc.modules.company.application.dto;

import com.idoc.modules.company.domain.CompanyPlan;
import com.idoc.modules.company.domain.CompanyStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CompanyResponse(
        UUID id,
        String code,
        String name,
        CompanyStatus status,
        CompanyPlan plan,
        String contactEmail,
        LocalDate expiresAt,
        Instant createdAt
) {
}
