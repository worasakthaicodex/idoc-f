package com.idoc.shared.notify;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * แจ้งเตือนที่เขียนไว้ตอนมีเหตุการณ์จริง (ส่งเอกสาร/ปิดการขายได้) ถึงผู้รับรายคน
 * อ่านย้อนหลังได้ · realtime ผ่าน SSE ตอนเปิดหน้าอยู่ · ไม่ต้อง poll
 */
@Entity
@Table(name = "notification")
@Getter
@Setter
@NoArgsConstructor
public class Notification extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 255)
    private String recipient;

    @Column(nullable = false, length = 40)
    private String kind;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 500)
    private String body;

    @Column(name = "ref_type", length = 20)
    private String refType;

    @Column(name = "ref_code", length = 40)
    private String refCode;

    @Column(name = "by_user", length = 255)
    private String byUser;

    @Column(name = "read_at")
    private Instant readAt;
}
