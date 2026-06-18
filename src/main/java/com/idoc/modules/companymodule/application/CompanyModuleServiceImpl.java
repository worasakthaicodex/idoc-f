package com.idoc.modules.companymodule.application;

import com.idoc.modules.appmodule.application.AppModuleService;
import com.idoc.modules.companymodule.application.dto.CompanyModuleResponse;
import com.idoc.modules.companymodule.domain.CompanyModuleRepository;
import com.idoc.shared.tenant.TenantContext;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CompanyModuleServiceImpl implements CompanyModuleService {

    private final CompanyModuleRepository repository;
    private final AppModuleService appModuleService; // fallback: แคตตาล็อกกลาง เมื่อบริษัทยังไม่เคยตั้งค่า

    @Override
    public List<CompanyModuleResponse> listForCurrentTenant() {
        UUID tenant = TenantContext.required();
        List<CompanyModuleResponse> rows = repository.findByCompanyId(tenant).stream()
                .map(m -> new CompanyModuleResponse(m.getModuleCode(), m.isActive(), m.getExpiresAt()))
                .toList();
        if (!rows.isEmpty()) return rows;
        // ยังไม่เคยตั้งค่า → ถือว่าเปิดทุกโมดูลที่ active ในแคตตาล็อก (กันบล็อกบริษัทเก่า/ใหม่)
        return appModuleService.list(false).stream()
                .map(m -> new CompanyModuleResponse(m.code(), true, null))
                .toList();
    }
}
