package com.idoc.modules.customer.application.dto;

import java.util.List;

/**
 * ผลการใส่ลงตะกร้า — added = จำนวนที่เพิ่มจริง · conflicts = รายที่หยิบไม่ได้
 * เพราะมีคนถือไว้ในตะกร้าอื่นแล้ว (ลูกค้า 1 รายอยู่ได้ตะกร้าเดียวทั้งบริษัท)
 */
public record AddBasketResult(int added, List<Held> conflicts) {

    /** ลูกค้าที่ถูกถือไว้แล้ว — code = รหัสลูกค้า · owner = เจ้าของตะกร้า · basketName = ชื่อตะกร้า */
    public record Held(String code, String owner, String basketName) {}
}
