package com.idoc.shared.notify;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * ศูนย์ push แจ้งเตือนแบบ realtime (SSE) — แทนการ poll วน
 *   registry: company → (user → รายการ emitter ที่เปิดจออยู่)
 *   subscribe(): หน้าเปิด stream ค้างไว้ · publish(): ตอนมีเหตุการณ์ (เช่นส่งเอกสารถึงผู้รับ) ยิงไปเฉพาะคนนั้น
 * user = ตัวระบุเดียวกับฝั่งหน้า (fullName/email/companyCode) ที่อยู่ใน sent.recipients
 */
@Component
public class SseHub {

    private final Map<UUID, Map<String, CopyOnWriteArrayList<SseEmitter>>> clients = new ConcurrentHashMap<>();
    private final ScheduledExecutorService pinger = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sse-ping");
        t.setDaemon(true);
        return t;
    });

    public SseHub() {
        // heartbeat กัน proxy/เบราว์เซอร์ตัดสาย idle (EventSource จะ reconnect เองถ้าหลุด)
        pinger.scheduleAtFixedRate(this::pingAll, 25, 25, TimeUnit.SECONDS);
    }


    //หน้าเปิด stream ค้างไว้ — คืน emitter ที่ผูกกับ (company,user) 
    public SseEmitter subscribe(UUID company, String user) {
        SseEmitter emitter = new SseEmitter(0L);   // ไม่หมดเวลาเอง
        CopyOnWriteArrayList<SseEmitter> list = clients
                .computeIfAbsent(company, c -> new ConcurrentHashMap<>())
                .computeIfAbsent(user, u -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> { list.remove(emitter); emitter.complete(); });
        emitter.onError(e -> list.remove(emitter));
        try { emitter.send(SseEmitter.event().name("ready").data("ok")); } catch (IOException ignored) {  }
        return emitter;}


/** หน้าเปิด stream ค้างไว้ — คืน emitter ที่ผูกกับ (company,user) 
    public SseEmitter subscribe(UUID company, String user) {
        
        // 🎯 1. เปลี่ยนจาก 0L เป็น 40 วินาที (40_000L) 
        // สั้นกำลังดี สอดรับกับรอบ Ping 25 วินาที ไม่กินแรมค้าง และเคลียร์ท่อผีดิบไวมาก
        SseEmitter emitter = new SseEmitter(0L);   
        
        CopyOnWriteArrayList<SseEmitter> list = clients
                .computeIfAbsent(company, c -> new ConcurrentHashMap<>())
                .computeIfAbsent(user, u -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        
        // 🎯 2. ตรวจสอบบล็อกการคืนพื้นที่ให้ครบถ้วน
        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> { 
            list.remove(emitter); 
            try { emitter.complete(); } catch (Exception ignored) {} 
        });
        emitter.onError(e -> list.remove(emitter));
        
        try { 
            emitter.send(SseEmitter.event().name("ready").data("ok")); 
        } catch (IOException ignored) { 
            list.remove(emitter); // ถ้ายิงนัดแรกไม่ผ่าน แปลว่าหลุดตั้งแต่เกิด ให้ลบทิ้งทันที
        }
        
        return emitter;
    }
*/


    /** ยิงเหตุการณ์ไปยังผู้รับที่ระบุ (เฉพาะคนที่เปิดจออยู่ใน company นั้น) */
    public void publish(UUID company, List<String> users, String event, Object payload) {
        if (company == null || users == null || users.isEmpty()) return;
        Map<String, CopyOnWriteArrayList<SseEmitter>> byUser = clients.get(company);
        if (byUser == null) return;
        for (String u : users) {
            CopyOnWriteArrayList<SseEmitter> list = byUser.get(u);
            if (list == null) continue;
            for (SseEmitter em : list) {
                try { em.send(SseEmitter.event().name(event).data(payload)); }
                catch (IOException e) { list.remove(em); }
            }
        }
    }

    private void pingAll() {
        for (Map<String, CopyOnWriteArrayList<SseEmitter>> byUser : clients.values()) {
            for (CopyOnWriteArrayList<SseEmitter> list : byUser.values()) {
                for (SseEmitter em : list) {
                    try { em.send(SseEmitter.event().comment("ping")); }
                    catch (Exception e) { list.remove(em); }
                }
            }
        }
    }
}
