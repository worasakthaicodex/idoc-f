package com.idoc.shared.notify;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * SSE endpoint สำหรับแจ้งเตือน realtime
 *   GET /api/events?company=<uuid>&user=<id>
 * ใช้ query param เพราะ EventSource ฝั่งเบราว์เซอร์ใส่ header เองไม่ได้ (ต่างจาก apiFetch ที่ส่ง X-Company-Id)
 */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class NotifyController {

    private final SseHub hub;

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam UUID company, @RequestParam String user,
                             HttpServletRequest req) {
        // กัน crawler (Googlebot ฯลฯ) render SPA แล้วเปิดสตรีมค้าง 40 วิ จนกิน connection ของ Cloud Run จนล่ม
        // bot ไม่ต้องการ realtime — คืน emitter ที่ปิดทันที (ไม่ register ใน hub, ไม่ถูก ping, ไม่ค้าง)
        if (isCrawler(req)) {
            SseEmitter dead = new SseEmitter(1L);
            dead.complete();
            return dead;
        }
        return hub.subscribe(company, user);
    }

    /** ตรวจ crawler จาก User-Agent + ช่วง IP ของ Googlebot (66.249.x.x) ที่ Firebase Hosting ส่งต่อมาทาง X-Forwarded-For */
    private static boolean isCrawler(HttpServletRequest req) {
        String ua = req.getHeader("User-Agent");
        if (ua != null) {
            String l = ua.toLowerCase();
            if (l.contains("bot") || l.contains("crawler") || l.contains("spider")
                    || l.contains("googlebot") || l.contains("bingbot") || l.contains("headless")) {
                return true;
            }
        }
        String fwd = req.getHeader("X-Forwarded-For"); // client จริงเป็นตัวแรกในลิสต์
        if (fwd != null) {
            String ip = fwd.split(",")[0].trim();
            // Googlebot/WRS ใช้ UA เป็น Chrome ปกติ ดักด้วย UA ไม่อยู่ → กันด้วยช่วง IP 66.249.0.0/16
            if (ip.startsWith("66.249.")) return true;
        }
        return false;
    }
}
