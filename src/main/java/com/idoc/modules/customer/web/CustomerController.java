package com.idoc.modules.customer.web;

import com.idoc.modules.customer.application.CustomerService;
import com.idoc.modules.customer.application.dto.CreateCustomerRequest;
import com.idoc.modules.customer.application.dto.CustomerResponse;
import com.idoc.modules.customer.application.dto.UpdateCustomerRequest;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupCount;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupMembers;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.MovementRow;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.SalesBuckets;
import com.idoc.shared.access.AccessGuard;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller บาง — tenant มาจาก header X-Company-Id (ผ่าน TenantFilter -> TenantContext)
 * ไม่มี logic / ไม่รับ companyId จาก client
 */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    /**
     * ค้นหา/รายการลูกค้า (ค้นจริงที่ DB) — q = ค้นง่าย, พารามิเตอร์อื่น ๆ = ค้นเต็มพิกัดรายฟิลด์
     * (page/size/sort เป็นของ Pageable — ตัดออกจาก filters)
     */
    @GetMapping
    public Page<CustomerResponse> list(@RequestParam(required = false) String q,
                                       @RequestParam(required = false) String statusIn,
                                       @RequestParam Map<String, String> params,
                                       Pageable pageable) {
        Map<String, String> filters = new HashMap<>(params);
        filters.remove("q");
        filters.remove("statusIn");
        filters.remove("page");
        filters.remove("size");
        filters.remove("sort");
        List<String> statuses = statusIn == null || statusIn.isBlank() ? null
                : java.util.Arrays.stream(statusIn.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
        return customerService.search(q, filters, statuses, pageable);
    }

    /** ค้นหาเร็วสำหรับ dropdown (prefix รหัส/ชื่อ ส่วนหน้า) — ใช้กับ autocomplete เลือกลูกค้า รองรับลูกค้าจำนวนมาก */
    @GetMapping("/lookup")
    public List<CustomerResponse> lookup(@RequestParam(required = false) String q,
                                         @RequestParam(defaultValue = "20") int limit) {
        return customerService.lookup(q, limit);
    }

    /** นับลูกค้าต่อกลุ่ม (groupName/grade/businessType) ที่ DB — รองรับลูกค้าจำนวนมาก + กรอง "พร้อมใช้" */
    @GetMapping("/group-counts")
    public Map<String, List<GroupCount>> groupCounts(
            @RequestParam(defaultValue = "all") String ready,
            @RequestParam(required = false) Integer sinceContactMonths,
            @RequestParam(required = false) Integer calendarDays,
            @RequestParam(required = false) String notInBasketOf) {
        return customerService.groupCounts(ready, sinceContactMonths, calendarDays, notInBasketOf);
    }

    /** ตัวอย่างสมาชิกของกลุ่ม (head…tail) — สำหรับ popup ตอนกด chip */
    @GetMapping("/group-members")
    public GroupMembers groupMembers(@RequestParam String field, @RequestParam String value,
                                     @RequestParam(defaultValue = "all") String ready,
                                     @RequestParam(required = false) Integer sinceContactMonths,
                                     @RequestParam(required = false) Integer calendarDays,
                                     @RequestParam(required = false) String notInBasketOf) {
        return customerService.groupMembers(field, value, ready, sinceContactMonths, calendarDays, notInBasketOf);
    }

    /** สรุป "ตามงานขาย" — FO/QT/SO รายปี (ย้อนหลัง years) + ติดต่อ/ใหม่/ปฏิทินข้างหน้า · กรอง "พร้อมใช้" ได้ */
    @GetMapping("/sales-buckets")
    public SalesBuckets salesBuckets(@RequestParam(defaultValue = "5") int years,
                                     @RequestParam(defaultValue = "all") String ready,
                                     @RequestParam(required = false) Integer sinceContactMonths,
                                     @RequestParam(required = false) Integer calendarDays,
                                     @RequestParam(required = false) String notInBasketOf) {
        return customerService.salesBuckets(years, ready, sinceContactMonths, calendarDays, notInBasketOf);
    }

    /** สมาชิกของ bucket "ตามงานขาย" (สำหรับ popup · เจาะลึกตามกลุ่มได้ด้วย field+value) */
    @GetMapping("/bucket-members")
    public GroupMembers bucketMembers(@RequestParam String bucket, @RequestParam(required = false) Integer year,
                                      @RequestParam(required = false) String field, @RequestParam(required = false) String value,
                                      @RequestParam(defaultValue = "all") String ready,
                                      @RequestParam(required = false) Integer sinceContactMonths,
                                      @RequestParam(required = false) Integer calendarDays,
                                      @RequestParam(required = false) String notInBasketOf) {
        return customerService.bucketMembers(bucket, year, field, value, ready, sinceContactMonths, calendarDays, notInBasketOf);
    }

    /** แยกย่อย bucket ตามกลุ่ม (สำหรับ popup ขั้นแรก) */
    @GetMapping("/bucket-breakdown")
    public List<GroupCount> bucketBreakdown(@RequestParam String bucket, @RequestParam(required = false) Integer year,
                                            @RequestParam String field,
                                            @RequestParam(defaultValue = "all") String ready,
                                            @RequestParam(required = false) Integer sinceContactMonths,
                                            @RequestParam(required = false) Integer calendarDays,
                                            @RequestParam(required = false) String notInBasketOf) {
        return customerService.bucketBreakdown(bucket, year, field, ready, sinceContactMonths, calendarDays, notInBasketOf);
    }

    /** ลูกค้า (ACTIVE) ที่เคลื่อนไหวล่าสุด (Tool/เอกสาร CL·FO·QT·SO/ปฏิทิน) — รายการ N รายล่าสุด */
    @GetMapping("/recent-movements")
    public List<MovementRow> recentMovements(@RequestParam(defaultValue = "200") int limit) {
        return customerService.recentMovements(limit);
    }

    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable UUID id) {
        return customerService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse create(@Valid @RequestBody CreateCustomerRequest request) {
        AccessGuard.requireAdmin(AccessGuard.CUSTOMER);
        return customerService.create(request);
    }

    @PutMapping("/{id}")
    public CustomerResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateCustomerRequest request) {
        AccessGuard.requireAdmin(AccessGuard.CUSTOMER);
        return customerService.update(id, request);
    }

    @PostMapping("/{id}/revert/{revisionId}")
    public CustomerResponse revert(@PathVariable UUID id, @PathVariable UUID revisionId,
                                   @RequestParam(required = false) String by) {
        AccessGuard.requireAdmin(AccessGuard.CUSTOMER);
        return customerService.revert(id, revisionId, by);
    }
}
