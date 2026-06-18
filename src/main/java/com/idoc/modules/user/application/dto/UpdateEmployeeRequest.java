package com.idoc.modules.user.application.dto;

import com.idoc.modules.user.domain.EmployeeRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;

public record UpdateEmployeeRequest(
        @NotBlank @Size(max = 200) String fullName,
        LocalDate birthday,
        @Size(max = 30) String idCard,
        @Size(max = 120) String position,
        @Email @Size(max = 200) String email,
        @Size(max = 30) String tel,
        @Size(max = 30) String mobile,
        @Size(max = 100) String line,
        @Size(max = 50) String houseNumber,
        @Size(max = 100) String building,
        @Size(max = 100) String village,
        @Size(max = 100) String alley,
        @Size(max = 100) String road,
        @Size(max = 100) String subDistrict,
        @Size(max = 100) String province,
        @Size(max = 10) String zip,
        String address,
        String addressFull,
        @Size(max = 50) String passportNo,
        LocalDate passportDate,
        @Size(max = 100) String passportCountry,
        @Size(max = 100) String passportDistrict,
        EmployeeRole role,
        @Size(min = 4, max = 100) String password,   // ระบุ = ตั้ง/เปลี่ยนรหัส (ให้ login ด้วยอีเมลได้) · เว้นว่าง = คงเดิม
        Boolean googleEnabled,
        Map<String, String> attributes
) {
}
