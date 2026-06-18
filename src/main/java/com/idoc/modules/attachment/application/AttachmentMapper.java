package com.idoc.modules.attachment.application;

import com.idoc.modules.attachment.application.dto.AttachmentResponse;
import com.idoc.modules.attachment.domain.Attachment;

final class AttachmentMapper {
    private AttachmentMapper() {
    }

    static AttachmentResponse toResponse(Attachment a) {
        return new AttachmentResponse(
                a.getId(), a.getOwnerType(), a.getOwnerId(), a.getFilename(),
                a.getContentType(), a.getSizeBytes(), a.getStatus(), a.getCreatedAt(),
                a.getCategory(), a.getSourceRef());
    }
}
