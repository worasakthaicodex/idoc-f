package com.idoc.modules.attachment.application;

import com.idoc.modules.attachment.application.dto.AttachmentResponse;
import com.idoc.modules.attachment.application.dto.StorageUsageResponse;
import com.idoc.modules.attachment.application.dto.UploadUrlRequest;
import com.idoc.modules.attachment.application.dto.UploadUrlResponse;
import java.util.List;
import java.util.UUID;

public interface AttachmentService {

    UploadUrlResponse createUploadUrl(UploadUrlRequest request);

    AttachmentResponse confirm(UUID id);

    List<AttachmentResponse> list(String ownerType, String ownerId);

    String downloadUrl(UUID id);

    void delete(UUID id);

    StorageUsageResponse usage();

    /** พื้นที่ที่ใช้รวมทั้งระบบ (ทุกบริษัท) — เจ้าของระบบดูภาพรวม Firebase */
    StorageUsageResponse usageAll();
}
