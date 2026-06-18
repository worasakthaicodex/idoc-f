package com.idoc.modules.settings.web;

import com.idoc.modules.settings.application.SettingService;
import com.idoc.modules.settings.application.dto.SettingValueRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** ค่าตั้งค่าต่อบริษัท (key-value) — tenant มาจาก header X-Company-Id */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingController {

    private final SettingService settingService;

    @GetMapping
    public Map<String, Object> all() {
        return settingService.getAll();
    }

    @PutMapping("/{key}")
    public void put(@PathVariable String key, @RequestBody SettingValueRequest request) {
        settingService.put(key, request.value());
    }
}
