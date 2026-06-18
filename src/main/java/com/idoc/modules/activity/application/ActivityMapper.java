package com.idoc.modules.activity.application;

import com.idoc.modules.activity.application.dto.ActivityResponse;
import com.idoc.modules.activity.domain.Activity;

final class ActivityMapper {

    private ActivityMapper() {
    }

    static ActivityResponse toResponse(Activity a) {
        return new ActivityResponse(
                a.getId(), a.getKind(), a.getSubjectType(), a.getSubjectCode(),
                a.getParentType(), a.getParentCode(), a.getCustomerCode(),
                a.getOccurredAt(), a.getCreatedBy(), a.getPayload(),
                a.getStatus(), a.getVoidedAt(), a.getCreatedAt());
    }
}
