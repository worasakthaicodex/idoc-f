package com.idoc.shared.exception;

/** โยนเมื่อผู้ใช้ไม่มีสิทธิ์ดำเนินการ → map เป็น HTTP 403 */
public class ForbiddenException extends RuntimeException {

    private final String code;

    public ForbiddenException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
