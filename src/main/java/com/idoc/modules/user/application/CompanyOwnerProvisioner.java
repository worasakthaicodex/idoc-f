package com.idoc.modules.user.application;

import com.idoc.modules.company.api.CompanyCreatedEvent;
import com.idoc.modules.user.domain.CompanySequence;
import com.idoc.modules.user.domain.CompanySequenceRepository;
import com.idoc.modules.user.domain.Employee;
import com.idoc.modules.user.domain.EmployeeProfile;
import com.idoc.modules.user.domain.EmployeeRepository;
import com.idoc.modules.user.domain.EmployeeRole;
import com.idoc.shared.exception.BusinessException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * สร้าง "เจ้าของบริษัท" (COMPANY_OWNER) อัตโนมัติเมื่อมีบริษัทใหม่
 * — ให้รหัสผ่านเริ่มต้นไว้ก่อน (ช่วงยังไม่ต่อ Google) จะได้เอาไป login ทดสอบได้ทันที
 *
 * ฟังผ่าน domain event ตามกติกาข้าม module (ไม่เรียก service ของ company ตรง ๆ)
 */
@Component
@RequiredArgsConstructor
public class CompanyOwnerProvisioner {

    /** รหัสผ่านเริ่มต้นของเจ้าของบริษัทใหม่ (dev เท่านั้น — ควรเปลี่ยนหลัง login ครั้งแรก) */
    public static final String DEFAULT_PASSWORD = "idoc1234";

    private final EmployeeRepository employeeRepository;
    private final CompanySequenceRepository sequenceRepository;
    private final PasswordEncoder passwordEncoder;

    @EventListener
    @Transactional
    public void onCompanyCreated(CompanyCreatedEvent e) {
        String email = e.contactEmail();
        if (email == null || email.isBlank()) {
            return; // ไม่มีอีเมลผู้ดูแล = ไม่สร้างบัญชี login
        }
        // อีเมล login ต้องไม่ซ้ำทั้งระบบ
        if (employeeRepository.findFirstByEmailAndPasswordHashIsNotNull(email).isPresent()) {
            throw new BusinessException("อีเมล '%s' ถูกใช้เป็นบัญชีเข้าระบบแล้ว".formatted(email));
        }

        String code = nextEmployeeCode(e.companyId());
        EmployeeProfile profile = new EmployeeProfile(
                "ผู้ดูแล " + e.name(), null, null, "เจ้าของบริษัท",
                email, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null);

        Employee owner = Employee.create(e.companyId(), code, profile, EmployeeRole.COMPANY_OWNER);
        owner.setLoginPassword(passwordEncoder.encode(DEFAULT_PASSWORD));  // login ด้วยอีเมล/รหัสผ่าน
        owner.setGoogleEnabled(true);                                       // เปิด Gmail ไว้ด้วย (ของจริง)
        employeeRepository.save(owner);
    }

    /** ออกรหัสพนักงานแบบรันต่อบริษัท: EMP-00001, ... (ล็อกแถวกันเลขชน) */
    private String nextEmployeeCode(UUID tenant) {
        CompanySequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new CompanySequence(tenant)));
        return "EMP-%05d".formatted(seq.nextEmployee());
    }
}
