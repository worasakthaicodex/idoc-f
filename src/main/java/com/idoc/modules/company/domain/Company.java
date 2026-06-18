package com.idoc.modules.company.domain;

import com.idoc.shared.domain.BaseEntity;
import com.idoc.shared.exception.BusinessException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Company = บริษัทที่มาเช่าใช้ระบบ (tenant) — เป็นตารางระดับแพลตฟอร์ม (ไม่ scope ตาม tenant)
 * โดเมนถือกฎการเปลี่ยนสถานะไว้ในตัวเอง (rich behavior) ไม่ปล่อยให้ service set ตรง ๆ
 */
@Entity
@Table(name = "company")
@Getter
@NoArgsConstructor
public class Company extends BaseEntity {

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CompanyStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CompanyPlan plan;

    @Column(name = "contact_email", length = 200)
    private String contactEmail;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    /** factory: สร้างบริษัทใหม่ เริ่มที่สถานะ TRIAL */
    public static Company create(String code, String name, String contactEmail, CompanyPlan plan) {
        Company c = new Company();
        c.code = code;
        c.name = name;
        c.contactEmail = contactEmail;
        c.plan = plan != null ? plan : CompanyPlan.FREE;
        c.status = CompanyStatus.TRIAL;
        return c;
    }

    public void updateDetails(String name, String contactEmail, CompanyPlan plan, LocalDate expiresAt) {
        if (name != null && !name.isBlank()) this.name = name;
        this.contactEmail = contactEmail;
        if (plan != null) this.plan = plan;
        this.expiresAt = expiresAt;
    }

    public void activate() {
        if (this.status == CompanyStatus.ACTIVE) {
            throw new BusinessException("บริษัทนี้ใช้งานอยู่แล้ว");
        }
        this.status = CompanyStatus.ACTIVE;
    }

    public void suspend() {
        if (this.status == CompanyStatus.SUSPENDED) {
            throw new BusinessException("บริษัทนี้ถูกระงับอยู่แล้ว");
        }
        this.status = CompanyStatus.SUSPENDED;
    }

    public boolean isActive() {
        return this.status == CompanyStatus.ACTIVE || this.status == CompanyStatus.TRIAL;
    }
}
