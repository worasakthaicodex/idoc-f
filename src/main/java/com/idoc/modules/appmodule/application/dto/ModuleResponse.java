package com.idoc.modules.appmodule.application.dto;

import java.util.UUID;

public record ModuleResponse(UUID id, String code, String name, String nameEn, int sortOrder, boolean active) {
}
