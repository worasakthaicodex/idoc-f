package com.idoc.modules.division.web;

import com.idoc.modules.division.application.DivisionService;
import com.idoc.modules.division.application.dto.CreateDivisionRequest;
import com.idoc.modules.division.application.dto.DivisionResponse;
import com.idoc.modules.division.application.dto.UpdateDivisionRequest;
import com.idoc.shared.access.AccessGuard;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/divisions")
@RequiredArgsConstructor
public class DivisionController {

    private final DivisionService divisionService;

    @GetMapping
    public List<DivisionResponse> list() {
        return divisionService.list();
    }

    @GetMapping("/{id}")
    public DivisionResponse get(@PathVariable UUID id) {
        return divisionService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DivisionResponse create(@Valid @RequestBody CreateDivisionRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return divisionService.create(request);
    }

    @PutMapping("/{id}")
    public DivisionResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateDivisionRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return divisionService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        divisionService.delete(id);
    }
}
