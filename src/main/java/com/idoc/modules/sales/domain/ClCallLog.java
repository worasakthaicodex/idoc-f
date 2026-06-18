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

/** ผลการโทรของรายชื่อในชุด CL (worklist) — 1 แถวต่อ 1 ครั้งที่โทร */
@Entity
@Table(name = "cl_call_log")
@Getter
@Setter
@NoArgsConstructor
public class ClCallLog extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "cl_code", nullable = false, length = 40)
    private String clCode;

    @Column(name = "customer_code", nullable = false, length = 60)
    private String customerCode;

    /** รหัสผล: INTERESTED / CALLBACK / NOANSWER / REJECTED / TO_FO */
    @Column(nullable = false, length = 40)
    private String result;

    @Column
    private Integer minutes;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "called_by", length = 160)
    private String calledBy;

    @Column(name = "called_at", nullable = false)
    private Instant calledAt = Instant.now();
}
