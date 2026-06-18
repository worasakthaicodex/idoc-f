package com.idoc.shared.notify;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * อ่าน/จัดการแจ้งเตือนของผู้ใช้ — tenant จาก X-Company-Id, ผู้ใช้จาก ?user= (เหมือน SSE)
 *  ฝั่งหน้าอ่านตอนเปิดแอป + ตอน SSE "notify" เด้ง (event-driven ไม่ poll)
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public List<NotificationDto> list(@RequestParam String user,
                                      @RequestParam(required = false, defaultValue = "50") int limit) {
        return service.list(user, limit);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@RequestParam String user) {
        return Map.of("count", service.unreadCount(user));
    }

    @PostMapping("/{id}/read")
    public void markRead(@PathVariable UUID id) {
        service.markRead(id);
    }

    @PostMapping("/read-all")
    public Map<String, Integer> markAllRead(@RequestParam String user) {
        return Map.of("updated", service.markAllRead(user));
    }
}
