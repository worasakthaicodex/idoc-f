package com.idoc.modules.position.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PositionSequenceRepository extends JpaRepository<PositionSequence, UUID> {

    /** ล็อกแถว (PESSIMISTIC_WRITE) ระหว่าง transaction กันแย่งเลขกัน */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from PositionSequence s where s.companyId = :companyId")
    Optional<PositionSequence> findForUpdate(@Param("companyId") UUID companyId);
}
