package com.idoc.modules.attachment.application.dto;

import java.util.Map;
import java.util.UUID;

/** ส่งให้ client เอาไป PUT ไฟล์ตรงขึ้น storage แล้วค่อยเรียก confirm */
public record UploadUrlResponse(
        UUID attachmentId,
        String uploadUrl,
        String method,
        Map<String, String> headers,
        String storageKey
) {
}
