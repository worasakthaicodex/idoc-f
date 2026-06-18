package com.idoc.modules.workflow.application;

import com.idoc.modules.workflow.application.dto.AuthoritiesResponse;
import com.idoc.modules.workflow.application.dto.StagesResponse;
import java.util.List;
import java.util.Map;

public interface WorkflowService {

    StagesResponse getStages(String docType);

    StagesResponse saveStages(String docType, List<Map<String, Object>> stages);

    AuthoritiesResponse getAuthorities(String docType);

    AuthoritiesResponse saveAuthorities(String docType, List<Map<String, Object>> authorities);
}
