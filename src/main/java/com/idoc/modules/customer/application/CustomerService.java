package com.idoc.modules.customer.application;

import com.idoc.modules.customer.application.dto.CreateCustomerRequest;
import com.idoc.modules.customer.application.dto.CustomerResponse;
import com.idoc.modules.customer.application.dto.UpdateCustomerRequest;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupCount;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupMembers;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.SalesBuckets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** use cases ของลูกค้า — ทุกตัว scope กับบริษัทของผู้ใช้ปัจจุบัน (TenantContext) อัตโนมัติ */
public interface CustomerService {

    CustomerResponse create(CreateCustomerRequest request);

    CustomerResponse get(UUID id);

    /** ค้นหาจริงที่ DB (เฉพาะ ACTIVE) — q = ค้นง่าย, filters = ค้นเต็มพิกัดรายฟิลด์ */
    Page<CustomerResponse> search(String q, Map<String, String> filters, List<String> statusIn, Pageable pageable);

    /** ค้นหาเร็วสำหรับ dropdown/autocomplete — prefix รหัส/ชื่อ (ส่วนหน้า) ใช้ index ได้ รองรับลูกค้าจำนวนมาก */
    List<CustomerResponse> lookup(String q, int limit);

    CustomerResponse update(UUID id, UpdateCustomerRequest request);

    /** ย้อนกลับข้อมูลลูกค้าไปยังเวอร์ชันที่เลือก */
    CustomerResponse revert(UUID id, UUID revisionId, String changedBy);

    /** นับลูกค้าต่อกลุ่ม (groupName/grade/businessType) ที่ DB — กรอง "พร้อมใช้" ตาม ready/months/days
     *  notInBasketOf != null → นับเฉพาะคนที่ยังไม่อยู่ในตะกร้าที่ผู้ใช้นั้นเห็น (ของตัวเอง/แชร์มา) */
    Map<String, List<GroupCount>> groupCounts(String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf);

    /** ตัวอย่างสมาชิกของกลุ่มหนึ่ง (head…tail) สำหรับ popup */
    GroupMembers groupMembers(String field, String value, String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf);

    /** สรุป "ตามงานขาย" (FO/QT/SO รายปี + ติดต่อ/ใหม่/ปฏิทินข้างหน้า) — กรอง "พร้อมใช้" + ตัดตะกร้าที่ฉันเห็นได้ */
    SalesBuckets salesBuckets(int years, String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf);

    /** สมาชิกของ bucket "ตามงานขาย" (เจาะลึกตามกลุ่มได้ด้วย field+value) */
    GroupMembers bucketMembers(String bucket, Integer year, String field, String value,
                               String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf);

    /** แยกย่อย bucket ตามกลุ่ม (field) — นับลูกค้าต่อค่ากลุ่มภายใน bucket */
    List<GroupCount> bucketBreakdown(String bucket, Integer year, String field,
                                     String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf);

    /** ลูกค้า (ACTIVE) ที่เคลื่อนไหวล่าสุด (Tool/เอกสาร/ปฏิทิน) — N รายล่าสุด */
    List<com.idoc.modules.customer.domain.CustomerRepositoryCustom.MovementRow> recentMovements(int limit);
}
