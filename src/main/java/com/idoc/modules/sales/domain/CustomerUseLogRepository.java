package com.idoc.modules.sales.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerUseLogRepository extends JpaRepository<CustomerUseLog, UUID> {

    boolean existsByCompanyIdAndClCodeAndCustomerCode(UUID companyId, String clCode, String customerCode);

    /** นับจำนวนรอบที่เคยใช้ ต่อรหัสลูกค้า (สำหรับชุดรหัสที่สนใจ) → [customerCode, count] */
    @Query("select u.customerCode, count(u) from CustomerUseLog u where u.companyId = :cid and u.customerCode in :codes group by u.customerCode")
    List<Object[]> countByCodes(@Param("cid") UUID companyId, @Param("codes") List<String> codes);
}
