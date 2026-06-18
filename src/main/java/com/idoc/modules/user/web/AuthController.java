package com.idoc.modules.user.web;

import com.idoc.modules.user.application.LoginService;
import com.idoc.modules.user.application.dto.AuthResponse;
import com.idoc.modules.user.application.dto.GoogleLoginRequest;
import com.idoc.modules.user.application.dto.LoginRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** เข้าสู่ระบบด้วยอีเมล — ไม่ต้องมี X-Company-Id (ยังไม่รู้บริษัทตอนนี้) */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LoginService loginService;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return loginService.login(request);
    }

    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return loginService.loginWithGoogle(request.email());
    }
}
