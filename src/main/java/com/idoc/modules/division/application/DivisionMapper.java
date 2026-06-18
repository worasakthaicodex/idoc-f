package com.idoc.modules.division.application;

import com.idoc.modules.division.application.dto.DivisionResponse;
import com.idoc.modules.division.domain.Division;

final class DivisionMapper {
    private DivisionMapper() {
    }

    static DivisionResponse toResponse(Division d) {
        return new DivisionResponse(d.getId(), d.getCode(), d.getName());
    }
}
