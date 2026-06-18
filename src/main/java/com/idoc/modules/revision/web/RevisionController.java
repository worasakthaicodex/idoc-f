package com.idoc.modules.revision.web;

import com.idoc.modules.revision.api.RevisionApi;
import com.idoc.modules.revision.api.RevisionView;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** อ่านรายการประวัติ/เวอร์ชันของ entity ใด ๆ — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/revisions")
@RequiredArgsConstructor
public class RevisionController {

    private final RevisionApi revisionApi;

    @GetMapping
    public List<RevisionView> list(@RequestParam String entityType, @RequestParam UUID entityId) {
        return revisionApi.list(entityType, entityId);
    }
}
