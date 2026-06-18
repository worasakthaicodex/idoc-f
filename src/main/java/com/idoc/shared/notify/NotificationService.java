package com.idoc.shared.notify;

import com.idoc.shared.tenant.TenantContext;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * แจ้งเตือนที่ "เขียนไว้" ตอนมีเหตุการณ์จริง (ส่งเอกสาร/ปิดการขายได้) — ไม่ poll
 *  - notify(): persist รายผู้รับ + push สัญญาณผ่าน SSE ให้คนที่เปิดหน้าอยู่ค่อยดึงรายการ (event-driven)
 *  - list()/unread(): ฝั่งหน้าอ่านตอนเปิดแอป + ตอนเปิดกระดิ่ง
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;
    private final SseHub hub;

    /** เขียนแจ้งเตือนถึงผู้รับหลายคน + push "notify" ให้คนที่ออนไลน์อยู่ */
    @Transactional
    public void notify(UUID tenant, List<String> recipients, String kind, String title,
                       String body, String refType, String refCode, String byUser) {
        if (tenant == null || recipients == null) return;
        List<String> uniq = recipients.stream()
                .filter(r -> r != null && !r.isBlank())
                .distinct().toList();
        if (uniq.isEmpty()) return;
        for (String r : uniq) {
            Notification n = new Notification();
            n.setCompanyId(tenant);
            n.setRecipient(r);
            n.setKind(kind);
            n.setTitle(title);
            n.setBody(body);
            n.setRefType(refType);
            n.setRefCode(refCode);
            n.setByUser(byUser);
            repo.save(n);
        }
        // สัญญาณ realtime — คนที่เปิดหน้าอยู่ค่อยดึงรายการ (ไม่ส่งทั้ง payload, กันข้อมูลค้าง)
        hub.publish(tenant, uniq, "notify", Map.of(
                "kind", kind,
                "refType", refType == null ? "" : refType,
                "refCode", refCode == null ? "" : refCode));
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(String user, int limit) {
        UUID tenant = TenantContext.required();
        return repo.findByCompanyIdAndRecipientOrderByCreatedAtDesc(tenant, user, PageRequest.of(0, Math.max(1, limit)))
                .stream().map(NotificationDto::from).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(String user) {
        return repo.countByCompanyIdAndRecipientAndReadAtIsNull(TenantContext.required(), user);
    }

    @Transactional
    public void markRead(UUID id) {
        UUID tenant = TenantContext.required();
        repo.findById(id).ifPresent(n -> {
            if (n.getCompanyId().equals(tenant) && n.getReadAt() == null) {
                n.setReadAt(Instant.now());
                repo.save(n);
            }
        });
    }

    @Transactional
    public int markAllRead(String user) {
        return repo.markAllRead(TenantContext.required(), user);
    }
}
