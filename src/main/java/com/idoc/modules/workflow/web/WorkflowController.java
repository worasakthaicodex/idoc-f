package com.idoc.modules.workflow.web;

import com.idoc.modules.workflow.application.WorkflowService;
import com.idoc.modules.workflow.application.dto.AuthoritiesRequest;
import com.idoc.modules.workflow.application.dto.AuthoritiesResponse;
import com.idoc.modules.workflow.application.dto.StagesRequest;
import com.idoc.modules.workflow.application.dto.StagesResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** ตั้งค่า workflow (stages/authorities) ของวงจรชีวิตเอกสาร — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/workflow")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    @GetMapping("/stages")
    public StagesResponse getStages(@RequestParam String docType) {
        return workflowService.getStages(docType);
    }

    @PutMapping("/stages")
    public StagesResponse saveStages(@Valid @RequestBody StagesRequest request) {
        return workflowService.saveStages(request.docType(), request.stages());
    }

    @GetMapping("/authorities")
    public AuthoritiesResponse getAuthorities(@RequestParam String docType) {
        return workflowService.getAuthorities(docType);
    }

    @PutMapping("/authorities")
    public AuthoritiesResponse saveAuthorities(@Valid @RequestBody AuthoritiesRequest request) {
        return workflowService.saveAuthorities(request.docType(), request.authorities());
    }
}
