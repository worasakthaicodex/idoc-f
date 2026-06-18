package com.idoc.modules.companymodule.web;

import com.idoc.modules.companymodule.application.CompanyModuleService;
import com.idoc.modules.companymodule.application.dto.CompanyModuleResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** โมดูลที่บริษัทเปิดไว้ — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/company-modules")
@RequiredArgsConstructor
public class CompanyModuleController {

    private final CompanyModuleService companyModuleService;

    @GetMapping
    public List<CompanyModuleResponse> list() {
        return companyModuleService.listForCurrentTenant();
    }
}
