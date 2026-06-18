package com.idoc.modules.sales.application;

import com.idoc.modules.customer.api.CustomerInsightApi;
import com.idoc.modules.customer.domain.BasketItemRepository;
import com.idoc.modules.customer.domain.BasketRepository;
import com.idoc.modules.sales.domain.ClPullLogRepository;
import com.idoc.modules.sales.domain.SalesDocument;
import com.idoc.modules.sales.domain.SalesDocumentRepository;
import com.idoc.shared.notify.NotificationService;
import com.idoc.shared.tenant.TenantContext;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** บันทึก/ดึงเอกสารงานขายต่อบริษัท (tenant) — 1 ตารางรวม แยกด้วย docType */
@Service
@RequiredArgsConstructor
public class SalesDocumentService {

    private final SalesDocumentRepository repo;
    private final BasketRepository basketRepository;
    private final BasketItemRepository basketItemRepository;
    private final ClPullLogRepository pullLogRepository;
    private final NotificationService notificationService;
    private final CustomerInsightApi insightApi;   // FO/QT/SO เปลี่ยน → sales-buckets ของหน้า groups เปลี่ยน

    @Transactional(readOnly = true)
    public List<SalesDocDto> list(String docType, String customerRef, Integer doneLimit, String phase, boolean slim, String owner) {
        UUID tenant = TenantContext.required();
        java.util.function.Function<SalesDocument, SalesDocDto> map = slim ? SalesDocDto::fromSlim : SalesDocDto::from;
        // กรอง "ของฉัน" (owner) ที่ backend — คนไม่มีงานได้ ~0 ใบ · DONE+limit = แท็บเสร็จสิ้น
        if (owner != null && !owner.isBlank()) {
            if (phase != null && !phase.isBlank()) {
                if ("DONE".equals(phase)) {
                    org.springframework.data.domain.Pageable pg = (doneLimit != null && doneLimit > 0)
                            ? org.springframework.data.domain.PageRequest.of(0, doneLimit)
                            : org.springframework.data.domain.Pageable.unpaged();
                    return repo.findDoneByOwner(tenant, docType, owner, pg).stream().map(map).toList();
                }
                // เฟสเดียวของฉัน (RECEIVE/PROCESS/EXPORT) — กรองที่ SQL
                return repo.findByOwnerAndPhase(tenant, docType, owner, phase).stream().map(map).toList();
            }
            List<SalesDocument> mineActive = repo.findActiveByOwner(tenant, docType, owner);
            if (doneLimit == null || doneLimit == 0) {
                return mineActive.stream().map(map).toList();
            }
            List<SalesDocument> mineDone = repo.findDoneByOwner(
                    tenant, docType, owner, org.springframework.data.domain.PageRequest.of(0, doneLimit));
            return java.util.stream.Stream.concat(mineActive.stream(), mineDone.stream()).map(map).toList();
        }
        // เฉพาะเฟสเดียว — DONE+doneLimit = แค่ N ใบล่าสุด (โหลดตอนกดแท็บเสร็จสิ้น) · เฟสอื่น (RECEIVE) = ครบ (น้อยอยู่แล้ว)
        if (phase != null && !phase.isBlank()) {
            if ("DONE".equals(phase) && doneLimit != null && doneLimit > 0) {
                return repo.findByCompanyIdAndDocTypeAndPhaseOrderBySavedAtDesc(
                        tenant, docType, "DONE", org.springframework.data.domain.PageRequest.of(0, doneLimit))
                        .stream().map(map).toList();
            }
            return repo.findByCompanyIdAndDocTypeAndPhaseOrderBySavedAtDesc(tenant, docType, phase)
                    .stream().map(map).toList();
        }
        // กรองเฉพาะลูกค้ารายเดียว (หน้า customer) — ไม่ดึงทั้งตาราง
        if (customerRef != null && !customerRef.isBlank()) {
            return repo.findByCompanyIdAndDocTypeAndCustomerRefOrderBySavedAtDesc(tenant, docType, customerRef)
                    .stream().map(map).toList();
        }
        // doneLimit=0 → งาน active เท่านั้น (ไม่ส่ง DONE) · >0 → active ครบ + DONE ล่าสุด N ใบ
        if (doneLimit != null && doneLimit >= 0) {
            List<SalesDocument> active =
                    repo.findByCompanyIdAndDocTypeAndPhaseNotOrderBySavedAtDesc(tenant, docType, "DONE");
            if (doneLimit == 0) {
                return active.stream().map(map).toList();
            }
            List<SalesDocument> done = repo.findByCompanyIdAndDocTypeAndPhaseOrderBySavedAtDesc(
                    tenant, docType, "DONE", org.springframework.data.domain.PageRequest.of(0, doneLimit));
            return java.util.stream.Stream.concat(active.stream(), done.stream()).map(map).toList();
        }
        return repo.findByCompanyIdAndDocTypeOrderBySavedAtDesc(tenant, docType)
                .stream().map(map).toList();
    }

    @Transactional(readOnly = true)
    public SalesDocDto get(String docType, String code) {
        return repo.findByCompanyIdAndDocTypeAndCode(TenantContext.required(), docType, code)
                .map(SalesDocDto::from).orElse(null);
    }

    @Transactional
    public SalesDocDto upsert(String docType, String code, SalesDocDto dto) {
        UUID tenant = TenantContext.required();
        SalesDocument e = repo.findByCompanyIdAndDocTypeAndCode(tenant, docType, code)
                .orElseGet(SalesDocument::new);
        Object prevSent = e.getMeta() == null ? null : e.getMeta().get("sent");   // sent เดิม — เทียบจับ "การส่งครั้งใหม่"
        String prevClose = e.getData() == null ? null : str(e.getData().get("closeResult"));   // ผลปิดเดิม — เทียบจับ "ปิดชนะครั้งใหม่"
        e.setCompanyId(tenant);
        e.setDocType(docType);
        e.setCode(code);
        e.setTitle(dto.title());
        e.setTelesale(dto.telesale());
        e.setPhase(dto.phase() == null ? "PROCESS" : dto.phase());
        e.setStageId(dto.stageId());
        e.setSavedAt(dto.savedAt());

        Map<String, Object> values = dto.values() == null ? new HashMap<>() : dto.values();
        e.setData(values);
        // คอลัมน์อ้างอิง (สายเอกสาร) ดึงจาก values
        e.setCustomerRef(str(values.get("customerRef")));
        e.setSrcCl(str(values.get("srcCl")));
        e.setSrcFo(str(values.get("srcFo")));
        e.setSrcQt(str(values.get("srcQt")));

        Map<String, Object> meta = new HashMap<>();
        if (dto.received() != null) meta.put("received", dto.received());
        if (dto.bounce() != null) meta.put("bounce", dto.bounce());
        if (dto.sent() != null) meta.put("sent", dto.sent());
        e.setMeta(meta);

        SalesDocDto saved = SalesDocDto.from(repo.save(e));
        notifyIfNewlySent(tenant, docType, code, e.getPhase(), dto.sent(), prevSent);
        notifyIfNewlyWon(tenant, docType, code, values, prevClose, dto.sent());
        insightApi.invalidate(tenant);
        return saved;
    }

    /** เขียนแจ้งเตือน "เอกสารใหม่" ให้ผู้รับ ตอนเอกสารถูก "ส่งครั้งใหม่" เข้ากล่องรับเข้า (phase=RECEIVE)
     *  เทียบ sent.at เดิม↔ใหม่ กันยิงซ้ำตอน autosave ใบเดิมที่ยังอยู่กล่องรับเข้า */
    private void notifyIfNewlySent(UUID tenant, String docType, String code, String phase, Object sent, Object prevSent) {
        if (!"RECEIVE".equals(phase) || !(sent instanceof Map<?, ?> s)) return;
        Object at = s.get("at");
        Object prevAt = prevSent instanceof Map<?, ?> p ? p.get("at") : null;
        if (at != null && at.equals(prevAt)) return;   // ส่งครั้งเดิม (ไม่ใช่การส่งใหม่) → ไม่ยิงซ้ำ

        List<String> recipients = new ArrayList<>();
        Object rc = s.get("recipients");
        if (rc instanceof List<?> l) {
            for (Object o : l) if (o != null && !o.toString().isBlank()) recipients.add(o.toString());
        }
        if (recipients.isEmpty()) {   // ไม่ระบุผู้รับ → ลง to เดี่ยว (ถ้ามี)
            Object to = s.get("to");
            if (to != null && !to.toString().isBlank()) recipients.add(to.toString());
        }
        String by = strOf(s.get("by"));
        notificationService.notify(tenant, recipients, "docIncoming",
                "เอกสารใหม่ " + docType + " " + code,
                by.isBlank() ? null : ("ส่งโดย " + by), docType, code, by);
    }

    /** เขียนแจ้งเตือน "ปิดการขายได้" ให้ผู้รับช่วงต่อ (handoffTo) ตอนเอกสารเพิ่งถูกปิดชนะ (closeResult=won ครั้งใหม่) */
    private void notifyIfNewlyWon(UUID tenant, String docType, String code, Map<String, Object> values,
                                  String prevClose, Object sent) {
        String close = str(values.get("closeResult"));
        if (!"won".equals(close) || "won".equals(prevClose)) return;   // ปิดชนะ "ครั้งใหม่" เท่านั้น
        List<String> recipients = new ArrayList<>();
        String handoff = str(values.get("handoffTo"));
        if (handoff != null && !handoff.isBlank()) recipients.add(handoff);
        if (recipients.isEmpty()) return;   // ไม่มีผู้รับช่วงต่อ → ไม่ต้องเตือน
        String by = sent instanceof Map<?, ?> s ? strOf(s.get("by")) : strOf(values.get("salesperson"));
        notificationService.notify(tenant, recipients, "dealWon",
                "ปิดการขายได้ " + docType + " " + code,
                by.isBlank() ? null : ("ปิดโดย " + by), docType, code, by);
    }

    private static String strOf(Object o) {
        return o == null ? "" : o.toString();
    }

    @Transactional
    public void delete(String docType, String code) {
        UUID tenant = TenantContext.required();
        // คืนรายชื่อ: เคลียร์ตะกร้าซ่อนของเอกสารนี้ (+รายการ +ประวัติดึง) → ลูกค้าหลุดล็อก ดึงลงเอกสารอื่นได้
        basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, docType, code).ifPresent(b -> {
            basketItemRepository.deleteByBasketId(b.getId());
            basketRepository.delete(b);
        });
        if ("CL".equals(docType)) pullLogRepository.deleteByCompanyIdAndClCode(tenant, code);
        repo.deleteByCompanyIdAndDocTypeAndCode(tenant, docType, code);
        insightApi.invalidate(tenant);
    }

    /** ออกเลขจริง (แทน DRAFT) ตามกฎ numbering — เปลี่ยนรหัสเอกสาร + ตะกร้าซ่อน (ref_code) + log ที่อ้างรหัส
     *  คืนรหัสปัจจุบัน (ถ้าไม่ใช่ DRAFT หรือไม่พบ คืนเดิม) */
    @Transactional
    public String issueCode(String docType, String oldCode) {
        UUID tenant = TenantContext.required();
        if (oldCode == null || !oldCode.startsWith("DRAFT-")) return oldCode;   // ออกเลขจริงแล้ว
        var docOpt = repo.findByCompanyIdAndDocTypeAndCode(tenant, docType, oldCode);
        if (docOpt.isEmpty()) return oldCode;
        String prefix = docType + YearMonth.now().toString().replace("-", "");   // เช่น CL202606
        long n = repo.countByCompanyIdAndDocTypeAndCodeStartingWith(tenant, docType, prefix);
        String newCode;
        do { n++; newCode = prefix + "-" + n; }
        while (repo.findByCompanyIdAndDocTypeAndCode(tenant, docType, newCode).isPresent());
        final String nc = newCode;
        SalesDocument d = docOpt.get();
        d.setCode(nc);
        repo.save(d);
        basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, docType, oldCode).ifPresent(b -> {
            b.setRefCode(nc);
            if (oldCode.equals(b.getName())) b.setName(nc);
            basketRepository.save(b);
        });
        if ("CL".equals(docType)) pullLogRepository.relabel(tenant, oldCode, nc);
        return nc;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
