package com.idoc.modules.companymodule.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * โมดูลที่บริษัทเปิด/ซื้อไว้ (ทะเบียนราย-บริษัท) — ใช้รู้ว่าโมดูลที่ต้องพึ่งพร้อมใช้ไหม
 * moduleCode อ้างอิง app_module.code · expiresAt = null คือไม่มีวันหมดอายุ
 */
@Entity
@Table(name = "company_module", uniqueConstraints = @UniqueConstraint(name = "uq_company_module", columnNames = {"company_id", "module_code"}))
@Getter
@NoArgsConstructor
public class CompanyModule extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "module_code", nullable = false, length = 60)
    private String moduleCode;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    public static CompanyModule create(UUID companyId, String moduleCode, boolean active, LocalDate expiresAt) {
        CompanyModule m = new CompanyModule();
        m.companyId = companyId;
        m.moduleCode = moduleCode;
        m.active = active;
        m.expiresAt = expiresAt;
        return m;
    }

    public void update(boolean active, LocalDate expiresAt) {
        this.active = active;
        this.expiresAt = expiresAt;
    }
}
