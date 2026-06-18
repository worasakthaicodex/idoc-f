package com.idoc.modules.division.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** ตัวนับรหัสฝ่ายต่อบริษัท (เริ่ม 1 ทุกบริษัท) */
@Entity
@Table(name = "division_sequence")
@Getter
@NoArgsConstructor
public class DivisionSequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "division_seq", nullable = false)
    private long divisionSeq;

    public DivisionSequence(UUID companyId) {
        this.companyId = companyId;
        this.divisionSeq = 0;
    }

    public long nextDivision() {
        return ++this.divisionSeq;
    }
}
