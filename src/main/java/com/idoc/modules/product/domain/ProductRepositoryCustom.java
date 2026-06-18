package com.idoc.modules.product.domain;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** ค้นหาสินค้า/บริการแบบไดนามิก (ค้นจริงที่ DB) — q = ค้นง่าย, filters = ค้นเต็มพิกัดรายฟิลด์ */
public interface ProductRepositoryCustom {
    Page<Product> search(UUID companyId, String q, Map<String, String> filters, Pageable pageable);

    /** ค้นเร็วสำหรับ dropdown — prefix (ส่วนหน้า) ของรหัส/ชื่อ ใช้ index ได้ ไม่สแกน attributes */
    List<Product> lookup(UUID companyId, String q, int limit);
}
