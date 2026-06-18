package com.idoc.shared.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * ดึง tenant (บริษัท) จาก header X-Company-Id แล้วเซ็ตลง TenantContext ทุก request
 *
 * NOTE (dev): นี่เป็นตัวแทนชั่วคราว — ของจริงต้องอ่าน companyId จาก JWT claim
 * ห้ามเชื่อค่าจาก client ใน production (ตอนนี้ใช้เพื่อทดสอบการแยก tenant)
 */
@Component
public class TenantFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Company-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String raw = request.getHeader(HEADER);
            if (raw != null && !raw.isBlank()) {
                try {
                    TenantContext.set(UUID.fromString(raw.trim()));
                } catch (IllegalArgumentException ignored) {
                    // header ไม่ใช่ UUID → ไม่เซ็ต ปล่อยให้ required() ปฏิเสธทีหลัง
                }
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
