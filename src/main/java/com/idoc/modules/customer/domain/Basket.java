package com.idoc.modules.customer.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** ตะกร้ารายชื่อลูกค้า — ของผู้ใช้คนหนึ่ง (owner) ในบริษัทหนึ่ง */
@Entity
@Table(name = "basket")
@Getter
@Setter
@NoArgsConstructor
public class Basket extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(nullable = false, length = 80)
    private String owner;

    @Column(nullable = false, length = 120)
    private String name;

    /** เหตุผล/คำอธิบายรวมของทั้งตะกร้า */
    @Column(length = 500)
    private String note;

    /** ผูกกับเอกสาร (เช่น CL) — null = ตะกร้า wishlist ทั่วไปของผู้ใช้ */
    @Column(name = "ref_type", length = 20)
    private String refType;

    @Column(name = "ref_code", length = 40)
    private String refCode;
}
