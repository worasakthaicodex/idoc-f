package com.idoc.modules.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ตัวนับรหัสพนักงาน "แยกต่อบริษัท" — 1 แถวต่อ 1 บริษัท
 * เพิ่มทีละ 1 แบบล็อกแถว (atomic) เพื่อให้รหัสไม่ชน/ไม่กระโดด
 */
@Entity
@Table(name = "company_sequence")
@Getter
@NoArgsConstructor
public class CompanySequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "employee_seq", nullable = false)
    private long employeeSeq;

    public CompanySequence(UUID companyId) {
        this.companyId = companyId;
        this.employeeSeq = 0;
    }

    public long nextEmployee() {
        return ++this.employeeSeq;
    }
}
