package com.idoc.modules.appmodule.application;

import com.idoc.modules.appmodule.application.dto.ModuleResponse;
import com.idoc.modules.appmodule.domain.AppModule;

final class AppModuleMapper {
    private AppModuleMapper() {
    }

    static ModuleResponse toResponse(AppModule m) {
        return new ModuleResponse(m.getId(), m.getCode(), m.getName(), m.getNameEn(), m.getSortOrder(), m.isActive());
    }
}
