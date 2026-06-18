package com.idoc.modules.division.application;

import com.idoc.modules.division.application.dto.CreateDivisionRequest;
import com.idoc.modules.division.application.dto.DivisionResponse;
import com.idoc.modules.division.application.dto.UpdateDivisionRequest;
import java.util.List;
import java.util.UUID;

public interface DivisionService {
    List<DivisionResponse> list();

    DivisionResponse get(UUID id);

    DivisionResponse create(CreateDivisionRequest request);

    DivisionResponse update(UUID id, UpdateDivisionRequest request);

    void delete(UUID id);
}
