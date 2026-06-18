package com.idoc.modules.platform.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * PlatformAccount = เจ้าของระบบ (platform owner) — ระดับแพลตฟอร์ม ไม่ผูกบริษัทใด ๆ
 *
 * แยกออกจาก Employee (ผู้ใช้ในบริษัท/tenant) อย่างชัดเจน:
 *  - เจ้าของระบบดูแลทั้งแพลตฟอร์ม (ทะเบียนบริษัท ฯลฯ) ไม่ได้สังกัดบริษัทเดียว
 *  - เข้าสู่ระบบด้วย Google เท่านั้น (ไม่มีรหัสผ่าน)
 */
@Entity
@Table(name = "platform_account")
@Getter
@NoArgsConstructor
public class PlatformAccount extends BaseEntity {

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PlatformAccountStatus status;

    /** เจ้าของระบบ login ด้วย Gmail (Google) — เปิดไว้โดย default */
    @Column(name = "google_enabled", nullable = false)
    private boolean googleEnabled = true;

    /**
     * bcrypt hash — null = login ด้วยรหัสผ่านไม่ได้ (Google-only)
     * ของจริงควรเป็น null (บังคับ Google) — เปิดรหัสผ่านไว้เฉพาะ dev ในเครื่อง
     */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    public static PlatformAccount create(String email, String fullName) {
        PlatformAccount a = new PlatformAccount();
        a.email = email;
        a.fullName = fullName;
        a.status = PlatformAccountStatus.ACTIVE;
        a.googleEnabled = true;
        return a;
    }

    public boolean isActive() {
        return this.status == PlatformAccountStatus.ACTIVE;
    }

    /** ตั้งรหัสผ่าน (hash แล้ว) → ให้ login ด้วยอีเมล/รหัสผ่านได้ (dev) */
    public void setLoginPassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }
}
