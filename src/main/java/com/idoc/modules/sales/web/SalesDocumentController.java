package com.idoc.modules.sales.web;

import com.idoc.modules.sales.application.ClLeadsService;
import com.idoc.modules.sales.application.ClLeadsService.BoxRow;
import com.idoc.modules.sales.application.SalesDocDto;
import com.idoc.modules.sales.application.SalesDocumentService;
import java.util.List;
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

/** เอกสารงานขาย (CL/FO/QT/SO) — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/sales-docs")
@RequiredArgsConstructor
public class SalesDocumentController {

    private final SalesDocumentService service;
    private final ClLeadsService clLeadsService;
    private final com.idoc.modules.sales.application.SalesEnrichService enrichService;

    /** รายการเอกสารของชนิดนั้น (เรียงใหม่→เก่า)
     *  - customerRef: กรองเฉพาะลูกค้ารายนี้ (หน้า customer) ไม่ดึงทั้งตาราง
     *  - doneLimit: ส่ง DONE แค่ N ใบล่าสุด (กล่องงาน/poll) ลด egress
     *  - phase: เฉพาะเฟสเดียว (เช่น RECEIVE สำหรับ poll แจ้งเตือน)
     *  - slim: ตัด line items ออก (poll แจ้งเตือนไม่ต้องใช้ยอด) */
    @GetMapping
    public List<SalesDocDto> list(@RequestParam String docType,
                                  @RequestParam(required = false) String customerRef,
                                  @RequestParam(required = false) Integer doneLimit,
                                  @RequestParam(required = false) String phase,
                                  @RequestParam(required = false, defaultValue = "false") boolean slim,
                                  @RequestParam(required = false) String owner) {
        return service.list(docType, customerRef, doneLimit, phase, slim, owner);
    }

    /** ข้อมูลเสริมต่อ CL (ประมาณการ/เงื่อนไข/วันติดต่อ/นัด/FO-QT-SO) สำหรับกล่องงาน /sales/cl */
    @GetMapping("/cl-box-rows")
    public List<BoxRow> clBoxRows() {
        return clLeadsService.boxRows();
    }

    /** ค่าเสริมกล่องงาน (เกรด/ติดต่อล่าสุด/รอบโทร/วันนัด) รวดเดียว — แทนการไล่ยิงรายแถวที่หน้าเว็บ */
    @GetMapping("/enrich")
    public List<com.idoc.modules.sales.application.SalesEnrichDto> enrich(
            @RequestParam String docType,
            @RequestParam(required = false) String owner) {
        return enrichService.enrich(docType, owner);
    }

    @GetMapping("/{docType}/{code}")
    public SalesDocDto get(@PathVariable String docType, @PathVariable String code) {
        return service.get(docType, code);
    }

    /** บันทึก (สร้าง/แก้) เอกสารตามรหัส */
    @PutMapping("/{docType}/{code}")
    public SalesDocDto upsert(@PathVariable String docType, @PathVariable String code,
                              @RequestBody SalesDocDto dto) {
        return service.upsert(docType, code, dto);
    }

    @DeleteMapping("/{docType}/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String docType, @PathVariable String code) {
        service.delete(docType, code);
    }

    /** ออกเลขจริงตามกฎ numbering (DRAFT → รหัสจริง) — คืนรหัสปัจจุบัน */
    @PostMapping("/{docType}/{code}/issue-code")
    public java.util.Map<String, String> issueCode(@PathVariable String docType, @PathVariable String code) {
        return java.util.Map.of("code", service.issueCode(docType, code));
    }
}
