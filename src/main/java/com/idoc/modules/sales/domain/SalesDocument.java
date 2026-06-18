package com.idoc.modules.sales.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * เอกสารงานขาย (CL/FO/QT/SO) — tenant-scoped (company_id) · 1 ตารางรวมทุกชนิด (แยกด้วย doc_type)
 *
 * ค่าฟิลด์ที่ configurable ทั้งหมดเก็บใน data (JSONB) · meta = received/bounce/sent
 * คอลัมน์อ้างอิง (customerRef/srcCl/srcFo/srcQt) ดึงจาก data ไว้ให้ระบบอื่น query สายเอกสารได้
 */
@Entity
@Table(name = "sales_document")
@Getter
@Setter
@NoArgsConstructor
public class SalesDocument extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "doc_type", nullable = false, length = 4)
    private String docType;

    @Column(nullable = false, length = 30)
    private String code;

    @Column(length = 255)
    private String title;

    @Column(length = 255)
    private String telesale;

    @Column(nullable = false, length = 20)
    private String phase;

    @Column(name = "stage_id", length = 64)
    private String stageId;

    @Column(name = "customer_ref", length = 60)
    private String customerRef;

    @Column(name = "src_cl", length = 30)
    private String srcCl;

    @Column(name = "src_fo", length = 30)
    private String srcFo;

    @Column(name = "src_qt", length = 30)
    private String srcQt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> data = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> meta = new HashMap<>();

    @Column(name = "saved_at")
    private Long savedAt;
}
