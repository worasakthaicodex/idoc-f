package com.idoc.modules.calendar.web;

import com.idoc.modules.calendar.application.CalendarDto;
import com.idoc.modules.calendar.application.CalendarService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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

/** ปฏิทินกิจกรรม (Calendar) — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService service;

    @GetMapping
    public List<CalendarDto> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String customerRef,
            @RequestParam(required = false) String refType,
            @RequestParam(required = false) String refCode,
            @RequestParam(required = false) String module,
            @RequestParam(required = false, defaultValue = "false") boolean due) {
        // due=1 → เฉพาะที่ถึงกำหนดเตือน (สำหรับ poll กระดิ่ง) ไม่ดึงทั้งปฏิทิน
        if (due) return service.listDue();
        return service.list(from, to, customerRef, refType, refCode, module);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarDto create(@RequestBody CalendarDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public CalendarDto update(@PathVariable UUID id, @RequestBody CalendarDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
