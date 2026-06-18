package com.idoc.modules.customer.application;

import com.idoc.modules.settings.domain.TenantSetting;
import com.idoc.modules.settings.domain.TenantSettingRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * งานตัดเกรดลูกค้าอัตโนมัติ — รันรายวัน ตรวจทุกบริษัทที่ตั้งค่า "crm.grade.config" ไว้
 * บริษัทไหนครบรอบ (cutMonths) ก็ตัดเกรดให้ แล้วบันทึก lastCutAt กลับลง setting
 * (เป็น opt-in: เฉพาะบริษัทที่เปิดหน้า "การตัดเกรดลูกค้า" แล้วกดบันทึกการตั้งค่า)
 */
@Component
@RequiredArgsConstructor
public class GradeCutJob {

    private static final Logger log = LoggerFactory.getLogger(GradeCutJob.class);

    private final TenantSettingRepository settingRepository;
    private final GradeCutService gradeCutService;
    private final ObjectMapper objectMapper;

    /** ทุกวัน 03:30 */
    @Scheduled(cron = "0 30 3 * * *")
    public void runDueGradeCuts() {
        for (TenantSetting s : settingRepository.findBySkey(GradeConfig.KEY)) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = objectMapper.readValue(s.getValue(), Map.class);
                GradeConfig cfg = GradeConfig.from(m);
                if (!cfg.isDue()) continue;

                int changed = gradeCutService.cutForCompany(s.getCompanyId(), cfg);

                m.put("lastCutAt", System.currentTimeMillis());
                s.setValue(objectMapper.writeValueAsString(m));
                settingRepository.save(s);
                log.info("grade-cut: company {} → changed {} customers (cycle {} months)",
                        s.getCompanyId(), changed, cfg.cutMonths());
            } catch (Exception e) {
                log.warn("grade-cut failed for company {}: {}", s.getCompanyId(), e.getMessage());
            }
        }
    }
}
