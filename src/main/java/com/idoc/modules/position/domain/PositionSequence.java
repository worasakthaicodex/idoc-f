package com.idoc.modules.position.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** ตัวนับรหัสตำแหน่ง "แยกต่อบริษัท" — 1 แถวต่อ 1 บริษัท (เริ่มรหัสที่ 1 ทุกบริษัท) */
@Entity
@Table(name = "position_sequence")
@Getter
@NoArgsConstructor
public class PositionSequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "position_seq", nullable = false)
    private long positionSeq;

    public PositionSequence(UUID companyId) {
        this.companyId = companyId;
        this.positionSeq = 0;
    }

    public long nextPosition() {
        return ++this.positionSeq;
    }
}
