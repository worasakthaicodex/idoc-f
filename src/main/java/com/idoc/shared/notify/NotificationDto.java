package com.idoc.shared.notify;

import java.time.Instant;
import java.util.UUID;

/** แจ้งเตือน (รับ/ส่งกับหน้าเว็บ) */
public record NotificationDto(
        UUID id,
        String kind,
        String title,
        String body,
        String refType,
        String refCode,
        String byUser,
        Instant createdAt,
        Instant readAt) {

    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getKind(), n.getTitle(), n.getBody(),
                n.getRefType(), n.getRefCode(), n.getByUser(), n.getCreatedAt(), n.getReadAt());
    }
}
