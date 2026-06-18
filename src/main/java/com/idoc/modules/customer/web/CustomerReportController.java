package com.idoc.modules.customer.web;

import com.idoc.modules.customer.application.CustomerReportService;
import com.idoc.modules.customer.application.CustomerReportService.Completeness;
import com.idoc.modules.customer.application.CustomerReportService.Distribution;
import com.idoc.modules.customer.application.CustomerReportService.GradeMovement;
import com.idoc.modules.customer.application.CustomerReportService.Member;
import com.idoc.modules.customer.application.CustomerReportService.CompletenessPct;
import com.idoc.modules.customer.application.CustomerReportService.RevisionEvent;
import com.idoc.modules.customer.application.CustomerReportService.StatusCount;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** รายงานลูกค้า (read-only) — tenant จาก header เหมือน controller อื่น */
@RestController
@RequestMapping("/api/customers/reports")
@RequiredArgsConstructor
public class CustomerReportController {

    private final CustomerReportService service;

    @GetMapping("/contact-distribution")
    public Distribution contactDistribution(@RequestParam(defaultValue = "all") String grade) {
        return service.contactDistribution("abc".equalsIgnoreCase(grade));
    }

    @GetMapping("/contact-members")
    public List<Member> contactMembers(@RequestParam int bucket,
                                       @RequestParam(defaultValue = "all") String grade,
                                       @RequestParam(defaultValue = "500") int limit) {
        return service.contactMembers(bucket, "abc".equalsIgnoreCase(grade), limit);
    }

    @GetMapping("/completeness")
    public Completeness completeness() {
        return service.completeness();
    }

    @GetMapping("/completeness-members")
    public List<Member> completenessMembers(@RequestParam String kind,
                                            @RequestParam(defaultValue = "500") int limit) {
        return service.completenessMembers(kind, limit);
    }

    /** ความครบถ้วนเป็น % ของฟิลด์ที่เปิดใช้ — นับที่ DB · fields = รายชื่อฟิลด์ที่เปิด (คั่นจุลภาค) */
    @GetMapping("/completeness-pct")
    public CompletenessPct completenessPct(@RequestParam(required = false) String fields) {
        return service.completenessPct(splitCsv(fields));
    }

    @GetMapping("/completeness-pct-members")
    public List<Member> completenessPctMembers(@RequestParam(required = false) String fields,
                                               @RequestParam int bucket,
                                               @RequestParam(defaultValue = "500") int limit) {
        return service.completenessPctMembers(splitCsv(fields), bucket, limit);
    }

    private static List<String> splitCsv(String s) {
        if (s == null || s.isBlank()) return List.of();
        return java.util.Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isBlank()).toList();
    }

    @GetMapping("/grade-movement")
    public GradeMovement gradeMovement() {
        return service.gradeMovement();
    }

    /** นับลูกค้าแยกตามสถานะ (พร้อมใช้/บัญชีดำ/อื่นๆ) — นับที่ DB */
    @GetMapping("/status-distribution")
    public List<StatusCount> statusDistribution() {
        return service.statusDistribution();
    }

    /** รายชื่อลูกค้าของสถานะหนึ่ง (จำกัดจำนวน) — สำหรับ drill */
    @GetMapping("/status-members")
    public List<Member> statusMembers(@RequestParam String status,
                                      @RequestParam(defaultValue = "500") int limit) {
        return service.statusMembers(status, limit);
    }

    /** ตัดเกรดรอบใหม่ (เตรียมไว้สำหรับงานรายเดือน — กดเองได้) */
    @PostMapping("/grade-cut")
    public Map<String, Object> gradeCut(@RequestParam(required = false) String period) {
        int rows = service.recordGradeCut(period);
        return Map.of("rows", rows);
    }

    /** เหตุการณ์เพิ่ม/แก้ไขลูกค้าในช่วง (ฝั่งหน้าเอาไปจัดรอบเดือน/กรอง/กราฟ/export) */
    @GetMapping("/revisions")
    public List<RevisionEvent> revisions(@RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to) {
        Instant f = parse(from, Instant.now().minusSeconds(400L * 24 * 3600));   // default ~13 เดือน
        Instant t = parse(to, Instant.now().plusSeconds(24 * 3600));
        return service.revisions(f, t);
    }

    private static Instant parse(String s, Instant dft) {
        if (s == null || s.isBlank()) return dft;
        try { return Instant.parse(s.trim()); } catch (Exception ignore) { /* try date */ }
        try { return LocalDate.parse(s.trim()).atStartOfDay(ZoneOffset.UTC).toInstant(); } catch (Exception ignore) { return dft; }
    }
}
