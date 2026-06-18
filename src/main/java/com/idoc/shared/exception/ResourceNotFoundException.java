package com.idoc.shared.exception;

/** โยนเมื่อหา resource ตาม id/key ไม่เจอ → map เป็น HTTP 404 */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException of(String entity, Object id) {
        return new ResourceNotFoundException("ไม่พบ %s (id=%s)".formatted(entity, id));
    }
}
