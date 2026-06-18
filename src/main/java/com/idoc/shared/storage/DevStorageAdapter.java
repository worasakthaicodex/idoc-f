package com.idoc.shared.storage;

import java.time.Duration;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * adapter สำหรับ dev/test — ไม่ขึ้น storage จริง คืน URL จำลอง
 * ใช้ทดสอบ flow metadata ได้โดยไม่ต้องตั้ง credential (default เมื่อไม่ได้ตั้ง storage.provider)
 */
@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "dev", matchIfMissing = true)
public class DevStorageAdapter implements StoragePort {

    @Override
    public UploadTarget createUploadUrl(String key, String contentType, Duration ttl) {
        return new UploadTarget("https://dev-storage.local/upload/" + key, "PUT",
                Map.of("Content-Type", contentType == null ? "application/octet-stream" : contentType));
    }

    @Override
    public String createDownloadUrl(String key, Duration ttl) {
        return "https://dev-storage.local/file/" + key;
    }

    @Override
    public void delete(String key) {
        // no-op (dev)
    }
}
