package com.idoc.modules.customer.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** รายการในตะกร้า — ลูกค้า 1 รายต่อตะกร้า (ไม่ซ้ำ) */
@Entity
@Table(name = "basket_item")
@Getter
@Setter
@NoArgsConstructor
public class BasketItem extends BaseEntity {

    @Column(name = "basket_id", nullable = false)
    private UUID basketId;

    @Column(name = "customer_ref", nullable = false, length = 60)
    private String customerRef;

    @Column(name = "added_at", nullable = false)
    private Instant addedAt = Instant.now();

    /** เหตุผลที่นำลูกค้ารายนี้ใส่ตะกร้า */
    @Column(length = 255)
    private String reason;

    /** วันที่ต้องหยิบออกจากตะกร้า (deadline) */
    @Column(name = "remove_by")
    private LocalDate removeBy;
}
