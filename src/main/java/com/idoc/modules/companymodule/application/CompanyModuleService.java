package com.idoc.modules.companymodule.application;

import com.idoc.modules.companymodule.application.dto.CompanyModuleResponse;
import java.util.List;

public interface CompanyModuleService {

    /** โมดูลที่บริษัทปัจจุบัน (tenant) เปิดไว้ — ยังไม่เคยตั้งค่า = ถือว่าเปิดทุกโมดูลในแคตตาล็อก */
    List<CompanyModuleResponse> listForCurrentTenant();
}
