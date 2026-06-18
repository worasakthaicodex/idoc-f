package com.idoc.modules.customer;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.idoc.support.BaseIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class CustomerIntegrationTest extends BaseIntegrationTest {

    @Test
    void createsCustomer_withRunningCode_andJsonbAttributes() throws Exception {
        UUID a = newCompany(rnd("A"));

        mvc.perform(post("/api/customers").header("X-Company-Id", a.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"ลูกค้า เอ\",\"groupName\":\"ขายส่ง\",\"attributes\":{\"grade\":\"A\",\"taxId\":\"123\"}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code", startsWith("REG")))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.groupName").value("ขายส่ง"))
                .andExpect(jsonPath("$.attributes.grade").value("A"))
                .andExpect(jsonPath("$.attributes.taxId").value("123"));
    }

    @Test
    void customersAreIsolatedPerCompany() throws Exception {
        UUID a = newCompany(rnd("A"));
        UUID b = newCompany(rnd("B"));

        String body = mvc.perform(post("/api/customers").header("X-Company-Id", a.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"เฉพาะ A\",\"attributes\":{}}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");

        // A เห็น 1, B เห็น 0
        mvc.perform(get("/api/customers?size=50").header("X-Company-Id", a.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/customers?size=50").header("X-Company-Id", b.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        // B เปิดของ A ตรง ๆ = 404 (ไม่รั่วว่ามีอยู่)
        mvc.perform(get("/api/customers/" + id).header("X-Company-Id", b.toString()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/customers/" + id).header("X-Company-Id", a.toString()))
                .andExpect(status().isOk());
    }

    @Test
    void runningCodeIncrementsPerCompany() throws Exception {
        UUID a = newCompany(rnd("A"));
        String c1 = JsonPath.read(create(a, "หนึ่ง"), "$.code");
        String c2 = JsonPath.read(create(a, "สอง"), "$.code");
        org.junit.jupiter.api.Assertions.assertNotEquals(c1, c2);
        org.junit.jupiter.api.Assertions.assertTrue(c1.startsWith("REG") && c2.startsWith("REG"));
    }

    private String create(UUID tenant, String name) throws Exception {
        return mvc.perform(post("/api/customers").header("X-Company-Id", tenant.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"attributes\":{}}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }
}
