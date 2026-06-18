package com.idoc.shared.storage;

import java.util.Map;

/** ปลายทางอัปโหลด — client เอา url+method+headers ไป PUT ไฟล์ตรงขึ้น storage */
public record UploadTarget(String url, String method, Map<String, String> headers) {
}
