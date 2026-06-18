package com.idoc.modules.appmodule.application;

import com.idoc.modules.appmodule.application.dto.CreateModuleRequest;
import com.idoc.modules.appmodule.application.dto.ModuleResponse;
import com.idoc.modules.appmodule.application.dto.UpdateModuleRequest;
import java.util.List;
import java.util.UUID;

public interface AppModuleService {

    List<ModuleResponse> list(boolean includeInactive);

    ModuleResponse create(CreateModuleRequest request);

    ModuleResponse update(UUID id, UpdateModuleRequest request);

    void delete(UUID id);
}
