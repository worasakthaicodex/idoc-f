package com.idoc.modules.customer.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** การแชร์ตะกร้าให้ผู้ใช้คนหนึ่ง (sharedWith = รหัสพนักงาน) */
@Entity
@Table(name = "basket_share")
@Getter
@Setter
@NoArgsConstructor
public class BasketShare extends BaseEntity {

    @Column(name = "basket_id", nullable = false)
    private UUID basketId;

    @Column(name = "shared_with", nullable = false, length = 80)
    private String sharedWith;
}
