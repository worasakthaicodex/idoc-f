package com.idoc.modules.sales.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClPullLogRepository extends JpaRepository<ClPullLog, UUID> {

    List<ClPullLog> findByCompanyIdAndClCodeOrderByCreatedAtDesc(UUID companyId, String clCode);

    long deleteByCompanyIdAndClCode(UUID companyId, String clCode);

    @Modifying
    @Query("update ClPullLog l set l.clCode = :nw where l.companyId = :cid and l.clCode = :old")
    int relabel(@Param("cid") UUID companyId, @Param("old") String oldCode, @Param("nw") String newCode);
}
