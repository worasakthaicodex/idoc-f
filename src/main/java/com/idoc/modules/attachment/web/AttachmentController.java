package com.idoc.modules.attachment.web;

import com.idoc.modules.attachment.application.AttachmentService;
import com.idoc.modules.attachment.application.dto.AttachmentResponse;
import com.idoc.modules.attachment.application.dto.StorageUsageResponse;
import com.idoc.modules.attachment.application.dto.UploadUrlRequest;
import com.idoc.modules.attachment.application.dto.UploadUrlResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    /** 1) ขอ presigned URL (client เอาไป PUT ไฟล์ตรงขึ้น storage) */
    @PostMapping("/upload-url")
    public UploadUrlResponse uploadUrl(@Valid @RequestBody UploadUrlRequest request) {
        return attachmentService.createUploadUrl(request);
    }

    /** 2) ยืนยันหลังอัปโหลดเสร็จ → metadata พร้อมใช้ */
    @PostMapping("/{id}/confirm")
    public AttachmentResponse confirm(@PathVariable UUID id) {
        return attachmentService.confirm(id);
    }

    /** รายการไฟล์ของ owner หนึ่ง (เช่น พนักงานคนหนึ่ง) */
    @GetMapping
    public List<AttachmentResponse> list(@RequestParam String ownerType, @RequestParam String ownerId) {
        return attachmentService.list(ownerType, ownerId);
    }

    /** ออก signed URL สำหรับดาวน์โหลด (หมดอายุได้) */
    @GetMapping("/{id}/download-url")
    public Map<String, String> downloadUrl(@PathVariable UUID id) {
        return Map.of("url", attachmentService.downloadUrl(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        attachmentService.delete(id);
    }

    /** พื้นที่ที่ใช้ไป / โควตา ของบริษัท */
    @GetMapping("/usage")
    public StorageUsageResponse usage() {
        return attachmentService.usage();
    }

    /** พื้นที่รวมทั้งระบบ (ทุกบริษัท) — หน้า "จัดการ server" ของเจ้าของระบบ */
    @GetMapping("/usage-all")
    public StorageUsageResponse usageAll() {
        return attachmentService.usageAll();
    }
}
