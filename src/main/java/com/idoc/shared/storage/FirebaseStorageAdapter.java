package com.idoc.shared.storage;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import java.net.URL;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Firebase Storage (= Google Cloud Storage) ผ่าน signed URL (V4)
 * เปิดใช้ด้วย config: storage.provider=firebase + storage.firebase.bucket + GOOGLE_APPLICATION_CREDENTIALS
 *
 * หมายเหตุค่าใช้จ่าย: GCS egress แพง — ถ้าไฟล์โหลดบ่อย ค่อยสลับ adapter เป็น R2 (egress ฟรี)
 */
@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "firebase")
public class FirebaseStorageAdapter implements StoragePort {

    private final Storage storage;
    private final String bucket;

    public FirebaseStorageAdapter(@Value("${storage.firebase.bucket}") String bucket) {
        this.bucket = bucket;
        this.storage = StorageOptions.getDefaultInstance().getService(); // ใช้ GOOGLE_APPLICATION_CREDENTIALS
    }

    @Override
    public UploadTarget createUploadUrl(String key, String contentType, Duration ttl) {
        String ct = contentType == null ? "application/octet-stream" : contentType;
        BlobInfo info = BlobInfo.newBuilder(BlobId.of(bucket, key)).setContentType(ct).build();
        URL url = storage.signUrl(info, ttl.toMinutes(), TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withContentType(),
                Storage.SignUrlOption.withV4Signature());
        return new UploadTarget(url.toString(), "PUT", Map.of("Content-Type", ct));
    }

    @Override
    public String createDownloadUrl(String key, Duration ttl) {
        BlobInfo info = BlobInfo.newBuilder(BlobId.of(bucket, key)).build();
        URL url = storage.signUrl(info, ttl.toMinutes(), TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withV4Signature());
        return url.toString();
    }

    @Override
    public void delete(String key) {
        storage.delete(BlobId.of(bucket, key));
    }
}
