package com.idoc.modules.sales.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesDocumentRepository extends JpaRepository<SalesDocument, UUID> {

    List<SalesDocument> findByCompanyIdAndDocTypeOrderBySavedAtDesc(UUID companyId, String docType);

    /** เฉพาะของลูกค้ารายนี้ (ใช้ index idx_sales_doc_cust) — สำหรับหน้า customer ไม่ต้องดึงทั้งตาราง */
    List<SalesDocument> findByCompanyIdAndDocTypeAndCustomerRefOrderBySavedAtDesc(
            UUID companyId, String docType, String customerRef);

    /** งานที่ยัง active (ไม่ใช่ DONE) — ดึงครบ */
    List<SalesDocument> findByCompanyIdAndDocTypeAndPhaseNotOrderBySavedAtDesc(
            UUID companyId, String docType, String phase);

    /** เฉพาะเฟสเดียว (เช่น RECEIVE สำหรับ poll แจ้งเตือน) — ปกติมีไม่กี่ใบ */
    List<SalesDocument> findByCompanyIdAndDocTypeAndPhaseOrderBySavedAtDesc(
            UUID companyId, String docType, String phase);

    /* ===== กรอง "ของฉัน" (owner) ที่ backend — superset ของ inPhase ฝั่งหน้า:
       เจ้าของ/ผู้ขาย/ผู้สร้าง/ผู้ร่วม/ผู้รับ/ผู้ส่ง/อยู่ในรายชื่อผู้รับ + งานรับเข้าแบบ broadcast (ไม่ระบุผู้รับ)
       → คนไม่มีงานจะได้ ~0 ใบ ไม่ต้องโหลดทั้งบริษัทมากรองหน้าเว็บ ===== */
    String OWNER_PRED =
            " and ( s.telesale = :owner"
            + " or s.data->>'salesperson' = :owner"
            + " or s.data->>'createdBy' = :owner"
            + " or s.data->>'participants' like ('%' || :owner || '%')"
            + " or s.meta->'received'->>'by' = :owner"
            + " or s.meta->'sent'->>'by' = :owner"
            + " or jsonb_exists(coalesce(s.meta->'sent'->'recipients','[]'::jsonb), :owner)"
            + " or (s.phase = 'RECEIVE' and jsonb_array_length(coalesce(s.meta->'sent'->'recipients','[]'::jsonb)) = 0) )";

    @Query(value = "select * from sales_document s where s.company_id = :tenant and s.doc_type = :docType"
            + OWNER_PRED + " and s.phase <> 'DONE' order by s.saved_at desc", nativeQuery = true)
    List<SalesDocument> findActiveByOwner(@Param("tenant") UUID tenant,
                                          @Param("docType") String docType,
                                          @Param("owner") String owner);

    /** ของฉัน + เฟสเดียว (เช่น RECEIVE รอรับ) — กรองระดับ SQL ให้ payload จิ๋ว (รอรับมีน้อยมาก) */
    @Query(value = "select * from sales_document s where s.company_id = :tenant and s.doc_type = :docType"
            + OWNER_PRED + " and s.phase = :phase order by s.saved_at desc", nativeQuery = true)
    List<SalesDocument> findByOwnerAndPhase(@Param("tenant") UUID tenant,
                                            @Param("docType") String docType,
                                            @Param("owner") String owner,
                                            @Param("phase") String phase);

    @Query(value = "select * from sales_document s where s.company_id = :tenant and s.doc_type = :docType"
            + OWNER_PRED + " and s.phase = 'DONE' order by s.saved_at desc", nativeQuery = true)
    List<SalesDocument> findDoneByOwner(@Param("tenant") UUID tenant,
                                        @Param("docType") String docType,
                                        @Param("owner") String owner,
                                        org.springframework.data.domain.Pageable pageable);

    /** DONE ล่าสุดตาม limit (Pageable) — งานปิดแล้วไม่ต้องส่งทั้งหมด ลด egress */
    List<SalesDocument> findByCompanyIdAndDocTypeAndPhaseOrderBySavedAtDesc(
            UUID companyId, String docType, String phase, Pageable pageable);

    /** รหัสลูกค้าที่เคยมีเอกสารใด ๆ (ใช้แยก "เคยติดต่อ" สำหรับตัดเกรด) */
    @Query("select distinct s.customerRef from SalesDocument s where s.companyId = :companyId and s.customerRef is not null")
    List<String> findDistinctCustomerRefByCompanyId(@Param("companyId") UUID companyId);

    Optional<SalesDocument> findByCompanyIdAndDocTypeAndCode(UUID companyId, String docType, String code);

    long countByCompanyIdAndDocTypeAndCodeStartingWith(UUID companyId, String docType, String codePrefix);

    void deleteByCompanyIdAndDocTypeAndCode(UUID companyId, String docType, String code);
}
