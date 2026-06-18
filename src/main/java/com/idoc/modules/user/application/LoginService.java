package com.idoc.modules.user.application;

import com.idoc.modules.user.application.dto.AuthResponse;
import com.idoc.modules.user.application.dto.LoginRequest;

public interface LoginService {
    AuthResponse login(LoginRequest request);

    /** เข้าสู่ระบบด้วย Gmail — รับอีเมลจาก Google (mock: ยังไม่ตรวจ token จริง) */
    AuthResponse loginWithGoogle(String email);
}
