package com.idoc.modules.sales.application;

import com.idoc.modules.activity.domain.ActivityRepository;
import com.idoc.modules.calendar.domain.CalendarEvent;
import com.idoc.modules.calendar.domain.CalendarEventRepository;
import com.idoc.modules.customer.domain.Customer;
import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.sales.domain.SalesDocument;
import com.idoc.modules.sales.domain.SalesDocumentRepository;
import com.idoc.shared.tenant.TenantContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * คำนวณค่าเสริมของกล่องงาน (เกรด/ติดต่อล่าสุด/รอบโทร/วันนัด) "รวดเดียว" ที่ backend
 * แทนการให้หน้าเว็บไล่ยิง /customers, /activities, /calendar ทีละแถว (ทะยอย เผา transfer)
 */
@Service
@RequiredArgsConstructor
public class SalesEnrichService {

    private final SalesDocumentRepository salesRepo;
    private final CustomerRepository customerRepo;
    private final ActivityRepository activityRepo;
    private final CalendarEventRepository calendarRepo;

    @Transactional(readOnly = true)
    public List<SalesEnrichDto> enrich(String docType, String owner) {
        UUID tenant = TenantContext.required();
        List<SalesDocument> docs = (owner != null && !owner.isBlank())
                ? salesRepo.findActiveByOwner(tenant, docType, owner)
                : salesRepo.findByCompanyIdAndDocTypeAndPhaseNotOrderBySavedAtDesc(tenant, docType, "DONE");
        if (docs.isEmpty()) return List.of();

        List<String> codes = docs.stream().map(SalesDocument::getCode).toList();
        List<String> custRefs = docs.stream()
                .map(SalesDocument::getCustomerRef)
                .filter(c -> c != null && !c.isBlank())
                .distinct().toList();

        // เกรดลูกค้า (batch)
        Map<String, String> gradeByCust = new HashMap<>();
        if (!custRefs.isEmpty()) {
            for (Customer c : customerRepo.findByCompanyIdAndCodeIn(tenant, custRefs)) {
                String g = c.getAttributes() == null ? null : c.getAttributes().get("grade");
                if (g != null && !g.isBlank()) gradeByCust.put(c.getCode(), g);
            }
        }
        // ติดต่อล่าสุด ต่อลูกค้า (batch) — วันที่ + ข้อความ
        Map<String, Instant> commByCust = new HashMap<>();
        Map<String, String> commMsgByCust = new HashMap<>();
        if (!custRefs.isEmpty()) {
            for (var r : activityRepo.latestByCustomers(tenant, "COMMUNICATION", custRefs)) {
                if (r.getCustomerCode() != null) commByCust.put(r.getCustomerCode(), r.getLast());
            }
            for (Object[] row : activityRepo.latestMessageByCustomers(tenant, custRefs)) {
                if (row[0] != null && row[1] != null) commMsgByCust.put(row[0].toString(), row[1].toString());
            }
        }
        // รอบโทร ต่อเอกสาร (batch)
        Map<String, Long> roundByCode = new HashMap<>();
        for (var r : activityRepo.countBySubjects(tenant, "CALL_RESULT", docType, codes)) {
            roundByCode.put(r.getSubjectCode(), r.getCnt());
        }
        // วันนัดที่ยังไม่ทำ (เร็วสุด) ต่อเอกสาร (batch)
        Map<String, LocalDate> apptByCode = new HashMap<>();
        for (CalendarEvent e : calendarRepo.findPendingByRefCodes(tenant, docType, codes)) {
            if (e.getRefCode() == null || e.getActivityDate() == null) continue;
            apptByCode.merge(e.getRefCode(), e.getActivityDate(), (a, b) -> a.isBefore(b) ? a : b);
        }

        return docs.stream().map(d -> {
            String cust = d.getCustomerRef();
            Instant comm = cust == null ? null : commByCust.get(cust);
            LocalDate appt = apptByCode.get(d.getCode());
            Long cnt = roundByCode.get(d.getCode());
            return new SalesEnrichDto(
                    d.getCode(),
                    cust,
                    cust == null ? null : gradeByCust.get(cust),
                    comm == null ? null : comm.toEpochMilli(),
                    cust == null ? null : commMsgByCust.get(cust),
                    cnt == null ? null : cnt.intValue(),
                    appt == null ? null : appt.toString());
        }).toList();
    }
}
