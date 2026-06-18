package com.idoc.modules.product.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** ทุก query scope ด้วย companyId เสมอ (กันข้อมูลข้ามบริษัท) */
public interface ProductRepository extends JpaRepository<Product, UUID>, ProductRepositoryCustom {

    Page<Product> findByCompanyId(UUID companyId, Pageable pageable);

    Optional<Product> findByIdAndCompanyId(UUID id, UUID companyId);

    long countByCompanyId(UUID companyId);

    @Modifying
    @Query("delete from Product p where p.status = :status and p.pendingDeleteAt is not null and p.pendingDeleteAt < :cutoff")
    int purgePendingDeleteBefore(@Param("status") ProductStatus status, @Param("cutoff") Instant cutoff);
}
