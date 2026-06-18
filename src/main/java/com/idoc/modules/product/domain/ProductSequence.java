package com.idoc.modules.product.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** ตัวนับรหัสสินค้า "แยกต่อบริษัท" — 1 แถวต่อ 1 บริษัท (atomic ด้วยล็อกแถว) */
@Entity
@Table(name = "product_sequence")
@Getter
@NoArgsConstructor
public class ProductSequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "product_seq", nullable = false)
    private long productSeq;

    public ProductSequence(UUID companyId) {
        this.companyId = companyId;
        this.productSeq = 0;
    }

    public long nextProduct() {
        return ++this.productSeq;
    }
}
