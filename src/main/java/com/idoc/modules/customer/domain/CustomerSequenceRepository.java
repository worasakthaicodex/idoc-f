package com.idoc.modules.customer.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerSequenceRepository extends JpaRepository<CustomerSequence, UUID> {

    /** ล็อกแถว (PESSIMISTIC_WRITE) ระหว่าง transaction กันแย่งเลขกัน */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CustomerSequence s where s.companyId = :companyId")
    Optional<CustomerSequence> findForUpdate(@Param("companyId") UUID companyId);
}
