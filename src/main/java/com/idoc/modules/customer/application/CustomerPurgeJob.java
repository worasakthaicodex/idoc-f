package com.idoc.modules.customer.application;

import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.customer.domain.CustomerStatus;
import java.time.Instant;
import java.time.ZonedDateTime;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** ลบลูกค้าที่ตั้งสถานะ "รอลบ" (PENDING_DELETE) เมื่อครบ 1 ปี — รันข้ามทุกบริษัท */
@Component
@RequiredArgsConstructor
public class CustomerPurgeJob {

    private static final Logger log = LoggerFactory.getLogger(CustomerPurgeJob.class);

    private final CustomerRepository customerRepository;

    /** ทุกวัน 03:00 */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgePendingDelete() {
        Instant cutoff = ZonedDateTime.now().minusYears(1).toInstant();
        int removed = customerRepository.purgePendingDeleteBefore(CustomerStatus.PENDING_DELETE, cutoff);
        if (removed > 0) {
            log.info("customer purge: removed {} customers pending-delete over 1 year", removed);
        }
    }
}
