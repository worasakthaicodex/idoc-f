package com.idoc.modules.position.application;

import com.idoc.modules.position.application.dto.ModulePermission;
import com.idoc.modules.position.application.dto.PositionResponse;
import com.idoc.modules.position.domain.Position;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

final class PositionMapper {

    private PositionMapper() {
    }

    static PositionResponse toResponse(Position p) {
        return new PositionResponse(
                p.getId(), p.getCode(), p.getName(), p.getDescription(),
                split(p.getModules()), p.getDepartment(), p.getDivision());
    }

    /** csv "module:LEVEL,module:LEVEL" → list (ของเดิมที่ไม่มีระดับ ถือเป็น USER) */
    static List<ModulePermission> split(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .map(tok -> {
                    int i = tok.indexOf(':');
                    if (i < 0) return new ModulePermission(tok, "USER");
                    return new ModulePermission(tok.substring(0, i).trim(), tok.substring(i + 1).trim());
                })
                .toList();
    }

    static String join(List<ModulePermission> perms) {
        if (perms == null) return "";
        return perms.stream()
                .filter(p -> p.module() != null && !p.module().isBlank())
                .map(p -> p.module().trim() + ":" + (p.level() == null || p.level().isBlank() ? "USER" : p.level().trim()))
                .collect(Collectors.joining(","));
    }
}
