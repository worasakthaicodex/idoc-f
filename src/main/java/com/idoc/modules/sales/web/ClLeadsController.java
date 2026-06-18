package com.idoc.modules.sales.web;

import com.idoc.modules.customer.domain.CustomerRepositoryCustom.LeadPreview;
import com.idoc.modules.sales.application.ClLeadsService;
import com.idoc.modules.sales.application.ClLeadsService.LogEntry;
import com.idoc.modules.sales.application.ClLeadsService.ChainDoc;
import com.idoc.modules.sales.application.ClLeadsService.OpsSummary;
import com.idoc.modules.sales.application.ClLeadsService.Summary;
import com.idoc.modules.sales.application.ClLeadsService.WorkLead;
import com.idoc.modules.sales.domain.ClPullLog;
import java.time.Instant;
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

/** รายชื่อในชุด CL (ตะกร้าซื้อจริง) — ดึง/ดู/ลบ/Log */
@RestController
@RequestMapping("/api/sales-docs/CL/{code}/leads")
@RequiredArgsConstructor
public class ClLeadsController {

    private final ClLeadsService service;

    /** เกณฑ์ดึงรายชื่อลงตะกร้า CL — q/filters (ค้นเอง) · field/value (กลุ่ม) · bucket/year (ตามงานขาย) */
    public record PullRequest(String q, Map<String, String> filters,
                              String field, String value, String bucket, Integer year,
                              String ready, Integer sinceContactMonths, Integer calendarDays,
                              Integer limit, String method, String detail, String by) {}

    public record PullResult(int added) {}

    public record LeadRow(String code, String name, String groupName, Instant lastContact, long usedCount) {
        static LeadRow from(LeadPreview p) {
            return new LeadRow(p.code(), p.name(), p.groupName(), p.lastContact(), p.usedCount());
        }
    }

    /** พรีวิวรายชื่อตามเกณฑ์ (ยังไม่ลง DB) — ฝั่งหน้าเอาไป "ร่าง" ก่อนกดบันทึก */
    public record ResolveRequest(Boolean fromBasket, String basketId, String q, Map<String, String> filters,
                                 String field, String value, String bucket, Integer year,
                                 String ready, Integer sinceContactMonths, Integer calendarDays, Integer limit) {}

    public record PreviewRow(String code, String name, String groupName, Instant lastContact, boolean ready, boolean inOtherCl, long usedCount) {
        static PreviewRow from(LeadPreview p) { return new PreviewRow(p.code(), p.name(), p.groupName(), p.lastContact(), p.ready(), p.inOtherCl(), p.usedCount()); }
    }

    @PostMapping("/resolve")
    public List<PreviewRow> resolve(@PathVariable String code, @RequestBody ResolveRequest req) {
        UUID bid = req.basketId() == null || req.basketId().isBlank() ? null : UUID.fromString(req.basketId());
        int limit = req.limit() == null ? 60 : req.limit();
        return service.resolve(code, Boolean.TRUE.equals(req.fromBasket()), bid, req.q(), req.filters(), req.field(), req.value(),
                req.bucket(), req.year(), req.ready(), req.sinceContactMonths(), req.calendarDays(), limit)
                .stream().map(PreviewRow::from).toList();
    }

    /** บันทึก (คอมมิต) ชุดรายชื่อ + ประวัติที่ค้าง */
    public record SaveRequest(List<String> codes, List<LogEntry> logs, String by) {}

    @PutMapping("/save")
    public PullResult save(@PathVariable String code, @RequestBody SaveRequest req) {
        return new PullResult(service.save(code, req.codes(), req.logs(), req.by()));
    }

    @PostMapping("/pull")
    public PullResult pull(@PathVariable String code, @RequestBody PullRequest req) {
        int limit = req.limit() == null ? 60 : req.limit();
        int added = service.pull(code, req.q(), req.filters(), req.field(), req.value(), req.bucket(), req.year(),
                req.ready(), req.sinceContactMonths(), req.calendarDays(), limit,
                req.method(), req.detail(), req.by());
        return new PullResult(added);
    }

    @GetMapping
    public List<LeadRow> leads(@PathVariable String code) {
        return service.leads(code).stream().map(LeadRow::from).toList();
    }

    /** ทำชุดจนจบ (DONE) → บันทึกการใช้ลูกค้า +1 รอบ */
    @PostMapping("/complete")
    public PullResult complete(@PathVariable String code) {
        return new PullResult(service.complete(code));
    }

    /** worklist: รายชื่อในชุด + ข้อมูลติดต่อ + สถานะ/ประวัติการโทร */
    @GetMapping("/worklist")
    public List<WorkLead> worklist(@PathVariable String code) {
        return service.worklist(code);
    }

    /** สรุปภาพรวม: ข้อมูลการขายย้อนหลังของลูกค้าทั้งหมดในชุด */
    @GetMapping("/summary")
    public Summary summary(@PathVariable String code) {
        return service.summary(code);
    }

    /** รหัสลูกค้าที่มี FO อ้างอิง CL นี้ (ใช้จัดกลุ่ม "ส่งต่อ FO" ใน worklist) */
    @GetMapping("/fo-customers")
    public List<String> foCustomers(@PathVariable String code) {
        return service.foCustomers(code);
    }

    /** ผลดำเนินการ: ตัวเลขที่เกิดจาก CL นี้ (โทร/เปิด FO-QT-SO/ยอดประมาณการ/ยอดขาย) */
    @GetMapping("/ops")
    public OpsSummary ops(@PathVariable String code) {
        return service.ops(code);
    }

    /** สายงานเอกสารที่ต่อจาก CL นี้ (FO/QT/SO) — ต้นไม้แม่-ลูก */
    @GetMapping("/chain")
    public List<ChainDoc> chain(@PathVariable String code) {
        return service.chain(code);
    }

    /** บันทึกผลการโทรของรายคน */
    public record CallRequest(String result, Integer minutes, String note, String by) {}

    @PostMapping("/{customerRef}/call")
    public List<WorkLead> saveCall(@PathVariable String code, @PathVariable String customerRef,
                                   @RequestBody CallRequest req) {
        service.saveCall(code, customerRef, req.result(), req.minutes(), req.note(), req.by());
        return service.worklist(code);   // คืน worklist ล่าสุดให้หน้าจอรีเฟรช
    }

    @DeleteMapping("/{customerRef}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable String code, @PathVariable String customerRef,
                       @RequestParam(required = false) String by) {
        service.removeLead(code, customerRef, by);
    }

    @GetMapping("/log")
    public List<Map<String, Object>> log(@PathVariable String code) {
        return service.logs(code).stream().map(l -> Map.<String, Object>of(
                "method", l.getMethod(),
                "detail", l.getDetail() == null ? "" : l.getDetail(),
                "cnt", l.getCnt(),
                "by", l.getPulledBy() == null ? "" : l.getPulledBy(),
                "at", l.getCreatedAt()
        )).toList();
    }
}
