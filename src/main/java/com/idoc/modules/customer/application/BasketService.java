package com.idoc.modules.customer.application;

import com.idoc.modules.customer.application.dto.AddBasketResult;
import com.idoc.modules.customer.application.dto.AddToBasketRequest;
import com.idoc.modules.customer.application.dto.BasketDto;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.BasketRow;
import java.util.List;
import java.util.UUID;

/** ตะกร้ารายชื่อลูกค้า — ของผู้ใช้ (owner) ในบริษัทปัจจุบัน */
public interface BasketService {

    List<BasketDto> list(String owner);

    BasketDto create(String owner, String name);

    /** แก้ชื่อ/เหตุผลรวมของตะกร้า */
    BasketDto update(UUID basketId, String name, String note);

    void delete(UUID basketId);

    List<BasketRow> items(UUID basketId);

    /** ใส่ลงตะกร้า (codes ตรง ๆ หรือยกก้อนจากกลุ่ม/bucket) — คืนจำนวนที่เพิ่ม + รายที่หยิบไม่ได้ (มีคนถือไว้) */
    AddBasketResult add(UUID basketId, AddToBasketRequest req);

    void removeItem(UUID basketId, String customerRef);

    /** แก้เหตุผล/วันที่ต้องหยิบออกของรายการในตะกร้า */
    void updateItem(UUID basketId, String customerRef, String reason, String removeBy);

    /** รายชื่อผู้ใช้ที่ตะกร้านี้ถูกแชร์ให้ (รหัสพนักงาน) */
    List<String> shares(UUID basketId);

    /** ตั้งรายชื่อผู้ใช้ที่แชร์ให้ (แทนที่ทั้งหมด) */
    void setShares(UUID basketId, List<String> users);
}
