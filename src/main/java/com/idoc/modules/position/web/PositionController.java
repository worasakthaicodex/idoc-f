package com.idoc.modules.position.web;

import com.idoc.modules.position.application.PositionService;
import com.idoc.modules.position.application.dto.CreatePositionRequest;
import com.idoc.modules.position.application.dto.PositionResponse;
import com.idoc.modules.position.application.dto.UpdatePositionRequest;
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
@RequestMapping("/api/admin/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionService positionService;

    @GetMapping
    public List<PositionResponse> list() {
        return positionService.list();
    }

    @GetMapping("/{id}")
    public PositionResponse get(@PathVariable UUID id) {
        return positionService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PositionResponse create(@Valid @RequestBody CreatePositionRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return positionService.create(request);
    }

    @PutMapping("/{id}")
    public PositionResponse update(@PathVariable UUID id, @Valid @RequestBody UpdatePositionRequest request) {
        AccessGuard.requireAdmin(AccessGuard.HR);
        return positionService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        positionService.delete(id);
    }
}
