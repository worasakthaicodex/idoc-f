package com.idoc.modules.position.application;

import com.idoc.modules.position.application.dto.CreatePositionRequest;
import com.idoc.modules.position.application.dto.PositionResponse;
import com.idoc.modules.position.application.dto.UpdatePositionRequest;
import java.util.List;
import java.util.UUID;

public interface PositionService {

    List<PositionResponse> list();

    PositionResponse get(UUID id);

    PositionResponse create(CreatePositionRequest request);

    PositionResponse update(UUID id, UpdatePositionRequest request);

    void delete(UUID id);
}
