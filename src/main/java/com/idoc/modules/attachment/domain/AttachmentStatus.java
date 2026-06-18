package com.idoc.modules.attachment.domain;

public enum AttachmentStatus {
    PENDING,  // ออก upload url แล้ว รอ client อัปโหลด+confirm
    READY     // อัปโหลดเสร็จ ยืนยันแล้ว
}
