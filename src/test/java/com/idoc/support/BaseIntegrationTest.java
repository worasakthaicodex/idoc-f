package com.idoc.support;

import com.idoc.modules.company.application.CompanyService;
import com.idoc.modules.company.application.dto.CreateCompanyRequest;
import com.idoc.modules.company.domain.CompanyPlan;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * ฐานเทสต์ integration — รันบน Postgres จริง (ฐาน idoc_test) + Flyway migrate ครบ
 * เรียก API ผ่าน MockMvc พร้อม header X-Company-Id (จำลอง tenant)
 * เทสต์สร้างบริษัทใหม่ทุกครั้ง (รหัส random) เลยไม่ชนข้อมูลค้างจากรันก่อน
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class BaseIntegrationTest {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected CompanyService companyService;

    /** สร้างบริษัทใหม่ (สถานะ TRIAL = active) คืน id ใช้เป็น tenant */
    protected UUID newCompany(String code) {
        return companyService.create(new CreateCompanyRequest(code, code + " Co", code.toLowerCase() + "@test.co", CompanyPlan.FREE)).id();
    }

    protected static String rnd(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
