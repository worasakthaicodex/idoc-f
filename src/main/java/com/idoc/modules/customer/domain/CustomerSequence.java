package com.idoc.modules.customer.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * ตัวนับรหัสลูกค้า "แยกต่อบริษัท" — 1 แถวต่อ 1 บริษัท
 * เพิ่มทีละ 1 แบบล็อกแถว (atomic) เพื่อให้รหัสไม่ชน/ไม่กระโดด
 */
@Entity
@Table(name = "customer_sequence")
@Getter
@NoArgsConstructor
public class CustomerSequence {

    @Id
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "customer_seq", nullable = false)
    private long customerSeq;

    public CustomerSequence(UUID companyId) {
        this.companyId = companyId;
        this.customerSeq = 0;
    }

    public long nextCustomer() {
        return ++this.customerSeq;
    }
}
