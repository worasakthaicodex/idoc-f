package com.idoc.modules.position.application.dto;

/**
 * สิทธิ์ระดับโมดูล: module = ชื่อโมดูล (canonical), level = USER | ADMIN | SUPER_ADMIN
 * (ไม่อยู่ในลิสต์ = ไม่มีสิทธิ์เข้าโมดูลนั้น)
 */
public record ModulePermission(String module, String level) {
}
