package com.idoc.modules.customer.application;

import com.idoc.modules.company.api.CompanyApi;
import com.idoc.modules.customer.application.dto.CreateCustomerRequest;
import com.idoc.modules.customer.application.dto.CustomerResponse;
import com.idoc.modules.customer.application.dto.UpdateCustomerRequest;
import com.idoc.modules.customer.domain.Customer;
import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.customer.domain.CustomerSequence;
import com.idoc.modules.customer.domain.CustomerSequenceRepository;
import com.idoc.modules.customer.domain.CustomerStatus;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupCount;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.GroupMembers;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.SalesBuckets;
import com.idoc.modules.revision.api.RevisionApi;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.tenant.TenantContext;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class CustomerServiceImpl implements CustomerService {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    private static final String ENTITY = "CUSTOMER";

    private final CustomerRepository customerRepository;
    private final CustomerSequenceRepository sequenceRepository;
    private final CompanyApi companyApi;     // คุยข้าม module ผ่าน api เท่านั้น
    private final RevisionApi revisionApi;   // บันทึกประวัติ/เวอร์ชัน ผ่าน api
    private final CustomerInsightCache insightCache;   // cache สรุป/รายงาน (ล้างเมื่อข้อมูลลูกค้าเปลี่ยน)

    @Override
    public CustomerResponse create(CreateCustomerRequest request) {
        UUID tenant = TenantContext.required();
        if (!companyApi.isActive(tenant)) {
            throw new BusinessException("บริษัทนี้ไม่พร้อมใช้งาน (ถูกระงับ/หมดอายุ)");
        }
        String code = nextCustomerCode(tenant);
        Customer c = Customer.create(tenant, code, request.name(), request.groupName());
        c.setStatus(request.status());   // null = คง ACTIVE
        c.setAttributes(request.attributes());
        customerRepository.save(c);
        revisionApi.record(ENTITY, c.getId(), c.getCode(), "CREATE", request.changedBy(), snapshot(c));
        insightCache.invalidate(tenant);   // ลูกค้าใหม่ → ยอดกลุ่ม/บัคเก็ต/รายงานเปลี่ยน
        return CustomerMapper.toResponse(c);
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse get(UUID id) {
        return CustomerMapper.toResponse(findScoped(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerResponse> search(String q, Map<String, String> filters, List<String> statusIn, Pageable pageable) {
        return customerRepository.search(TenantContext.required(), q, filters, statusIn, pageable)
                .map(CustomerMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CustomerResponse> lookup(String q, int limit) {
        return customerRepository.lookup(TenantContext.required(), q, limit)
                .stream().map(CustomerMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<GroupCount>> groupCounts(String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf) {
        UUID tenant = TenantContext.required();
        Integer m = sinceContactMonths, d = calendarDays;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }  // ทั้งหมด = ไม่กรอง readiness
        String nb = notInBasketOf == null || notInBasketOf.isBlank() ? null : notInBasketOf;
        final Integer fm = m, fd = d;
        return insightCache.get("groupCounts", ready + "|" + m + "|" + d + "|" + nb, () -> {
            Map<String, List<GroupCount>> out = new LinkedHashMap<>();
            out.put("groupName", customerRepository.groupCounts(tenant, "groupName", ready, fm, fd, nb));
            out.put("grade", customerRepository.groupCounts(tenant, "grade", ready, fm, fd, nb));
            out.put("businessType", customerRepository.groupCounts(tenant, "businessType", ready, fm, fd, nb));
            return out;
        });
    }

    @Override
    @Transactional(readOnly = true)
    public GroupMembers groupMembers(String field, String value, String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf) {
        Integer m = sinceContactMonths, d = calendarDays;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        String nb = notInBasketOf == null || notInBasketOf.isBlank() ? null : notInBasketOf;
        return customerRepository.groupMembers(TenantContext.required(), field, value, ready, m, d, nb, 60);
    }

    @Override
    @Transactional(readOnly = true)
    public SalesBuckets salesBuckets(int years, String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf) {
        Integer m = sinceContactMonths, d = calendarDays;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        String nb = notInBasketOf == null || notInBasketOf.isBlank() ? null : notInBasketOf;
        int yrs = years < 1 ? 5 : years;
        final Integer fm = m, fd = d;
        return insightCache.get("salesBuckets", yrs + "|" + ready + "|" + m + "|" + d + "|" + nb,
                () -> customerRepository.salesBuckets(TenantContext.required(), yrs, ready, fm, fd, nb));
    }

    @Override
    @Transactional(readOnly = true)
    public GroupMembers bucketMembers(String bucket, Integer year, String field, String value,
                                      String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf) {
        Integer m = sinceContactMonths, d = calendarDays;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        String nb = notInBasketOf == null || notInBasketOf.isBlank() ? null : notInBasketOf;
        return customerRepository.bucketMembers(TenantContext.required(), bucket, year, field, value, ready, m, d, nb, 60);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupCount> bucketBreakdown(String bucket, Integer year, String field,
                                            String ready, Integer sinceContactMonths, Integer calendarDays, String notInBasketOf) {
        Integer m = sinceContactMonths, d = calendarDays;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        String nb = notInBasketOf == null || notInBasketOf.isBlank() ? null : notInBasketOf;
        return customerRepository.bucketBreakdown(TenantContext.required(), bucket, year, field, ready, m, d, nb);
    }

    @Override
    @Transactional(readOnly = true)
    public List<com.idoc.modules.customer.domain.CustomerRepositoryCustom.MovementRow> recentMovements(int limit) {
        // /customer/active = 200 ล่าสุดต่อหัว · เปลี่ยนเฉพาะตอนมีกิจกรรม/เคลื่อนไหว (activity/sales/calendar/customer)
        // ซึ่ง write path เหล่านั้น invalidate(companyId) ล้างทั้งถังอยู่แล้ว → entry นี้สดเสมอ
        return insightCache.get("recentMovements", String.valueOf(limit),
                () -> customerRepository.recentMovements(TenantContext.required(), limit));
    }

    @Override
    public CustomerResponse update(UUID id, UpdateCustomerRequest request) {
        Customer c = findScoped(id);
        c.updateProfile(request.name(), request.groupName());
        c.setStatus(request.status());
        c.setAttributes(request.attributes());
        revisionApi.record(ENTITY, c.getId(), c.getCode(), "UPDATE", request.changedBy(), snapshot(c));
        insightCache.invalidate(c.getCompanyId());   // กลุ่ม/เกรด/สถานะ/แอตทริบิวต์เปลี่ยน → ยอดเปลี่ยน
        return CustomerMapper.toResponse(c);
    }

    @Override
    public CustomerResponse revert(UUID id, UUID revisionId, String changedBy) {
        Customer c = findScoped(id);
        Map<String, Object> snap = revisionApi.snapshot(revisionId);
        c.updateProfile(str(snap.get("name")), str(snap.get("groupName")));
        Object st = snap.get("status");
        if (st != null) c.setStatus(CustomerStatus.valueOf(st.toString()));
        Map<String, String> attrs = new HashMap<>();
        if (snap.get("attributes") instanceof Map<?, ?> m) {
            m.forEach((k, v) -> attrs.put(String.valueOf(k), v == null ? null : String.valueOf(v)));
        }
        c.setAttributes(attrs);
        revisionApi.record(ENTITY, c.getId(), c.getCode(), "REVERT", changedBy, snapshot(c));
        insightCache.invalidate(c.getCompanyId());   // ย้อนเวอร์ชัน → ยอดเปลี่ยน
        return CustomerMapper.toResponse(c);
    }

    /** snapshot ฟิลด์ที่ย้อนกลับได้ของลูกค้า (เก็บลงประวัติ) */
    private Map<String, Object> snapshot(Customer c) {
        Map<String, Object> s = new HashMap<>();
        s.put("name", c.getName());
        s.put("groupName", c.getGroupName());
        s.put("status", c.getStatus().name());
        s.put("attributes", c.getAttributes());
        return s;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    /** หาเฉพาะในบริษัทของผู้ใช้ — ถ้า id อยู่บริษัทอื่นจะเป็น 404 (ไม่รั่วว่ามีอยู่จริง) */
    private Customer findScoped(UUID id) {
        return customerRepository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Customer", id));
    }

    /** ออกรหัสลูกค้าแบบรันต่อบริษัท: REG{ปีเดือน}-{เลขรัน} เช่น REG202603-1 */
    private String nextCustomerCode(UUID tenant) {
        CustomerSequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new CustomerSequence(tenant)));
        long n = seq.nextCustomer();
        return "REG" + LocalDate.now().format(YM) + "-" + n;
    }
}
