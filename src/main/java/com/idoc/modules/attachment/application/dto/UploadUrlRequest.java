package com.idoc.modules.attachment.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UploadUrlRequest(
        @NotBlank @Size(max = 40) String ownerType,
        @NotBlank @Size(max = 64) String ownerId,
        @NotBlank @Size(max = 255) String filename,
        @Size(max = 120) String contentType,
        @PositiveOrZero long sizeBytes,
        @Size(max = 80) String category,
        @Size(max = 40) String sourceRef
) {
}
