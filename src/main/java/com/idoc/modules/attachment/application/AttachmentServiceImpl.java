package com.idoc.modules.attachment.application;

import com.idoc.modules.attachment.application.dto.AttachmentResponse;
import com.idoc.modules.attachment.application.dto.StorageUsageResponse;
import com.idoc.modules.attachment.application.dto.UploadUrlRequest;
import com.idoc.modules.attachment.application.dto.UploadUrlResponse;
import com.idoc.modules.attachment.domain.Attachment;
import com.idoc.modules.attachment.domain.AttachmentRepository;
import com.idoc.modules.attachment.domain.AttachmentStatus;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.storage.StoragePort;
import com.idoc.shared.storage.UploadTarget;
import com.idoc.shared.tenant.TenantContext;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {

    private static final Duration UPLOAD_TTL = Duration.ofMinutes(15);
    private static final Duration DOWNLOAD_TTL = Duration.ofMinutes(10);

    private final AttachmentRepository repository;
    private final StoragePort storage;

    @Value("${storage.quota-bytes:107374182400}") // 100GB ต่อบริษัท (ปรับตามแพ็กเกจภายหลัง)
    private long quotaBytes;

    @Override
    public UploadUrlResponse createUploadUrl(UploadUrlRequest req) {
        UUID tenant = TenantContext.required();

        long used = repository.sumSize(tenant, AttachmentStatus.READY);
        if (used + req.sizeBytes() > quotaBytes) {
            throw new BusinessException("attachment.quota_exceeded", "Storage quota exceeded");
        }

        String key = "companies/%s/%s/%s-%s".formatted(
                tenant, safe(req.ownerType()), UUID.randomUUID(), safeName(req.filename()));

        Attachment a = repository.save(Attachment.createPending(
                tenant, req.ownerType(), req.ownerId(), req.filename(),
                req.contentType(), req.sizeBytes(), key, null, req.category(), req.sourceRef()));

        UploadTarget target = storage.createUploadUrl(key, req.contentType(), UPLOAD_TTL);
        return new UploadUrlResponse(a.getId(), target.url(), target.method(), target.headers(), key);
    }

    @Override
    public AttachmentResponse confirm(UUID id) {
        Attachment a = findScoped(id);
        a.markReady();
        return AttachmentMapper.toResponse(a);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(String ownerType, String ownerId) {
        return repository.findByCompanyIdAndOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(
                        TenantContext.required(), ownerType, ownerId, AttachmentStatus.READY)
                .stream().map(AttachmentMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public String downloadUrl(UUID id) {
        return storage.createDownloadUrl(findScoped(id).getStorageKey(), DOWNLOAD_TTL);
    }

    @Override
    public void delete(UUID id) {
        Attachment a = findScoped(id);
        storage.delete(a.getStorageKey());
        repository.delete(a);
    }

    @Override
    @Transactional(readOnly = true)
    public StorageUsageResponse usage() {
        return new StorageUsageResponse(
                repository.sumSize(TenantContext.required(), AttachmentStatus.READY), quotaBytes);
    }

    @Override
    @Transactional(readOnly = true)
    public StorageUsageResponse usageAll() {
        return new StorageUsageResponse(repository.sumSizeAll(AttachmentStatus.READY), quotaBytes);
    }

    private Attachment findScoped(UUID id) {
        return repository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Attachment", id));
    }

    private static String safe(String s) {
        return s == null ? "misc" : s.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static String safeName(String s) {
        return s == null ? "file" : s.replaceAll("[/\\\\\\s]+", "_");
    }
}
