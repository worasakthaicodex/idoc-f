package com.idoc.modules.settings.application;

import com.idoc.modules.settings.domain.TenantSetting;
import com.idoc.modules.settings.domain.TenantSettingRepository;
import com.idoc.shared.tenant.TenantContext;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
@Transactional
@RequiredArgsConstructor
public class SettingServiceImpl implements SettingService {

    private final TenantSettingRepository repository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getAll() {
        Map<String, Object> out = new LinkedHashMap<>();
        repository.findByCompanyId(TenantContext.required())
                .forEach((s) -> out.put(s.getSkey(), read(s.getValue())));
        return out;
    }

    @Override
    public void put(String key, Object value) {
        UUID tenant = TenantContext.required();
        String json = objectMapper.writeValueAsString(value);
        TenantSetting s = repository.findByCompanyIdAndSkey(tenant, key)
                .orElseGet(() -> TenantSetting.create(tenant, key, json));
        s.setValue(json);
        repository.save(s);
    }

    private Object read(String s) {
        if (s == null || s.isBlank()) return null;
        return objectMapper.readValue(s, Object.class);
    }
}
