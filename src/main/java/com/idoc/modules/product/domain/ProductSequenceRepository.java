package com.idoc.modules.product.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductSequenceRepository extends JpaRepository<ProductSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ProductSequence s where s.companyId = :companyId")
    Optional<ProductSequence> findForUpdate(@Param("companyId") UUID companyId);
}
