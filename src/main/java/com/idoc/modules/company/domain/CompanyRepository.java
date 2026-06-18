package com.idoc.modules.company.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository (port) ของ Company — Spring Data JPA สร้าง implementation ให้ */
public interface CompanyRepository extends JpaRepository<Company, UUID> {

    boolean existsByCode(String code);

    Optional<Company> findByCode(String code);

    Page<Company> findByStatus(CompanyStatus status, Pageable pageable);
}
