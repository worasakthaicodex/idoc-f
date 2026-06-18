package com.idoc.shared.exception;

/**
 * โยนเมื่อผิดกฎทางธุรกิจ (เช่น code ซ้ำ, เปลี่ยนสถานะไม่ได้) → map เป็น HTTP 409
 *
 * รองรับ i18n: ใส่ machine `code` (เช่น "auth.invalid_credentials") ให้ client แปลภาษาเอง
 * ส่วน message = ข้อความ English เป็น default/fallback (ไม่ผูกภาษากับ API)
 */
public class BusinessException extends RuntimeException {

    private final String code;

    public BusinessException(String message) {
        this(null, message);
    }

    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
