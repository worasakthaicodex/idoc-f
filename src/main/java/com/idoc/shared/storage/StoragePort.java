package com.idoc.shared.storage;

import java.time.Duration;

/**
 * สัญญากลางของที่เก็บไฟล์ — แอปเรียกผ่านนี้เท่านั้น
 * สลับ provider (Firebase/R2/B2) ได้โดยไม่แตะโค้ดแอป (เปลี่ยนแค่ adapter + config)
 */
public interface StoragePort {

    /** ออก presigned URL ให้ client อัปโหลดไฟล์ตรง (bytes ไม่ผ่าน backend) */
    UploadTarget createUploadUrl(String key, String contentType, Duration ttl);

    /** ออก signed URL ให้ดาวน์โหลด (หมดอายุได้ — ไฟล์ private) */
    String createDownloadUrl(String key, Duration ttl);

    /** ลบไฟล์จริงออกจาก storage */
    void delete(String key);
}
