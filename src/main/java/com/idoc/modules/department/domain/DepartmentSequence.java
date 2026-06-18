package com.idoc.modules.department.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** ตัวนับรหัสแผนกต่อบริษัท (เริ่ม 1 ทุกบริษัท) */
@Entity
@Table(name = "department_sequence")
@Getter
@NoArgsConstructor
public class DepartmentSequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "department_seq", nullable = false)
    private long departmentSeq;

    public DepartmentSequence(UUID companyId) {
        this.companyId = companyId;
        this.departmentSeq = 0;
    }

    public long nextDepartment() {
        return ++this.departmentSeq;
    }
}
