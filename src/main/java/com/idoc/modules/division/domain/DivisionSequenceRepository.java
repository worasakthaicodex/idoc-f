package com.idoc.modules.division.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DivisionSequenceRepository extends JpaRepository<DivisionSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from DivisionSequence s where s.companyId = :companyId")
    Optional<DivisionSequence> findForUpdate(@Param("companyId") UUID companyId);
}
