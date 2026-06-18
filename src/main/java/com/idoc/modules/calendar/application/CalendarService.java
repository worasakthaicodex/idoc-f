package com.idoc.modules.calendar.application;

import com.idoc.modules.calendar.domain.CalendarEvent;
import com.idoc.modules.calendar.domain.CalendarEventRepository;
import com.idoc.modules.customer.api.CustomerInsightApi;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.tenant.TenantContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** ปฏิทินกิจกรรม (Calendar) — โมดูลกลาง ใช้ได้ทุกโมดูล */
@Service
@RequiredArgsConstructor
public class CalendarService {

    private final CalendarEventRepository repo;
    private final CustomerInsightApi insightApi;   // นัดในปฏิทินกระทบ readiness/บัคเก็ต "นัดล่วงหน้า" → ล้าง cache สรุปลูกค้า

    @Transactional(readOnly = true)
    public List<CalendarDto> list(LocalDate from, LocalDate to, String customerRef, String refType, String refCode, String module) {
        return repo.search(TenantContext.required(), from, to, customerRef, refType, refCode, module)
                .stream().map(CalendarDto::from).toList();
    }

    /** เฉพาะกิจกรรมที่ถึงกำหนดเตือน/เลยกำหนด (สำหรับ poll กระดิ่ง) — ไม่ดึงทั้งปฏิทิน
     *  จำกัดช่วง 3 เดือนล่าสุด ตรงกับที่กระดิ่งไม่เตือนของค้างเก่ากว่า 3 เดือน */
    @Transactional(readOnly = true)
    public List<CalendarDto> listDue() {
        LocalDate today = LocalDate.now();
        return repo.searchDue(TenantContext.required(), today.minusMonths(3), today)
                .stream().map(CalendarDto::fromSlim).toList();
    }

    @Transactional
    public CalendarDto create(CalendarDto dto) {
        CalendarEvent e = new CalendarEvent();
        e.setCompanyId(TenantContext.required());
        apply(e, dto);
        CalendarEvent saved = repo.save(e);
        insightApi.invalidate(e.getCompanyId());
        return CalendarDto.from(saved);
    }

    @Transactional
    public CalendarDto update(UUID id, CalendarDto dto) {
        CalendarEvent e = require(id);
        apply(e, dto);
        CalendarEvent saved = repo.save(e);
        insightApi.invalidate(e.getCompanyId());
        return CalendarDto.from(saved);
    }

    @Transactional
    public void delete(UUID id) {
        CalendarEvent e = require(id);
        repo.delete(e);
        insightApi.invalidate(e.getCompanyId());
    }

    private CalendarEvent require(UUID id) {
        CalendarEvent e = repo.findById(id).orElseThrow(() -> new BusinessException("ไม่พบกิจกรรม"));
        if (!e.getCompanyId().equals(TenantContext.required())) {
            throw new BusinessException("ไม่พบกิจกรรม");
        }
        return e;
    }

    private void apply(CalendarEvent e, CalendarDto d) {
        e.setActivityDate(d.activityDate());
        e.setRemindDate(d.remindDate());
        e.setPriority(d.priority() == null ? "NORMAL" : d.priority());
        e.setStatus(d.status() == null ? "PENDING" : d.status());
        e.setConfirmed(d.confirmed());
        e.setTitle(d.title());
        e.setCustomerRef(d.customerRef());
        e.setRefType(d.refType());
        e.setRefCode(d.refCode());
        e.setModule(d.module());
        e.setCreatedBy(d.createdBy());
        e.setNote(d.note());
    }
}
