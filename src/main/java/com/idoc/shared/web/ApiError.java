package com.idoc.shared.web;

import java.time.Instant;
import java.util.Map;

/**
 * รูปแบบ error response มาตรฐานของทั้งระบบ
 * `code` = machine key สำหรับให้ client แปลภาษา (เช่น "auth.invalid_credentials")
 * `message` = ข้อความ English เป็น fallback (เมื่อ client ไม่มีคำแปลของ code นั้น)
 */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        Map<String, String> fieldErrors
) {
    public static ApiError of(int status, String error, String code, String message) {
        return new ApiError(Instant.now(), status, error, code, message, null);
    }

    public static ApiError validation(String message, Map<String, String> fieldErrors) {
        return new ApiError(Instant.now(), 400, "Bad Request", "common.validation", message, fieldErrors);
    }
}
