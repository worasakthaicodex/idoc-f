package com.idoc.modules.user.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Employee = ผู้ใช้/พนักงานในบริษัทหนึ่ง — tenant-scoped (มี companyId)
 *
 * code = รหัสพนักงานที่คนเห็น (running ต่อบริษัท เริ่ม 1) — ไม่ใช่ PK
 * ฟิลด์ข้อมูลส่วนตัวเยอะ → แก้ผ่าน EmployeeProfile ทีเดียว
 */
@Entity
@Table(name = "employee")
@Getter
@NoArgsConstructor
public class Employee extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 20)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeStatus status;

    /** bcrypt hash — null = login ด้วยรหัสผ่านไม่ได้ */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    /** true = อนุญาตให้ login ด้วย Gmail (Google) ผ่านอีเมลนี้ */
    @Column(name = "google_enabled", nullable = false)
    private boolean googleEnabled = false;

    // ----- ทั่วไป -----
    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;
    private LocalDate birthday;
    @Column(name = "id_card", length = 30)
    private String idCard;
    @Column(length = 120)
    private String position;

    // ----- ติดต่อ -----
    @Column(length = 200)
    private String email;
    @Column(length = 30)
    private String tel;
    @Column(length = 30)
    private String mobile;
    @Column(length = 100)
    private String line;

    // ----- ที่อยู่ -----
    @Column(name = "house_number", length = 50)
    private String houseNumber;
    @Column(length = 100)
    private String building;
    @Column(length = 100)
    private String village;
    @Column(length = 100)
    private String alley;
    @Column(length = 100)
    private String road;
    @Column(name = "sub_district", length = 100)
    private String subDistrict;
    @Column(length = 100)
    private String province;
    @Column(length = 10)
    private String zip;
    @Column(columnDefinition = "text")
    private String address;
    @Column(name = "address_full", columnDefinition = "text")
    private String addressFull;   // ที่อยู่เต็มจากการค้นหา (ต./อ./จ./รหัสไปรษณีย์)

    // ----- เอกสาร/พาสปอร์ต -----
    @Column(name = "passport_no", length = 50)
    private String passportNo;
    @Column(name = "passport_date")
    private LocalDate passportDate;
    @Column(name = "passport_country", length = 100)
    private String passportCountry;
    @Column(name = "passport_district", length = 100)
    private String passportDistrict;

    /** ฟิลด์ configurable ที่ไม่มีคอลัมน์ตายตัว (prefix/gender/วุฒิ/ฉุกเฉิน/ภาษี ฯลฯ) เก็บเป็น JSONB */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> attributes = new HashMap<>();

    public static Employee create(UUID companyId, String code, EmployeeProfile p, EmployeeRole role) {
        Employee e = new Employee();
        e.companyId = companyId;
        e.code = code;
        e.role = role != null ? role : EmployeeRole.STAFF;
        e.status = EmployeeStatus.ACTIVE;
        e.apply(p);
        return e;
    }

    public void updateProfile(EmployeeProfile p, EmployeeRole role) {
        if (role != null) this.role = role;
        this.apply(p);
    }

    private void apply(EmployeeProfile p) {
        this.fullName = p.fullName();
        this.birthday = p.birthday();
        this.idCard = p.idCard();
        this.position = p.position();
        this.email = p.email();
        this.tel = p.tel();
        this.mobile = p.mobile();
        this.line = p.line();
        this.houseNumber = p.houseNumber();
        this.building = p.building();
        this.village = p.village();
        this.alley = p.alley();
        this.road = p.road();
        this.subDistrict = p.subDistrict();
        this.province = p.province();
        this.zip = p.zip();
        this.address = p.address();
        this.addressFull = p.addressFull();
        this.passportNo = p.passportNo();
        this.passportDate = p.passportDate();
        this.passportCountry = p.passportCountry();
        this.passportDistrict = p.passportDistrict();
    }

    public void disable() {
        this.status = EmployeeStatus.DISABLED;
    }

    public void enable() {
        this.status = EmployeeStatus.ACTIVE;
    }

    /** ตั้งรหัสผ่าน (hash แล้ว) → ทำให้ login ด้วยอีเมลได้ */
    public void setLoginPassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setGoogleEnabled(boolean enabled) {
        this.googleEnabled = enabled;
    }

    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes != null ? attributes : new HashMap<>();
    }
}
