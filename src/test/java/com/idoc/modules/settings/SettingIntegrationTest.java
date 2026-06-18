package com.idoc.modules.settings;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.idoc.support.BaseIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class SettingIntegrationTest extends BaseIntegrationTest {

    @Test
    void settingsRoundTrip_andIsolatedPerCompany() throws Exception {
        UUID a = newCompany(rnd("A"));
        UUID b = newCompany(rnd("B"));

        // เก็บ array + bool ของ A
        mvc.perform(put("/api/settings/crm.fields").header("X-Company-Id", a.toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":[\"name\",\"grade\"]}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/settings/hr.enforce").header("X-Company-Id", a.toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":true}"))
                .andExpect(status().isOk());

        // A ได้ค่ากลับเป็น JSON typed
        mvc.perform(get("/api/settings").header("X-Company-Id", a.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['crm.fields'][0]").value("name"))
                .andExpect(jsonPath("$['hr.enforce']").value(true));

        // B ไม่เห็นของ A
        mvc.perform(get("/api/settings").header("X-Company-Id", b.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['crm.fields']").doesNotExist());

        // upsert ทับค่าเดิม
        mvc.perform(put("/api/settings/crm.fields").header("X-Company-Id", a.toString())
                .contentType(MediaType.APPLICATION_JSON).content("{\"value\":[\"name\"]}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/settings").header("X-Company-Id", a.toString()))
                .andExpect(jsonPath("$['crm.fields'].length()").value(1));
    }
}
