package com.idoc.modules.activity.application;

import com.idoc.modules.activity.application.dto.ActivityResponse;
import com.idoc.modules.activity.application.dto.ContactSummary;
import com.idoc.modules.activity.application.dto.CreateActivityRequest;
import com.idoc.modules.activity.application.dto.UpdateActivityRequest;
import com.idoc.modules.activity.domain.Activity;
import com.idoc.modules.activity.domain.ActivityRepository;
import com.idoc.modules.customer.api.CustomerInsightApi;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.tenant.TenantContext;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class ActivityServiceImpl implements ActivityService {

    private final ActivityRepository activityRepository;
    private final CustomerInsightApi insightApi;   // กิจกรรมกระทบ "วันติดต่อล่าสุด" → ล้าง cache สรุปลูกค้า

    @Override
    public ActivityResponse create(CreateActivityRequest r) {
        UUID tenant = TenantContext.required();
        Activity a = Activity.create(tenant, r.kind(), r.subjectType(), r.subjectCode(),
                r.parentType(), r.parentCode(), r.customerCode(),
                r.occurredAt(), r.createdBy(), r.payload());
        Activity saved = activityRepository.save(a);
        insightApi.invalidate(tenant);
        return ActivityMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActivityResponse> list(String subjectType, String subjectCode, String customerCode, String kind) {
        UUID tenant = TenantContext.required();
        List<Activity> rows;
        if (subjectType != null && subjectCode != null && !subjectCode.isBlank()) {
            rows = activityRepository.findByCompanyIdAndSubjectTypeAndSubjectCodeAndKindOrderByOccurredAtDesc(
                    tenant, subjectType, subjectCode, kind);
        } else if (customerCode != null && !customerCode.isBlank()) {
            rows = activityRepository.findByCompanyIdAndCustomerCodeAndKindOrderByOccurredAtDesc(
                    tenant, customerCode, kind);
        } else {
            rows = List.of();
        }
        return rows.stream().map(ActivityMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActivityResponse> report(String kind, Instant from, Instant to) {
        UUID tenant = TenantContext.required();
        return activityRepository.reportByKind(tenant, kind, from, to).stream()
                .map(ActivityMapper::toResponse).toList();
    }

    /** ภายใน 3 วันแรกลบได้จริง · หลังจากนั้นเป็นการขีดออก (soft) */
    private static final Duration HARD_DELETE_WINDOW = Duration.ofDays(3);

    @Override
    public ActivityResponse update(UUID id, UpdateActivityRequest r) {
        Activity a = findScoped(id);
        a.update(r.occurredAt(), r.payload());
        insightApi.invalidate(TenantContext.required());
        return ActivityMapper.toResponse(a);
    }

    @Override
    public boolean delete(UUID id) {
        Activity a = findScoped(id);
        boolean hard = a.getCreatedAt() != null && a.getCreatedAt().isAfter(Instant.now().minus(HARD_DELETE_WINDOW));
        if (hard) activityRepository.delete(a);   // ยังใหม่ (≤ 3 วัน) → ลบจริง
        else a.voidEntry();                        // เกิน 3 วัน → ขีดออก รอ purge 6 เดือน
        insightApi.invalidate(TenantContext.required());
        return hard;
    }

    @Override
    public ActivityResponse restore(UUID id) {
        Activity a = findScoped(id);
        a.restore();
        insightApi.invalidate(TenantContext.required());
        return ActivityMapper.toResponse(a);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContactSummary> contactSummary() {
        UUID tenant = TenantContext.required();
        Map<String, Instant[]> byCustomer = new LinkedHashMap<>(); // [lastComm, lastCall]
        for (ActivityRepository.ContactRow row : activityRepository.contactSummary(tenant, List.of("COMMUNICATION", "CALL_RESULT"))) {
            Instant[] pair = byCustomer.computeIfAbsent(row.getCustomerCode(), k -> new Instant[2]);
            if ("COMMUNICATION".equals(row.getKind())) pair[0] = row.getLast();
            else pair[1] = row.getLast();
        }
        return byCustomer.entrySet().stream()
                .map(e -> new ContactSummary(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();
    }

    /** หาเฉพาะในบริษัทของผู้ใช้ — กันแก้/ลบข้ามบริษัท */
    private Activity findScoped(UUID id) {
        return activityRepository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Activity", id));
    }
}
