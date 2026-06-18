package com.idoc.modules.customer.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BasketRepository extends JpaRepository<Basket, UUID> {

    Optional<Basket> findByIdAndCompanyId(UUID id, UUID companyId);

    /** ตะกร้าที่ผูกกับเอกสาร (เช่น CL) — ตะกร้า "ซื้อจริง" ที่ซ่อนไว้ */
    Optional<Basket> findByCompanyIdAndRefTypeAndRefCode(UUID companyId, String refType, String refCode);

    /** ตะกร้า wishlist ที่ผู้ใช้นี้ "เห็นได้" — ของตัวเอง หรือถูกแชร์มา (ไม่รวมตะกร้าที่ผูกเอกสาร) */
    @Query("select b from Basket b where b.companyId = :cid and b.refType is null and "
            + "(b.owner = :me or exists (select 1 from BasketShare s where s.basketId = b.id and s.sharedWith = :me)) "
            + "order by b.createdAt desc")
    List<Basket> findVisible(@Param("cid") UUID companyId, @Param("me") String me);
}
