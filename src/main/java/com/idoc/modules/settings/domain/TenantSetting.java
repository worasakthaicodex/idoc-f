package com.idoc.modules.settings.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ค่าตั้งค่าต่อบริษัทแบบ key-value · value = JSON text (เก็บอะไรก็ได้: array/object/bool/string)
 * แปลง Object <-> JSON text ที่ service ด้วย ObjectMapper (พกพาได้ ไม่ผูก Jackson เวอร์ชัน)
 */
@Entity
@Table(name = "tenant_setting")
@Getter
@NoArgsConstructor
public class TenantSetting extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "skey", nullable = false, length = 120)
    private String skey;

    @Column(name = "value", columnDefinition = "text", nullable = false)
    private String value;

    public static TenantSetting create(UUID companyId, String skey, String value) {
        TenantSetting s = new TenantSetting();
        s.companyId = companyId;
        s.skey = skey;
        s.value = value;
        return s;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
