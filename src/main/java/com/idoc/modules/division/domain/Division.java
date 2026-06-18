package com.idoc.modules.division.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** ฝ่าย — tenant-scoped, code running ต่อบริษัท */
@Entity
@Table(name = "org_division")
@Getter
@NoArgsConstructor
public class Division extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    public static Division create(UUID companyId, String code, String name) {
        Division d = new Division();
        d.companyId = companyId;
        d.code = code;
        d.name = name;
        return d;
    }

    public void updateDetails(String name) {
        if (name != null && !name.isBlank()) this.name = name;
    }
}
