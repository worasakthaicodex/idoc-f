package com.idoc.modules.activity.application.dto;

import java.time.Instant;
import java.util.Map;

public record UpdateActivityRequest(
        Instant occurredAt,
        Map<String, String> payload
) {
}
