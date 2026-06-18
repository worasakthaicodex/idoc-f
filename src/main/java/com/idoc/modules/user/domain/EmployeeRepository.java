package com.idoc.modules.user.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** ทุก query scope ด้วย companyId เสมอ (กันข้อมูลข้ามบริษัท) */
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    Page<Employee> findByCompanyId(UUID companyId, Pageable pageable);

    Optional<Employee> findByIdAndCompanyId(UUID id, UUID companyId);

    boolean existsByCompanyIdAndEmail(UUID companyId, String email);

    long countByCompanyId(UUID companyId);

    /** ใช้ตอน login เท่านั้น — หาผู้ใช้ด้วยอีเมล "ทั้งระบบ" (ไม่ scope tenant เพราะยังไม่รู้บริษัท) */
    Optional<Employee> findFirstByEmailAndPasswordHashIsNotNull(String email);

    /** login ด้วย Gmail — เฉพาะคนที่เปิด google_enabled */
    Optional<Employee> findFirstByEmailAndGoogleEnabledTrue(String email);
}
