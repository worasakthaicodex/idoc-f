package com.idoc.modules.appmodule.web;

import com.idoc.modules.appmodule.application.AppModuleService;
import com.idoc.modules.appmodule.application.dto.CreateModuleRequest;
import com.idoc.modules.appmodule.application.dto.ModuleResponse;
import com.idoc.modules.appmodule.application.dto.UpdateModuleRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** ทะเบียนโมดูล (global) — list ใช้ได้ทุกคน, จัดการโดยเจ้าของระบบ */
@RestController
@RequestMapping("/api/admin/modules")
@RequiredArgsConstructor
public class AppModuleController {

    private final AppModuleService appModuleService;

    @GetMapping
    public List<ModuleResponse> list(@RequestParam(defaultValue = "false") boolean all) {
        return appModuleService.list(all);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ModuleResponse create(@Valid @RequestBody CreateModuleRequest request) {
        return appModuleService.create(request);
    }

    @PutMapping("/{id}")
    public ModuleResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateModuleRequest request) {
        return appModuleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        appModuleService.delete(id);
    }
}
