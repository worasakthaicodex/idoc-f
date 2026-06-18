package com.idoc.shared.access;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/**
 * ดึงผู้ใช้ปัจจุบันจาก header → UserContext ทุก request
 *   X-User-Role     = PLATFORM_OWNER | COMPANY_OWNER | STAFF
 *   X-User-Modules  = base64(JSON) ของ { moduleCode: LEVEL }
 *
 * NOTE (dev): trust ระดับเดียวกับ X-Company-Id — ของจริงต้องมาจาก JWT
 */
@Component
@RequiredArgsConstructor
public class UserFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String role = request.getHeader("X-User-Role");
            Map<String, String> modules = Map.of();
            String enc = request.getHeader("X-User-Modules");
            if (enc != null && !enc.isBlank()) {
                try {
                    String json = new String(Base64.getDecoder().decode(enc.trim()), StandardCharsets.UTF_8);
                    @SuppressWarnings("unchecked")
                    Map<String, String> m = objectMapper.readValue(json, Map.class);
                    modules = m;
                } catch (Exception ignored) {
                    // header ผิดรูป → ถือว่าไม่มีสิทธิ์โมดูล
                }
            }
            boolean workflow = "1".equals(request.getHeader("X-Workflow"));
            UserContext.set(role, modules, workflow);
            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }
}
