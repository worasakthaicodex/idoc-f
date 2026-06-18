package com.idoc.modules.department.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepartmentSequenceRepository extends JpaRepository<DepartmentSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from DepartmentSequence s where s.companyId = :companyId")
    Optional<DepartmentSequence> findForUpdate(@Param("companyId") UUID companyId);
}
