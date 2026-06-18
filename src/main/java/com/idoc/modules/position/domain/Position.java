package com.idoc.modules.position.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ตำแหน่งงาน — ถือ "สิทธิ์เข้าโมดูล" ไว้ที่ตัวเอง (พนักงานได้สิทธิ์ตามตำแหน่ง)
 * code = รหัสตำแหน่งที่คนเห็น (running ต่อบริษัท เริ่ม 1) — ไม่ใช่ PK
 * modules เก็บเป็นรายชื่อโมดูลคั่นด้วย comma
 * department / division = ข้อความ (ยังไม่ผูก entity จริง)
 */
@Entity
@Table(name = "job_position")
@Getter
@NoArgsConstructor
public class Position extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, length = 500)
    private String modules = "";

    @Column(length = 120)
    private String department;

    @Column(length = 120)
    private String division;

    public static Position create(UUID companyId, String code, String name, String description,
                                  String modulesCsv, String department, String division) {
        Position p = new Position();
        p.companyId = companyId;
        p.code = code;
        p.name = name;
        p.description = description;
        p.modules = modulesCsv != null ? modulesCsv : "";
        p.department = department;
        p.division = division;
        return p;
    }

    public void updateDetails(String name, String description, String modulesCsv, String department, String division) {
        if (name != null && !name.isBlank()) this.name = name;
        this.description = description;
        this.modules = modulesCsv != null ? modulesCsv : "";
        this.department = department;
        this.division = division;
    }
}
