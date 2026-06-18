package com.idoc.modules.settings.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantSettingRepository extends JpaRepository<TenantSetting, UUID> {

    List<TenantSetting> findByCompanyId(UUID companyId);

    Optional<TenantSetting> findByCompanyIdAndSkey(UUID companyId, String skey);

    /** ทุกบริษัทที่ตั้งค่า key นี้ไว้ (ใช้โดยงาน scheduled ข้ามบริษัท เช่น ตัดเกรด) */
    List<TenantSetting> findBySkey(String skey);
}
