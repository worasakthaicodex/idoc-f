package com.idoc.modules.geo.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ThaiAddressRepository extends JpaRepository<ThaiAddress, UUID> {

    @Query("""
            select a from ThaiAddress a
            where a.subDistrict like %:q%
               or a.district like %:q%
               or a.province like %:q%
               or a.zipcode like :q%
            order by a.province, a.district, a.subDistrict
            """)
    List<ThaiAddress> search(@Param("q") String q, Pageable pageable);
}
