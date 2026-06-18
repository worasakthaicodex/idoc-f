package com.idoc.modules.user.application;

import com.idoc.modules.company.api.CompanyApi;
import com.idoc.modules.user.application.dto.CreateEmployeeRequest;
import com.idoc.modules.user.application.dto.EmployeeResponse;
import com.idoc.modules.user.application.dto.UpdateEmployeeRequest;
import com.idoc.modules.user.domain.CompanySequence;
import com.idoc.modules.user.domain.CompanySequenceRepository;
import com.idoc.modules.user.domain.Employee;
import com.idoc.modules.user.domain.EmployeeRepository;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.tenant.TenantContext;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final CompanySequenceRepository sequenceRepository;
    private final CompanyApi companyApi;   // คุยข้าม module ผ่าน api เท่านั้น
    private final PasswordEncoder passwordEncoder;

    @Override
    public EmployeeResponse create(CreateEmployeeRequest request) {
        UUID tenant = TenantContext.required();

        // กฎข้าม module: บริษัทต้องพร้อมใช้งาน
        if (!companyApi.isActive(tenant)) {
            throw new BusinessException("บริษัทนี้ไม่พร้อมใช้งาน (ถูกระงับ/หมดอายุ)");
        }
        if (request.email() != null && employeeRepository.existsByCompanyIdAndEmail(tenant, request.email())) {
            throw new BusinessException("อีเมล '%s' มีในบริษัทนี้แล้ว".formatted(request.email()));
        }

        String code = nextEmployeeCode(tenant);
        Employee e = Employee.create(tenant, code, EmployeeMapper.profile(request), request.role());
        if (request.password() != null && !request.password().isBlank()) {
            e.setLoginPassword(passwordEncoder.encode(request.password()));  // ทำให้ login ด้วยอีเมลได้
        }
        e.setGoogleEnabled(Boolean.TRUE.equals(request.googleEnabled()));
        e.setAttributes(request.attributes());
        return EmployeeMapper.toResponse(employeeRepository.save(e));
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponse get(UUID id) {
        return EmployeeMapper.toResponse(findScoped(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<EmployeeResponse> list(Pageable pageable) {
        return employeeRepository.findByCompanyId(TenantContext.required(), pageable)
                .map(EmployeeMapper::toResponse);
    }

    @Override
    public EmployeeResponse update(UUID id, UpdateEmployeeRequest request) {
        Employee e = findScoped(id);
        e.updateProfile(EmployeeMapper.profile(request), request.role());
        if (request.password() != null && !request.password().isBlank()) {
            e.setLoginPassword(passwordEncoder.encode(request.password()));   // ตั้ง/เปลี่ยนรหัส → login ด้วยอีเมลได้
        }
        e.setGoogleEnabled(Boolean.TRUE.equals(request.googleEnabled()));
        e.setAttributes(request.attributes());
        return EmployeeMapper.toResponse(e);
    }

    @Override
    public EmployeeResponse disable(UUID id) {
        Employee e = findScoped(id);
        e.disable();
        return EmployeeMapper.toResponse(e);
    }

    @Override
    public EmployeeResponse enable(UUID id) {
        Employee e = findScoped(id);
        e.enable();
        return EmployeeMapper.toResponse(e);
    }

    @Override
    public void delete(UUID id) {
        Employee e = findScoped(id);
        if (e.getRole() == com.idoc.modules.user.domain.EmployeeRole.COMPANY_OWNER) {
            throw new BusinessException("ลบบัญชีเจ้าของบริษัทไม่ได้");
        }
        employeeRepository.delete(e);
    }

    /** หาเฉพาะในบริษัทของผู้ใช้ — ถ้า id อยู่บริษัทอื่นจะเป็น 404 (ไม่รั่วว่ามีอยู่จริง) */
    private Employee findScoped(UUID id) {
        return employeeRepository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Employee", id));
    }

    /** ออกรหัสพนักงานแบบรันต่อบริษัท: EMP-00001, EMP-00002, ... (เริ่ม 1 ทุกบริษัท) */
    private String nextEmployeeCode(UUID tenant) {
        CompanySequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new CompanySequence(tenant)));
        long n = seq.nextEmployee();
        return "EMP-%05d".formatted(n);
    }
}
