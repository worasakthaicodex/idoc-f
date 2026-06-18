package com.idoc.modules.department.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** แผนก — tenant-scoped, code running ต่อบริษัท, สังกัดฝ่าย (เก็บชื่อฝ่าย) */
@Entity
@Table(name = "org_department")
@Getter
@NoArgsConstructor
public class Department extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 120)
    private String division;

    public static Department create(UUID companyId, String code, String name, String division) {
        Department d = new Department();
        d.companyId = companyId;
        d.code = code;
        d.name = name;
        d.division = division;
        return d;
    }

    public void updateDetails(String name, String division) {
        if (name != null && !name.isBlank()) this.name = name;
        this.division = division;
    }
}
