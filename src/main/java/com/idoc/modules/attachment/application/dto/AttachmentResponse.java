package com.idoc.modules.attachment.application.dto;

import com.idoc.modules.attachment.domain.AttachmentStatus;
import java.time.Instant;
import java.util.UUID;

public record AttachmentResponse(
        UUID id,
        String ownerType,
        String ownerId,
        String filename,
        String contentType,
        long sizeBytes,
        AttachmentStatus status,
        Instant createdAt,
        String category,
        String sourceRef
) {
}
