package com.idoc.modules.user.application;

import com.idoc.modules.company.api.CompanyApi;
import com.idoc.modules.company.api.CompanyView;
import com.idoc.modules.platform.api.PlatformAccountApi;
import com.idoc.modules.platform.api.PlatformAccountView;
import com.idoc.modules.user.application.dto.AuthResponse;
import com.idoc.modules.user.application.dto.LoginRequest;
import com.idoc.modules.position.domain.PositionRepository;
import com.idoc.modules.user.domain.Employee;
import com.idoc.modules.user.domain.EmployeeRepository;
import com.idoc.shared.exception.BusinessException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * เข้าสู่ระบบด้วยอีเมล — จุดเดียวที่ค้น "ทั้งระบบ" (ยังไม่รู้ tenant)
 *
 * สิทธิ์ 3 ระดับ:
 *  - เจ้าของระบบ (platform_account)  → login ด้วย Google เท่านั้น
 *  - เจ้าของบริษัท (employee COMPANY_OWNER) → login ด้วย Google (ของจริง)
 *  - พนักงาน (employee STAFF)        → login ด้วยอีเมล/รหัสผ่าน
 *
 * หมายเหตุ: ของจริงจะบังคับ Google สำหรับเจ้าของระบบ/เจ้าของบริษัท
 * ตอนนี้ /login (รหัสผ่าน) ยังเปิดให้ employee ที่ตั้งรหัสผ่านไว้ใช้ได้ จนกว่าจะต่อ Google OAuth จริง
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class LoginServiceImpl implements LoginService {

    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final CompanyApi companyApi;
    private final PlatformAccountApi platformAccountApi;
    private final PositionRepository positionRepository;

    @Override
    public AuthResponse login(LoginRequest request) {
        // 1) เจ้าของระบบด้วยรหัสผ่าน (dev — ของจริงจะบังคับ Google)
        Optional<PlatformAccountView> owner =
                platformAccountApi.verifyPassword(request.email(), request.password());
        if (owner.isPresent()) {
            PlatformAccountView o = owner.get();
            return AuthResponse.platformOwner(o.id(), o.fullName(), o.email());
        }

        // 2) พนักงานบริษัทด้วยอีเมล/รหัสผ่าน
        Employee user = employeeRepository
                .findFirstByEmailAndPasswordHashIsNotNull(request.email())
                .orElseThrow(() -> new BusinessException("auth.invalid_credentials", "Incorrect email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("auth.invalid_credentials", "Incorrect email or password");
        }
        return employeeAuth(user);
    }

    @Override
    public AuthResponse loginWithGoogle(String email) {
        // 1) เจ้าของระบบก่อน (ระดับแพลตฟอร์ม ไม่ผูกบริษัท)
        Optional<PlatformAccountView> owner = platformAccountApi.findActiveGoogleByEmail(email);
        if (owner.isPresent()) {
            PlatformAccountView o = owner.get();
            return AuthResponse.platformOwner(o.id(), o.fullName(), o.email());
        }

        // 2) ผู้ใช้ในบริษัท (เจ้าของบริษัท/พนักงาน) ที่เปิด Google
        Employee user = employeeRepository
                .findFirstByEmailAndGoogleEnabledTrue(email)
                .orElseThrow(() -> new BusinessException("auth.gmail_not_enabled", "This email is not enabled for Gmail sign-in"));
        return employeeAuth(user);
    }

    private AuthResponse employeeAuth(Employee user) {
        CompanyView company = companyApi.findById(user.getCompanyId())
                .orElseThrow(() -> new BusinessException("company.not_found", "No company found for this user"));
        if (!company.active()) {
            throw new BusinessException("company.suspended", "This company has been suspended");
        }
        return new AuthResponse(
                user.getRole().name(), user.getId(), user.getFullName(), user.getEmail(),
                company.id(), company.code(), company.name(), user.getCode(),
                resolveModules(user));
    }

    /** สิทธิ์เข้าโมดูลของพนักงาน = จากตำแหน่ง (ชื่อ) ในบริษัทเดียวกัน → map moduleCode → LEVEL */
    private Map<String, String> resolveModules(Employee user) {
        String posName = user.getPosition();
        if (posName == null || posName.isBlank()) return Map.of();
        return positionRepository.findByCompanyIdOrderByName(user.getCompanyId()).stream()
                .filter(p -> posName.equals(p.getName())).findFirst()
                .map(p -> parseModules(p.getModules())).orElse(Map.of());
    }

    private static Map<String, String> parseModules(String csv) {
        Map<String, String> out = new LinkedHashMap<>();
        if (csv == null || csv.isBlank()) return out;
        for (String tok : csv.split(",")) {
            String t = tok.trim();
            if (t.isEmpty()) continue;
            int i = t.indexOf(':');
            if (i < 0) out.put(t, "USER");
            else out.put(t.substring(0, i).trim(), t.substring(i + 1).trim());
        }
        return out;
    }
}
