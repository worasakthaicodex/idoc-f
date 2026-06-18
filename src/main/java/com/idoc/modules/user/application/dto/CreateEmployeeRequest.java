package com.idoc.modules.user.application.dto;

import com.idoc.modules.user.domain.EmployeeRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;

/** ไม่รับ code (ระบบออกให้) และไม่รับ companyId (มาจาก tenant context) */
public record CreateEmployeeRequest(
        // ทั่วไป
        @NotBlank @Size(max = 200) String fullName,
        LocalDate birthday,
        @Size(max = 30) String idCard,
        @Size(max = 120) String position,
        // ติดต่อ
        @Email @Size(max = 200) String email,
        @Size(max = 30) String tel,
        @Size(max = 30) String mobile,
        @Size(max = 100) String line,
        // ที่อยู่
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
        // เอกสาร
        @Size(max = 50) String passportNo,
        LocalDate passportDate,
        @Size(max = 100) String passportCountry,
        @Size(max = 100) String passportDistrict,
        // สิทธิ์ + login
        EmployeeRole role,
        @Size(min = 4, max = 100) String password,   // ระบุ = ให้ login ด้วยอีเมลได้
        Boolean googleEnabled,                         // true = ให้ login ด้วย Gmail ได้
        Map<String, String> attributes                 // ฟิลด์ configurable อื่น ๆ
) {
}
