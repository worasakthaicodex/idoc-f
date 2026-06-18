package com.idoc.modules.sales.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Log การดึงรายชื่อลงตะกร้า CL — ใคร/เมื่อไร/วิธีไหน/กี่ราย */
@Entity
@Table(name = "cl_pull_log")
@Getter
@Setter
@NoArgsConstructor
public class ClPullLog extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "cl_code", nullable = false, length = 40)
    private String clCode;

    @Column(nullable = false, length = 20)
    private String method;   // FILTER | GROUP

    @Column(length = 300)
    private String detail;

    @Column(nullable = false)
    private int cnt;

    @Column(name = "pulled_by", length = 200)
    private String pulledBy;
}
