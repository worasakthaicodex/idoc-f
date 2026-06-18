package com.idoc.modules.customer.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** ทุก query scope ด้วย companyId เสมอ (กันข้อมูลข้ามบริษัท) ยกเว้นงาน purge ที่เป็น system-level */
public interface CustomerRepository extends JpaRepository<Customer, UUID>, CustomerRepositoryCustom {

    Page<Customer> findByCompanyId(UUID companyId, Pageable pageable);

    /** ลูกค้าทั้งหมดของบริษัท (ใช้โดยงานตัดเกรด) */
    List<Customer> findByCompanyId(UUID companyId);

    Optional<Customer> findByIdAndCompanyId(UUID id, UUID companyId);

    long countByCompanyId(UUID companyId);

    /** โหลดลูกค้าตามรหัส (worklist CL) — เอา attributes (เบอร์/อีเมล/ผู้ติดต่อ) ไปแสดง */
    List<Customer> findByCompanyIdAndCodeIn(UUID companyId, Collection<String> codes);

    /** purge ลูกค้าที่ตั้งสถานะ PENDING_DELETE เกิน cutoff — ข้ามทุกบริษัท */
    @Modifying
    @Query("delete from Customer c where c.status = :status and c.pendingDeleteAt is not null and c.pendingDeleteAt < :cutoff")
    int purgePendingDeleteBefore(@Param("status") CustomerStatus status, @Param("cutoff") Instant cutoff);
}
