package com.idoc.modules.companymodule.application.dto;

import java.time.LocalDate;

/** โมดูลที่บริษัทเปิดไว้ 1 รายการ (moduleCode อ้าง app_module.code) */
public record CompanyModuleResponse(String moduleCode, boolean active, LocalDate expiresAt) {
}
