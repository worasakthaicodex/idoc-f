package com.idoc.modules.platform.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAccountRepository extends JpaRepository<PlatformAccount, UUID> {

    /** ใช้ตอน login — หาเจ้าของระบบด้วยอีเมล (ระดับแพลตฟอร์ม ไม่ scope tenant) */
    Optional<PlatformAccount> findFirstByEmail(String email);
}
