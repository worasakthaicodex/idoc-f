package com.idoc.modules.customer.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BasketItemRepository extends JpaRepository<BasketItem, UUID> {

    long countByBasketId(UUID basketId);

    boolean existsByBasketIdAndCustomerRef(UUID basketId, String customerRef);

    Optional<BasketItem> findByBasketIdAndCustomerRef(UUID basketId, String customerRef);

    /** ใครถือลูกค้าเหล่านี้ไว้ในตะกร้าใดของบริษัทนี้บ้าง → [customerRef, basketId, owner, basketName] */
    @Query("select i.customerRef, i.basketId, b.owner, b.name from BasketItem i, Basket b "
            + "where b.id = i.basketId and b.companyId = :cid and i.customerRef in :refs")
    java.util.List<Object[]> findHolders(@Param("cid") UUID companyId, @Param("refs") java.util.Collection<String> refs);

    @Modifying
    @Query("delete from BasketItem i where i.basketId = :basketId and i.customerRef = :ref")
    int deleteByBasketIdAndCustomerRef(@Param("basketId") UUID basketId, @Param("ref") String ref);

    @Modifying
    @Query("delete from BasketItem i where i.basketId = :basketId")
    int deleteByBasketId(@Param("basketId") UUID basketId);
}
