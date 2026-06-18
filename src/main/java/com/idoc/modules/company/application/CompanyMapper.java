package com.idoc.modules.company.application;

import com.idoc.modules.company.api.CompanyView;
import com.idoc.modules.company.application.dto.CompanyResponse;
import com.idoc.modules.company.domain.Company;

/** แปลง entity ↔ dto (ไม่มี logic ทางธุรกิจ) */
final class CompanyMapper {

    private CompanyMapper() {
    }

    static CompanyResponse toResponse(Company c) {
        return new CompanyResponse(
                c.getId(),
                c.getCode(),
                c.getName(),
                c.getStatus(),
                c.getPlan(),
                c.getContactEmail(),
                c.getExpiresAt(),
                c.getCreatedAt()
        );
    }

    static CompanyView toView(Company c) {
        return new CompanyView(c.getId(), c.getCode(), c.getName(), c.isActive());
    }
}
