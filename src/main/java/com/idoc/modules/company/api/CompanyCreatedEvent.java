package com.idoc.modules.company.api;

import java.util.UUID;

/**
 * Domain event — บริษัทใหม่ถูกสร้าง
 * module อื่น (เช่น user) ฟังเพื่อทำงานต่อ เช่น สร้างบัญชีเจ้าของบริษัทอัตโนมัติ
 */
public record CompanyCreatedEvent(UUID companyId, String code, String name, String contactEmail) {
}
