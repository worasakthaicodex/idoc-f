package com.idoc.modules.customer.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BasketShareRepository extends JpaRepository<BasketShare, UUID> {

    List<BasketShare> findByBasketId(UUID basketId);

    @Modifying
    @Query("delete from BasketShare s where s.basketId = :basketId")
    void deleteByBasketId(@Param("basketId") UUID basketId);
}
