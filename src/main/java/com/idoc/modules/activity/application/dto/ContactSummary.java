package com.idoc.modules.activity.application.dto;

import java.time.Instant;

/**
 * สรุปวันติดต่อล่าสุดต่อลูกค้า — lastComm (สื่อสาร) / lastCall (ผลโทร)
 * ฝั่งหน้าเลือกใช้ comm ก่อน ไม่มีค่อยใช้ call (ตามกติกา "พร้อมใช้")
 */
public record ContactSummary(String customerCode, Instant lastComm, Instant lastCall) {
}
