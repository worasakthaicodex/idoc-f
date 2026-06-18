package com.idoc.modules.activity.application;

import com.idoc.modules.activity.domain.ActivityRepository;
import com.idoc.modules.activity.domain.ActivityStatus;
import java.time.Instant;
import java.time.ZonedDateTime;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** ลบรายการเครื่องมือที่ถูกขีดออก (VOID) เมื่อครบ 6 เดือน — รันข้ามทุกบริษัท */
@Component
@RequiredArgsConstructor
public class ActivityPurgeJob {

    private static final Logger log = LoggerFactory.getLogger(ActivityPurgeJob.class);

    private final ActivityRepository activityRepository;

    /** ทุกวัน 03:10 */
    @Scheduled(cron = "0 10 3 * * *")
    @Transactional
    public void purgeVoided() {
        Instant cutoff = ZonedDateTime.now().minusMonths(6).toInstant();
        int removed = activityRepository.purgeVoidedBefore(ActivityStatus.VOID, cutoff);
        if (removed > 0) {
            log.info("activity purge: removed {} voided entries older than 6 months", removed);
        }
    }
}
