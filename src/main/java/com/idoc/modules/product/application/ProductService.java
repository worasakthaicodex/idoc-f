package com.idoc.modules.product.application;

import com.idoc.modules.product.application.dto.CreateProductRequest;
import com.idoc.modules.product.application.dto.ProductResponse;
import com.idoc.modules.product.application.dto.UpdateProductRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** use cases ของสินค้า/บริการ — ทุกตัว scope กับบริษัทของผู้ใช้ปัจจุบัน (TenantContext) อัตโนมัติ */
public interface ProductService {

    ProductResponse create(CreateProductRequest request);

    ProductResponse get(UUID id);

    /** ค้นหาจริงที่ DB (เฉพาะ ACTIVE) — q = ค้นง่าย, filters = ค้นเต็มพิกัดรายฟิลด์ */
    Page<ProductResponse> search(String q, Map<String, String> filters, Pageable pageable);

    /** ค้นเร็วสำหรับ dropdown — prefix รหัส/ชื่อ (ส่วนหน้า) ใช้ index ได้ รองรับสินค้าจำนวนมาก */
    List<ProductResponse> lookup(String q, int limit);

    ProductResponse update(UUID id, UpdateProductRequest request);

    /** ลบถาวร (ใช้กรณีเพิ่งเพิ่มไม่เกิน 3 วัน) — เกินนั้นให้ตั้งสถานะ PENDING_DELETE แทน */
    void delete(UUID id);

    /** ย้อนกลับข้อมูลไปยังเวอร์ชันที่เลือก */
    ProductResponse revert(UUID id, UUID revisionId, String changedBy);
}
