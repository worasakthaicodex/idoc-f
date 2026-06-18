package com.idoc.modules.sales.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** ลูกค้าถูกนำไปใช้ในชุด CL ที่ทำจนจบ — 1 แถวต่อ (ลูกค้า, ชุด) */
@Entity
@Table(name = "customer_use_log")
@Getter
@Setter
@NoArgsConstructor
public class CustomerUseLog extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "customer_code", nullable = false, length = 60)
    private String customerCode;

    @Column(name = "cl_code", nullable = false, length = 40)
    private String clCode;

    @Column(name = "used_at", nullable = false)
    private Instant usedAt = Instant.now();
}
