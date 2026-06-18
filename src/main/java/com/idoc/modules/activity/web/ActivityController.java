package com.idoc.modules.activity.web;

import com.idoc.modules.activity.application.ActivityService;
import com.idoc.modules.activity.application.dto.ActivityResponse;
import com.idoc.modules.activity.application.dto.ContactSummary;
import com.idoc.modules.activity.application.dto.CreateActivityRequest;
import com.idoc.modules.activity.application.dto.UpdateActivityRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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
 * API กลางของเครื่องมือเอกสาร — โมดูลอื่นเรียกผ่าน REST นี้ (อ้างอิงเอกสารแบบ string)
 * tenant มาจาก header X-Company-Id (TenantFilter -> TenantContext)
 */
@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService activityService;

    @GetMapping
    public List<ActivityResponse> list(
            @RequestParam(required = false) String subjectType,
            @RequestParam(required = false) String subjectCode,
            @RequestParam(required = false) String customerCode,
            @RequestParam String kind) {
        return activityService.list(subjectType, subjectCode, customerCode, kind);
    }

    /** สรุปวันติดต่อล่าสุดของทุกลูกค้า (ใช้คำนวณ "พร้อมใช้" ในหน้ากลุ่มลูกค้า) */
    @GetMapping("/contact-summary")
    public List<ContactSummary> contactSummary() {
        return activityService.contactSummary();
    }

    /** รายงาน: ทุกกิจกรรมของชนิดหนึ่งในช่วงเวลา (from/to = epoch millis) — หน้ารายงานการขาย */
    @GetMapping("/report")
    public List<ActivityResponse> report(
            @RequestParam String kind,
            @RequestParam long from,
            @RequestParam long to) {
        return activityService.report(kind, java.time.Instant.ofEpochMilli(from), java.time.Instant.ofEpochMilli(to));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityResponse create(@Valid @RequestBody CreateActivityRequest request) {
        return activityService.create(request);
    }

    @PutMapping("/{id}")
    public ActivityResponse update(@PathVariable UUID id, @RequestBody UpdateActivityRequest request) {
        return activityService.update(id, request);
    }

    /** ลบ: ≤ 3 วันลบจริง, เกิน 3 วันขีดออก — คืน {hardDeleted} ให้ฝั่งหน้ารู้ว่าหายหรือถูกขีด */
    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(@PathVariable UUID id) {
        return Map.of("hardDeleted", activityService.delete(id));
    }

    @PostMapping("/{id}/restore")
    public ActivityResponse restore(@PathVariable UUID id) {
        return activityService.restore(id);
    }
}
