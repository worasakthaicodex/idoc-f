package com.idoc.modules.customer.application.dto;

import java.util.UUID;

/** ตะกร้า (สำหรับรายการ) — count = จำนวนรายชื่อ · owner = เจ้าของ (รหัสพนักงาน) · ฝั่งหน้าเทียบกับตัวเองเพื่อรู้ว่าเป็นของเรา/ถูกแชร์มา */
public record BasketDto(UUID id, String name, long count, String owner, String note) {}
