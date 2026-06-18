package com.idoc.shared.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** เปิดใช้งาน @Scheduled ทั้งระบบ (งาน purge ของแต่ละโมดูล) */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
