package com.idoc.modules.product.application;

import com.idoc.modules.product.domain.ProductRepository;
import com.idoc.modules.product.domain.ProductStatus;
import java.time.Instant;
import java.time.ZonedDateTime;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** ลบสินค้าที่ตั้งสถานะ "รอลบ" (PENDING_DELETE) เมื่อครบ 6 เดือน — รันข้ามทุกบริษัท */
@Component
@RequiredArgsConstructor
public class ProductPurgeJob {

    private static final Logger log = LoggerFactory.getLogger(ProductPurgeJob.class);

    private final ProductRepository productRepository;

    /** ทุกวัน 03:10 */
    @Scheduled(cron = "0 10 3 * * *")
    @Transactional
    public void purgePendingDelete() {
        Instant cutoff = ZonedDateTime.now().minusMonths(6).toInstant();
        int removed = productRepository.purgePendingDeleteBefore(ProductStatus.PENDING_DELETE, cutoff);
        if (removed > 0) {
            log.info("product purge: removed {} products pending-delete over 6 months", removed);
        }
    }
}
