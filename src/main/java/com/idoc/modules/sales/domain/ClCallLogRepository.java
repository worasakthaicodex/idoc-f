package com.idoc.modules.sales.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClCallLogRepository extends JpaRepository<ClCallLog, UUID> {

    /** ผลการโทรทั้งหมดของชุด CL (ใหม่ → เก่า) — group ต่อรายคนที่ฝั่ง service */
    List<ClCallLog> findByCompanyIdAndClCodeOrderByCalledAtDesc(UUID companyId, String clCode);
}
